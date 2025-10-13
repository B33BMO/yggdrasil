"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/Modal";
import type { Customer } from "@/lib/types";

const OS_OPTIONS = [
  { id: "ubuntu-22.04", label: "Ubuntu 22.04" },
  { id: "ubuntu-24.04", label: "Ubuntu 24.04" },
  { id: "rocky-9.3", label: "Rocky Linux 9.3" },
  { id: "debian-12", label: "Debian 12" },
  { id: "arch", label: "Arch" }
];

type Props = {
  open: boolean;
  onClose: () => void;
  customers: Customer[];
  onSimulateInstall: (params: { hostname?: string; customerId: string; distro: string }) => Promise<void>;
};

export default function InstallAgentModal({ open, onClose, customers, onSimulateInstall }: Props) {
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [selectedOS, setSelectedOS] = useState<string>(OS_OPTIONS[0].id);
  const [hostname, setHostname] = useState<string>("");

  const [token, setToken] = useState<string>("");
  const [curlCmd, setCurlCmd] = useState<string>("");

  // reset when reopened
  useEffect(() => {
    if (open) {
      setSelectedCustomer("");
      setSelectedOS(OS_OPTIONS[0].id);
      setHostname("");
      setToken("");
      setCurlCmd("");
    }
  }, [open]);

  function apiBase() {
    if (typeof window !== "undefined") return `${window.location.origin}/api`;
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
    return `${base.replace(/\/$/, "")}/api`;
  }

  async function generateCurl() {
    if (!selectedCustomer) return;

    // Request a real token tied to the chosen customer + OS
    let issuedToken = "";
    try {
      const res = await fetch("/api/enroll/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: selectedCustomer, os: selectedOS })
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      issuedToken = data.token as string;
    } catch {
      // fallback dev token
      issuedToken = `enr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;
    }
    setToken(issuedToken);

    const base = apiBase();
    const cmd =
      `curl -fsSL ${base}/agent/install | sudo bash -s -- ` +
      `--token ${issuedToken} --api ${base} --customer ${selectedCustomer} ` +
      `--os ${selectedOS}${hostname ? ` --hostname ${hostname}` : ""}`;
    setCurlCmd(cmd);
  }

  async function simulateInstall() {
    if (!selectedCustomer || !selectedOS) return;
    await onSimulateInstall({
      hostname: hostname || undefined,
      customerId: selectedCustomer,
      distro: selectedOS
    });
    onClose();
  }

  const footer = (
    <>
      <button className="btn" onClick={onClose}>Close</button>
      <button className="btn" onClick={simulateInstall}>Simulate Install</button>
    </>
  );

  return (
    <Modal open={open} onClose={onClose} title="Install Agent" footer={footer}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs opacity-70">Customer</label>
          <select
            className="input"
            value={selectedCustomer}
            onChange={e=>setSelectedCustomer(e.target.value)}
          >
            <option value="">Select a customer…</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs opacity-70">OS</label>
          <select
            className="input"
            value={selectedOS}
            onChange={e=>setSelectedOS(e.target.value)}
          >
            {OS_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs opacity-70">Hostname (optional)</label>
          <input
            className="input"
            placeholder="e.g., pm3"
            value={hostname}
            onChange={e=>setHostname(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="btn" onClick={generateCurl}>Generate curl command</button>
        {token && <span className="badge">{token.startsWith("enr_") ? "token issued" : "dev token"}</span>}
      </div>

      {curlCmd && (
        <div>
          <label className="text-xs opacity-70">Run on target machine</label>
          <pre className="mt-2 text-xs opacity-90 bg-black/30 rounded-lg p-3 overflow-auto">{curlCmd}</pre>
          <button className="btn" onClick={()=>navigator.clipboard.writeText(curlCmd)}>Copy</button>
          <p className="text-[11px] opacity-60 mt-2">
            The <code>--api</code> flag includes <code>/api</code> so the agent talks to the right endpoints.
          </p>
        </div>
      )}
    </Modal>
  );
}
