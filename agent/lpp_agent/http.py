from __future__ import annotations
import logging, time
import requests
from typing import Any, Tuple

log = logging.getLogger(__name__)

class Api:
    def __init__(self, api_base: str, jwt: str | None = None, timeout=20):
        self.base = api_base.rstrip("/")
        self.jwt = jwt
        self.timeout = timeout
        self._session = requests.Session()
        # NB: content-type only where needed (POSTs); GETs can omit
        self._session.headers.update({"User-Agent": "lpp-agent/0.2.0"})

    def _h(self) -> dict[str,str]:
        h = {"Content-Type": "application/json"}
        if self.jwt:
            h["Authorization"] = f"Bearer {self.jwt}"
        return h

    # --- enrollment ---
    def enroll(self, token: str, hostname: str, distro: str) -> dict[str, Any]:
        u = f"{self.base}/agents/enroll"
        r = self._session.post(u, params={"hostname": hostname, "distro": distro, "token": token}, timeout=self.timeout)
        r.raise_for_status()
        return r.json()

    # --- policy fetch with ETag ---
    def effective_policy_etag(self, agent_id: int | str, etag: str | None) -> Tuple[bool, list[dict[str, Any]], str | None, int | None]:
        """
        Returns (changed, policies, new_etag, rev)
          - changed=False when server returns 304
        """
        u = f"{self.base}/agents/{agent_id}/effective-policy"
        headers = {}
        if etag:
            headers["If-None-Match"] = etag
        r = self._session.get(u, headers=headers, timeout=self.timeout)
        if r.status_code == 304:
            return False, [], r.headers.get("ETag"), None
        r.raise_for_status()
        data = r.json()
        return True, data.get("policies", []), r.headers.get("ETag"), data.get("rev")

    # Back-compat (unused by new loop, but keep if other code calls it)
    def effective_policy(self, agent_id: int | str) -> list[dict[str, Any]]:
        u = f"{self.base}/agents/{agent_id}/effective-policy"
        r = self._session.get(u, timeout=self.timeout)
        r.raise_for_status()
        return r.json().get("policies", [])

    # --- result ingest ---
    def post_results(self, payload: dict[str, Any]) -> None:
        u = f"{self.base}/results/ingest"
        r = self._session.post(u, json=payload, headers=self._h(), timeout=self.timeout)
        r.raise_for_status()

    # --- heartbeat (optional hook) ---
    def heartbeat(self, agent_id: int | str) -> None:
        try:
            u = f"{self.base}/agents/{agent_id}/heartbeat"
            self._session.post(u, headers=self._h(), json={"ts": int(time.time())}, timeout=self.timeout)
        except Exception:
            pass
