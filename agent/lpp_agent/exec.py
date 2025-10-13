from __future__ import annotations
import logging, subprocess, yaml
from typing import Any
from .plugins import file_edit, systemd, pkg, sysctl

log = logging.getLogger(__name__)

PLUGIN_MAP = {
    "file.replace_kv": file_edit.replace_kv,
    "file.ensure_lines": file_edit.ensure_lines,
    "service.manage": systemd.manage,
    "pkg.ensure": pkg.ensure,
    "sysctl.set": sysctl.set,
}

def apply_policy_yaml(text: str, allow_bash: bool = True) -> list[dict[str, Any]]:
    y = yaml.safe_load(text) if text.strip() else {}
    results: list[dict[str, Any]] = []
    rules = y.get("rules", [])
    for r in rules:
        rid = r.get("id")
        rtype = r.get("type")
        try:
            if rtype == "bash":
                if not allow_bash:
                    results.append({"id": rid, "type": rtype, "status": "error", "detail": "bash disabled"})
                    continue
                code = r.get("code", "")
                cp = subprocess.run(["bash","-lc", code], text=True, capture_output=True)
                status = "pass" if cp.returncode == 0 else "error"
                results.append({"id": rid, "type": rtype, "status": status,
                                "stdout": cp.stdout[-4000:], "stderr": cp.stderr[-4000:]})
                continue

            fn = PLUGIN_MAP.get(rtype)
            if not fn:
                results.append({"id": rid, "type": rtype, "status": "error", "detail": f"unknown rule type {rtype}"})
                continue

            # pass only parameters the function expects
            kws = {k: v for k, v in r.items() if k not in ("id", "type")}
            status = fn(**kws)
            results.append({"id": rid, "type": rtype, "status": status})
        except Exception as e:
            results.append({"id": rid, "type": rtype, "status": "error", "detail": str(e)})
    return results
