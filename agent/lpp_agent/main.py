from __future__ import annotations
import argparse, logging, time
from typing import Any
from .config import load_conf, save_conf, load_state, save_state, setup_logging
from .util import distro_id, backoff_sleep
from .http import Api
from .exec import apply_policy_yaml

log = logging.getLogger(__name__)

def cmd_enroll(token: str, api: str):
    cfg = load_conf()
    setup_logging()
    cfg["api"] = api
    a = Api(api)
    dist = distro_id()
    res = a.enroll(token=token, hostname=cfg["hostname"], distro=dist)
    cfg["agent_id"] = res["agent_id"]
    cfg["jwt"] = res.get("device_jwt")
    save_conf(cfg)
    log.info("Enrolled as agent %s", cfg["agent_id"])
    return 0

def run_once(cfg: dict[str, Any]) -> None:
    a = Api(cfg["api"], cfg.get("jwt"))
    agent_id = cfg["agent_id"]
    policies = a.effective_policy(agent_id)
    allow_bash = bool(cfg.get("allow_bash", True))

    all_results: list[dict[str, Any]] = []
    for p in policies:
        yml = p.get("yaml", "")
        res = apply_policy_yaml(yml, allow_bash=allow_bash)
        for r in res:
            r["policy_id"] = p.get("id")
        all_results.extend(res)

    a.post_results({"agent_id": agent_id, "results": all_results})
    a.heartbeat(agent_id)

def cmd_run():
    cfg = load_conf(); setup_logging()
    if not cfg.get("agent_id"):
        log.error("Not enrolled. Run: sudo lpp-agent enroll <token> <api-url>")
        return 2

    attempt = 0
    while True:
        try:
            run_once(cfg)
            attempt = 0
        except Exception as e:
            log.error("loop error: %s", e)
            attempt += 1
            backoff_sleep(attempt, cap=int(cfg.get("max_backoff_sec", 600)))
            continue
        time.sleep(int(cfg.get("interval_sec", 60)))

def cli():
    ap = argparse.ArgumentParser(prog="lpp-agent")
    sub = ap.add_subparsers(dest="cmd")
    p_enr = sub.add_parser("enroll"); p_enr.add_argument("token"); p_enr.add_argument("api")
    sub.add_parser("run")
    args = ap.parse_args()
    if args.cmd == "enroll": return cmd_enroll(args.token, args.api)
    return cmd_run()

if __name__ == "__main__":
    raise SystemExit(cli())
