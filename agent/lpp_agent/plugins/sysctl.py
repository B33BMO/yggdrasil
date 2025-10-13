from __future__ import annotations
import subprocess
from pathlib import Path

def set(param: str, value: str, persist: bool = True):
    subprocess.call(["sysctl", f"{param}={value}"])
    if persist:
        Path("/etc/sysctl.d").mkdir(parents=True, exist_ok=True)
        Path("/etc/sysctl.d/99-lpp.conf").write_text(f"{param} = {value}\n")
        subprocess.call(["sysctl", "-p", "/etc/sysctl.d/99-yggdrasil.conf"])
    return "fixed"
