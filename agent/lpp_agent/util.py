from __future__ import annotations
import subprocess, time, logging

log = logging.getLogger(__name__)

def run(cmd: list[str], check=False, input_text: str|None=None) -> subprocess.CompletedProcess:
    log.debug("run: %s", " ".join(cmd))
    return subprocess.run(cmd, check=check, text=True, input=input_text,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE)

def distro_id() -> str:
    try:
        out = run(["bash", "-lc", ". /etc/os-release && echo ${ID}-${VERSION_ID}"]).stdout.strip()
        return out or "linux-unknown"
    except Exception:
        return "linux-unknown"

def backoff_sleep(attempt: int, base=2.0, cap=600) -> int:
    delay = min(int(base ** attempt), cap)
    time.sleep(delay)
    return delay
