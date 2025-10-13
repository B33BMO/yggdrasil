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
    """
    One iteration:
      - GET effective policy with If-None-Match
      - If 304: heartbeat only
      - If 200: apply YAML policies, post results, heartbeat
      - Persist new ETag so restarts don't re-apply
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
        # No policy change → just heartbeat and return quickly
        a.heartbeat(agent_id)
        log.debug("No policy change (etag=%s) — rev=%s", etag, rev)
        return

    log.info("Policy change detected (rev=%s). Applying %d policies…", rev, len(policies))

    all_results: list[dict[str, Any]] = []
    for p in policies:
        yml = p.get("yaml", "")
        res = apply_policy_yaml(yml, allow_bash=allow_bash)
        for r in res:
            r["policy_id"] = p.get("id")
        all_results.extend(res)

    # Ingest + heartbeat
    a.post_results({"agent_id": agent_id, "results": all_results, "rev": rev})
    a.heartbeat(agent_id)

    # Persist ETag so we won’t re-apply after restart
    st.setdefault("etags", {})[key] = new_etag
    save_state(st)
    log.info("Applied policies. Stored ETag %s", new_etag)

def cmd_run():
    cfg = load_conf(); setup_logging()
    if not cfg.get("agent_id"):
        log.error("Not enrolled. Run: sudo lpp-agent enroll <token> <api-url>")
        return 2

    attempt = 0
    base_interval = int(cfg.get("interval_sec", 60))
    while True:
        try:
            run_once(cfg)
            attempt = 0
            # tiny jitter to avoid thundering herd
            time.sleep(base_interval + random.uniform(0, 5))
        except Exception as e:
            log.error("loop error: %s", e)
            attempt += 1
            backoff_sleep(attempt, cap=int(cfg.get("max_backoff_sec", 600)))
            continue

def cli(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="lpp-agent")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_enroll = sub.add_parser("enroll", help="Enroll device with token and API")
    p_enroll.add_argument("token", help="Enrollment token (enr_...)")
    p_enroll.add_argument("api", help="API base (include /api), e.g. http://host:3000/api")

    p_run = sub.add_parser("run", help="Run agent loop")

    args = parser.parse_args(argv)

    if args.cmd == "enroll":
        cfg = AgentConfig.load_or_default()
        cfg.api = args.api
        enroll_device(cfg, token=args.token)
        cfg.save()
        print("[lpp] enrolled")
        return 0

    if args.cmd == "run":
        cfg = AgentConfig.load()
        if not cfg:
            print("[lpp] not enrolled; run: lpp-agent enroll <TOKEN> <API>", file=sys.stderr)
            return 2
        return run_loop(cfg)

    return 0

if __name__ == "__main__":
    raise SystemExit(cli())