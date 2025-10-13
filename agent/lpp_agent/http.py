from __future__ import annotations
import logging, time
import requests
from typing import Any

log = logging.getLogger(__name__)

class Api:
    def __init__(self, api_base: str, jwt: str | None = None, timeout=20):
        self.base = api_base.rstrip("/")
        self.jwt = jwt
        self.timeout = timeout

    def _h(self) -> dict[str,str]:
        h = {"Content-Type": "application/json"}
        if self.jwt:
            h["Authorization"] = f"Bearer {self.jwt}"
        return h

    # --- enrollment ---
    def enroll(self, token: str, hostname: str, distro: str) -> dict[str, Any]:
        u = f"{self.base}/agents/enroll"
        r = requests.post(u, params={"hostname": hostname, "distro": distro, "token": token}, timeout=self.timeout)
        r.raise_for_status()
        return r.json()

    # --- policy fetch ---
    def effective_policy(self, agent_id: int) -> list[dict[str, Any]]:
        u = f"{self.base}/agents/{agent_id}/effective-policy"
        r = requests.get(u, headers=self._h(), timeout=self.timeout)
        r.raise_for_status()
        return r.json().get("policies", [])

    # --- result ingest ---
    def post_results(self, payload: dict[str, Any]) -> None:
        u = f"{self.base}/results/ingest"
        r = requests.post(u, json=payload, headers=self._h(), timeout=self.timeout)
        r.raise_for_status()

    # --- heartbeat (optional hook) ---
    def heartbeat(self, agent_id: int) -> None:
        try:
            u = f"{self.base}/agents/{agent_id}/heartbeat"
            requests.post(u, headers=self._h(), json={"ts": int(time.time())}, timeout=self.timeout)
        except Exception:
            pass
