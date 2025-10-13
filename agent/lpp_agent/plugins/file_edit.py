from __future__ import annotations
from pathlib import Path
import re

def replace_kv(file: str, key: str, value: str, notify: str | None = None):
    p = Path(file)
    old = p.read_text() if p.exists() else ""
    key_re = re.compile(rf"^\s*{re.escape(key)}\s+.*$", re.M)
    if key_re.search(old):
        new = key_re.sub(f"{key} {value}", old)
    else:
        new = old + ("" if old.endswith("\n") else "\n") + f"{key} {value}\n"
    if new != old:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(new)
        if notify:
            import subprocess; subprocess.call(notify.split())
        return "fixed"
    return "pass"

def ensure_lines(file: str, present: list[str], notify: str | None = None):
    p = Path(file)
    lines = p.read_text().splitlines() if p.exists() else []
    s = set(lines); changed = False
    for ln in present:
        if ln not in s:
            lines.append(ln); changed = True
    if changed:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text("\n".join(lines) + "\n")
        if notify:
            import subprocess; subprocess.call(notify.split())
        return "fixed"
    return "pass"
