from __future__ import annotations
import subprocess

def manage(service: str, state: str):
    # state: started|stopped|restarted|enabled|disabled
    if state == "started":
        subprocess.call(["systemctl", "enable", "--now", service])
    elif state == "stopped":
        subprocess.call(["systemctl", "disable", "--now", service])
    elif state == "restarted":
        subprocess.call(["systemctl", "restart", service])
    elif state == "enabled":
        subprocess.call(["systemctl", "enable", service])
    elif state == "disabled":
        subprocess.call(["systemctl", "disable", service])
    return "pass"
