import os
import json
import time
import random
import tempfile
import subprocess
import signal
from typing import Optional, Tuple, Dict, Any

import requests


STATE_DIR = "/var/lib/lpp"
STATE_FILE = os.path.join(STATE_DIR, "state.json")
USER_AGENT = "lpp-agent/0.2.0"
DEFAULT_TIMEOUT_POLICY = 1800  # 30m per policy step
DEFAULT_SLEEP_CHANGED = 20
DEFAULT_SLEEP_NOCHANGE = 60
MAX_STD_CAPTURE = 4000  # chars per stream


def _ensure_state_dir():
    try:
        os.makedirs(STATE_DIR, exist_ok=True)
    except Exception:
        pass


def _load_state() -> Dict[str, Any]:
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _save_state(data: Dict[str, Any]) -> None:
    _ensure_state_dir()
    tmp = STATE_FILE + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f)
        os.replace(tmp, STATE_FILE)
    except Exception:
        pass


def _is_root() -> bool:
    try:
        return os.geteuid() == 0  # type: ignore[attr-defined]
    except Exception:
        # On platforms without geteuid (Windows), assume not root
        return False


def _cmd_exists(cmd: str) -> bool:
    return subprocess.call(["bash", "-lc", f"command -v {cmd} >/dev/null 2>&1"]) == 0


def _pm_detect() -> Optional[str]:
    # order matters; pick a “canonical” manager
    for pm in ("apt-get", "dnf", "yum", "zypper", "pacman", "apk", "brew"):
        if _cmd_exists(pm):
            return pm
    return None


def _sudo_prefix() -> str:
    if _is_root():
        return ""
    return "sudo " if _cmd_exists("sudo") else ""


def _trim(s: str) -> str:
    if not s:
        return s
    return s[-MAX_STD_CAPTURE:]


class Runner:
    def __init__(self, api_base: str, agent_id: str):
        self.api = api_base.rstrip("/")
        self.agent_id = str(agent_id)
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})
        self.etag: Optional[str] = None

        # graceful shutdown
        signal.signal(signal.SIGTERM, self._sig_exit)
        signal.signal(signal.SIGINT, self._sig_exit)

        # restore previous etag, if any
        st = _load_state()
        if st.get("agent_id") == self.agent_id and st.get("api") == self.api:
            self.etag = st.get("etag") or None

    # ------------- plumbing -------------

    def _persist_etag(self, etag: Optional[str]):
        self.etag = etag
        st = _load_state()
        st.update({"agent_id": self.agent_id, "api": self.api, "etag": etag})
        _save_state(st)

    def _sig_exit(self, *_args):
        # allow quick termination in the loop
        raise SystemExit(0)

    def _heartbeat(self):
        try:
            self.session.post(
                f"{self.api}/agents/{self.agent_id}/heartbeat", timeout=5
            )
        except Exception:
            pass

    def _ingest(self, payload: dict):
        try:
            body = {"agent_id": self.agent_id, **payload}
            self.session.post(
                f"{self.api}/results/ingest", json=body, timeout=10
            )
        except Exception:
            pass

    def _fetch_policy(self) -> Tuple[Optional[dict], Optional[str]]:
        headers = {}
        if self.etag:
            headers["If-None-Match"] = self.etag
        try:
            r = self.session.get(
                f"{self.api}/agents/{self.agent_id}/effective-policy",
                headers=headers, timeout=30
            )
        except Exception as e:
            # network error: no change applied
            self._ingest({"error": f"fetch_policy: {e!r}"})
            return None, self.etag

        if r.status_code == 304:
            return None, r.headers.get("ETag")
        r.raise_for_status()
        try:
            data = r.json()
        except Exception as e:
            self._ingest({"error": f"policy json decode: {e!r}", "body": _trim(r.text)})
            return None, r.headers.get("ETag")
        return data, r.headers.get("ETag")

    # ------------- apply logic -------------

    def _apply_pkg(self, pkg: str, args: Optional[str], timeout: int):
        pm = _pm_detect()
        sudo = _sudo_prefix()
        args = (args or "").strip()
        # build a single bash -lc string that tries the detected manager first
        if pm == "apt-get":
            cmd = f'{sudo}apt-get update -y && {sudo}apt-get install -y {pkg} {args}'
        elif pm in ("dnf", "yum"):
            cmd = f'{sudo}{pm} install -y {pkg} {args}'
        elif pm == "zypper":
            cmd = f'{sudo}zypper --non-interactive install {pkg} {args}'
        elif pm == "pacman":
            # pacman has separate sync/update semantics; assume DB is reasonably fresh
            cmd = f'{sudo}pacman -Sy --noconfirm {pkg} {args}'
        elif pm == "apk":
            cmd = f'{sudo}apk add --no-cache {pkg} {args}'
        elif pm == "brew":
            # macOS Homebrew
            sudob = ""  # brew typically not via sudo
            cmd = f'{sudob}brew install {pkg} {args}'
        else:
            # try a generic multi-manager fallback
            cmd = (
                f'if command -v apt-get >/dev/null 2>&1; then {sudo}apt-get update -y && {sudo}apt-get install -y {pkg} {args}; '
                f'elif command -v dnf >/dev/null 2>&1; then {sudo}dnf install -y {pkg} {args}; '
                f'elif command -v yum >/dev/null 2>&1; then {sudo}yum install -y {pkg} {args}; '
                f'elif command -v zypper >/dev/null 2>&1; then {sudo}zypper --non-interactive install {pkg} {args}; '
                f'elif command -v pacman >/dev/null 2>&1; then {sudo}pacman -Sy --noconfirm {pkg} {args}; '
                f'elif command -v apk >/dev/null 2>&1; then {sudo}apk add --no-cache {pkg} {args}; '
                f'elif command -v brew >/dev/null 2>&1; then brew install {pkg} {args}; '
                f'else echo "unsupported package manager"; exit 0; fi'
            )

        # run
        out = subprocess.run(
            ["bash", "-lc", cmd],
            capture_output=True, text=True, timeout=timeout
        )
        return {
            "rc": out.returncode,
            "stdout": _trim(out.stdout),
            "stderr": _trim(out.stderr),
            "pm": pm or "auto",
        }

    def _apply_bash(self, script: str, timeout: int):
        # Write script atomically, execute, then remove
        fd, path = tempfile.mkstemp(prefix="lpp-", suffix=".sh")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write("#!/usr/bin/env bash\nset -euo pipefail\n")
                f.write(script)
            os.chmod(path, 0o700)
            out = subprocess.run(
                ["bash", path],
                capture_output=True, text=True, timeout=timeout
            )
            return {
                "rc": out.returncode,
                "stdout": _trim(out.stdout),
                "stderr": _trim(out.stderr),
            }
        finally:
            try:
                os.remove(path)
            except Exception:
                pass

    def _apply_policies(self, data: dict):
        results = []
        for p in data.get("policies", []):
            pid = p.get("id", "?")
            timeout = int(p.get("timeout") or DEFAULT_TIMEOUT_POLICY)
            try:
                if p.get("packageName"):
                    pkg_res = self._apply_pkg(
                        p["packageName"], p.get("args"), timeout
                    )
                    results.append({
                        "id": pid, "type": "package", **pkg_res
                    })
                if p.get("bash"):
                    bash_res = self._apply_bash(p["bash"], timeout)
                    results.append({
                        "id": pid, "type": "bash", **bash_res
                    })
                # If neither present, still record a no-op so UI can show it
                if not p.get("packageName") and not p.get("bash"):
                    results.append({"id": pid, "type": "noop"})
            except subprocess.TimeoutExpired as e:
                results.append({"id": pid, "type": "timeout", "error": repr(e)})
            except Exception as e:
                results.append({"id": pid, "type": "error", "error": repr(e)})
        return results

    # ------------- main loop -------------

    def run(self):
        sleep_changed = DEFAULT_SLEEP_CHANGED
        sleep_nochange = DEFAULT_SLEEP_NOCHANGE

        while True:
            try:
                data, new_etag = self._fetch_policy()
                if data is None:
                    # No change (304 or fetch error handled), heartbeat & sleep longer
                    self._heartbeat()
                    # small jitter to avoid thundering herd
                    time.sleep(sleep_nochange + random.uniform(0, 5))
                    continue

                # Apply and report
                res = self._apply_policies(data)
                self._ingest({
                    "result": res,
                    "rev": data.get("rev"),
                })
                self._persist_etag(new_etag)
                self._heartbeat()
                time.sleep(sleep_changed + random.uniform(0, 3))

            except SystemExit:
                # termination signal
                break
            except Exception as e:
                # Network or other transient errors → backoff a bit
                self._ingest({"error": f"loop: {e!r}"})
                time.sleep(30)
