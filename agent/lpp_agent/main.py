# lpp_agent/main.py
from __future__ import annotations
import argparse, logging, time, random
from typing import Any

from .config import load_conf, save_conf, load_state, save_state, setup_logging
from .util import distro_id, backoff_sleep
from .http import Api
from .exec import apply_policy_yaml

log = logging.getLogger(__name__)

def _state_key(api: str, agent_id: str) -> str:
    return f"{api}::{agent_id}"

def cmd_enroll(token: str, api: str) -> int:
    cfg = load_conf()
    setup_logging()
    cfg["api"] = api.rstrip("/")
    a = Api(cfg["api"])
    dist = distro_id()
    res = a.enroll(token=token, hostname=cfg["hostname"], distro=dist)
    cfg["agent_id"] = str(res["agent_id"])
    cfg["jwt"] = res.get("device_jwt")
    save_conf(cfg)
    log.info("Enrolled as agent %s", cfg["agent_id"])
    return 0

def run_once(cfg: dict[str, Any]) -> None:
    """
    One iteration:
      - GET effective policy using If-None-Match (ETag)
      - If 304 → heartbeat only
      - Else apply YAML policies, POST results, heartbeat
      - Cache ETag so restarts don’t re-apply
    """
    api = cfg["api"]
    agent_id = str(cfg["agent_id"])
    allow_bash = bool(cfg.get("allow_bash", True))

    # restore etag from state
    st = load_state()
    key = _state_key(api, agent_id)
    etag = (st.get("etags") or {}).get(key)

    a = Api(api, cfg.get("jwt"))
    changed, policies, new_etag, rev = a.effective_policy_etag(agent_id, etag)

    if not changed:
        a.heartbeat(agent_id)
        log.debug("No policy change (etag=%s)", etag)
        return

    log.info("Policy change detected (rev=%s). Applying %d policies…", rev, len(policies))

    all_results: list[dict[str, Any]] = []
    for p in policies:
        yml = p.get("yaml", "")
        res = apply_policy_yaml(yml, allow_bash=allow_bash)
        for r in res:
            r["policy_id"] = p.get("id")
        all_results.extend(res)

    a.post_results({"agent_id": agent_id, "results": all_results, "rev": rev})
    a.heartbeat(agent_id)

    # persist new etag
    st.setdefault("etags", {})[key] = new_etag
    save_state(st)
    log.info("Applied policies. Stored ETag %s", new_etag)

def cmd_run() -> int:
    cfg = load_conf(); setup_logging()
    if not cfg.get("agent_id"):
        log.error("Not enrolled. Run: sudo lpp-agent enroll <TOKEN> <API-with-/api>")
        return 2

    attempt = 0
    base_interval = int(cfg.get("interval_sec", 60))
    while True:
        try:
            run_once(cfg)
            attempt = 0
            time.sleep(base_interval + random.uniform(0, 5))  # small jitter
        except Exception as e:
            log.error("loop error: %s", e)
            attempt += 1
            backoff_sleep(attempt, cap=int(cfg.get("max_backoff_sec", 600)))
            continue

def cli(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="lpp-agent")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_enr = sub.add_parser("enroll", help="Enroll device")
    p_enr.add_argument("token", help="enr_… token")
    p_enr.add_argument("api", help="API base (include /api), e.g. http://host:3000/api")

    sub.add_parser("run", help="Run agent loop")

    args = parser.parse_args(argv)
    if args.cmd == "enroll":
        return cmd_enroll(args.token, args.api)
    if args.cmd == "run":
        return cmd_run()
    return 0

if __name__ == "__main__":
    raise SystemExit(cli())
