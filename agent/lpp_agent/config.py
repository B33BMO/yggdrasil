from __future__ import annotations
import os, sys, json, logging
from pathlib import Path
from typing import Any

APP = "lpp"
CONF_DIR = Path("/etc")/APP
STATE_DIR = Path("/var/lib")/APP
LOG_DIR = Path("/var/log")/APP
CONF_FILE = CONF_DIR/"agent.toml"
STATE_FILE = STATE_DIR/"state.json"
LOG_FILE = LOG_DIR/"agent.log"

DEFAULTS = {
    "api": "http://localhost:8080",
    "agent_id": None,
    "jwt": None,
    "tenant": 1,
    "interval_sec": 60,
    "max_backoff_sec": 600,
    "hostname": None,
    "tags": [],              # arbitrary host tags (e.g., prod, gpu)
    "allow_bash": True,      # allow bash from server policies
}

def ensure_dirs():
    for p in (CONF_DIR, STATE_DIR, LOG_DIR):
        p.mkdir(parents=True, exist_ok=True)

def load_conf() -> dict[str, Any]:
    ensure_dirs()
    data = DEFAULTS.copy()
    if CONF_FILE.exists():
        try:
            import tomli
            data.update(tomli.loads(CONF_FILE.read_text()))
        except Exception: pass
    if not data.get("hostname"):
        import socket
        data["hostname"] = socket.gethostname()
    return data

def save_conf(conf: dict[str, Any]) -> None:
    ensure_dirs()
    lines = []
    for k,v in conf.items():
        if isinstance(v, str):
            lines.append(f'{k} = "{v}"')
        elif isinstance(v, bool):
            lines.append(f'{k} = {str(v).lower()}')
        else:
            lines.append(f"{k} = {json.dumps(v)}")
    CONF_FILE.write_text("\n".join(lines)+"\n")

def load_state() -> dict[str, Any]:
    ensure_dirs()
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception:
            return {}
    return {}

def save_state(st: dict[str, Any]) -> None:
    ensure_dirs()
    STATE_FILE.write_text(json.dumps(st, indent=2))

def setup_logging(level=logging.INFO) -> None:
    ensure_dirs()
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[
            logging.FileHandler(LOG_FILE),
            logging.StreamHandler(sys.stdout),
        ]
    )
