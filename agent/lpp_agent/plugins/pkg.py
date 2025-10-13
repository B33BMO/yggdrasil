from __future__ import annotations
import shutil, subprocess

def ensure(name: str, state: str = "present"):
    # present/absent; supports apt, dnf, pacman
    apt = shutil.which("apt-get")
    dnf = shutil.which("dnf")
    pac = shutil.which("pacman")

    if state == "present":
        if apt:
            subprocess.call(["bash","-lc", f"dpkg -s {name} >/dev/null 2>&1 || (apt-get update -y && apt-get install -y {name})"])
        elif dnf:
            subprocess.call(["bash","-lc", f"rpm -q {name} >/dev/null 2>&1 || dnf install -y {name}"])
        elif pac:
            subprocess.call(["bash","-lc", f"pacman -Qi {name} >/dev/null 2>&1 || pacman -S --noconfirm {name}"])
        else:
            return "error"
        return "fixed"
    else:  # absent
        if apt:
            subprocess.call(["bash","-lc", f"dpkg -s {name} >/dev/null 2>&1 && apt-get remove -y {name}"])
        elif dnf:
            subprocess.call(["bash","-lc", f"rpm -q {name} >/dev/null 2>&1 && dnf remove -y {name}"])
        elif pac:
            subprocess.call(["bash","-lc", f"pacman -Qi {name} >/dev/null 2>&1 && pacman -R --noconfirm {name}"])
        else:
            return "error"
        return "fixed"
