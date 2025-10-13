"use client";

import { useEffect, useMemo, useState } from "react";
import type { Customer, Device, Policy } from "@/lib/types";
import Modal from "@/components/Modal";

const OS_OPTIONS = [
  { id: "ubuntu-22.04", label: "Ubuntu 22.04" },
  { id: "ubuntu-24.04", label: "Ubuntu 24.04" },
  { id: "rocky-9.3", label: "Rocky Linux 9.3" },
  { id: "debian-12", label: "Debian 12" },
  { id: "arch", label: "Arch" }
];

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [query, setQuery] = useState("");

  const [open, setOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [selectedOS, setSelectedOS] = useState<string>(OS_OPTIONS[0].id);
  const [hostname, setHostname] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [curlCmd, setCurlCmd] = useState<string>("");

  async function load() {
    const [d, c, p] = await Promise.all([
      fetch("/api/devices").then(r=>r.json()),
      fetch("/api/customers").then(r=>r.json()),
      fetch("/api/policies").then(r=>r.json()),
    ]);
    setDevices(d); setCustomers(c); setPolicies(p);
  }
  useEffect(() => { load(); }, []);

  // reset modal state on open
  useEffect(() => {
    if (open) {
      setSelectedCustomer("");
      setSelectedOS(OS_OPTIONS[0].id);
      setHostname("");
      setToken("");
      setCurlCmd("");
    }
  }, [open]);

  const filtered = useMemo(
    () => devices.filter(d => (d.hostname + " " + (d.customerId ?? "")).toLowerCase().includes(query.toLowerCase())),
    [devices, query]
  );

  const customerName = (id?: string) => customers.find(c=>c.id===id)?.name ?? "Unassigned";

  // Always include /api for agent endpoints
  function apiBase() {
    if (typeof window !== "undefined") return `${window.location.origin}/api`;
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
    return `${base.replace(/\/$/, "")}/api`;
  }

  async function generateCurl() {
    if (!selectedCustomer) return;

    // Try to issue a real token tied to customer + os; fall back to dev token if missing
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
    await fetch("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hostname: hostname || undefined,
        customerId: selectedCustomer,
        distro: selectedOS
      })
    });
    setOpen(false);
    setHostname("");
    setToken("");
    setCurlCmd("");
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Devices</h1>
        <div className="flex items-center gap-3">
          <input
            className="input max-w-md"
            placeholder="Search by hostname or customer…"
            value={query}
            onChange={e=>setQuery(e.target.value)}
          />
          <button className="btn" onClick={() => setOpen(true)}>Install Agent</button>
        </div>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(d=>(
            <div key={d.id} className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-medium">{d.hostname}</div>
                <div className="badge">{customerName(d.customerId)}</div>
              </div>
              <div className="text-xs opacity-70">
                {d.distro} · agent {d.agentVersion} · last seen {new Date(d.lastSeen).toLocaleString()}
              </div>
              <div className="text-xs opacity-70">Policies</div>
              <div className="flex flex-wrap gap-2">
                {d.policyIds.length === 0 && <span className="badge">None</span>}
                {d.policyIds.map(pid=>{
                  const p = policies.find(x=>x.id===pid);
                  return <span key={pid} className="badge">{p?.name ?? pid}</span>;
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal
        open={open}
        onClose={()=>setOpen(false)}
        title="Install Agent"
        footer={
          <>
            <button className="btn" onClick={()=>setOpen(false)}>Close</button>
            <button className="btn" onClick={simulateInstall}>Simulate Install</button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs opacity-70">Customer</label>
            <select className="input" value={selectedCustomer} onChange={e=>setSelectedCustomer(e.target.value)}>
              <option value="">Select a customer…</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs opacity-70">OS</label>
            <select className="input" value={selectedOS} onChange={e=>setSelectedOS(e.target.value)}>
              {OS_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs opacity-70">Hostname (optional)</label>
            <input className="input" placeholder="e.g., pm3" value={hostname} onChange={e=>setHostname(e.target.value)} />
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
              The <code>--api</code> parameter includes <code>/api</code> so the agent hits the correct endpoints.
            </p>
          </div>
        )}

        <p className="text-[11px] opacity-60">
          “Simulate Install” creates a device record and inherits the customer’s policies. In production, the real agent
          will enroll with the token and appear automatically.
        </p>
      </Modal>
    </div>
  );
}
