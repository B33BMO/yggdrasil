"use client";

import { useEffect, useMemo, useState } from "react";
import type { Customer, Device, Policy } from "@/lib/types";
import Modal from "@/components/Modal";

const OS_OPTIONS = [
  { id: "ubuntu-22.04", label: "Ubuntu 22.04" },
  { id: "ubuntu-24.04", label: "Ubuntu 24.04" },
  { id: "rocky-9.3",   label: "Rocky Linux 9.3" },
  { id: "debian-12",   label: "Debian 12" },
  { id: "arch",        label: "Arch" },
];

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);

  const [query, setQuery] = useState("");
  const [customerFilter, setCustomerFilter] = useState<string>("all");

  // modal state
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

  const customerName = (id?: string) =>
    customers.find(c=>c.id===id)?.name ?? "Unassigned";

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return devices
      .filter(d => (d.hostname + " " + (customerName(d.customerId))).toLowerCase().includes(q))
      .filter(d => customerFilter === "all" ? true : d.customerId === customerFilter);
  }, [devices, query, customerFilter]);

  function apiBase() {
    if (typeof window !== "undefined") return `${window.location.origin}/api`;
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://10.0.203.182:3000";
    return `${base.replace(/\/$/, "")}/api`;
  }

  async function generateCurl() {
    if (!selectedCustomer) return;
    let issuedToken = "";
    try {
      const res = await fetch("/api/enroll/token", { method: "POST" });
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
        distro: selectedOS,
      }),
    });
    setOpen(false); setHostname(""); setToken(""); setCurlCmd("");
    load();
  }

  const onlineBadge = (d: Device) => {
    const last = new Date(d.lastSeen).getTime();
    const mins = (Date.now() - last) / 60000;
    const label = mins < 5 ? "Online" : mins < 60 ? "Idle" : "Stale";
    return <span className="badge">{label}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header / toolbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Devices</h1>
          <span className="badge">{devices.length}</span>
        </div>
        <div className="flex items-center gap-3">
          <select className="input"
                  value={customerFilter}
                  onChange={e=>setCustomerFilter(e.target.value)}>
            <option value="all">All customers</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input
            className="input w-72"
            placeholder="Search by hostname or customer…"
            value={query}
            onChange={e=>setQuery(e.target.value)}
          />
          <button className="btn" onClick={()=>setOpen(true)}>+</button>
        </div>
      </div>

      {/* Grid */}
      <div className="card">
        {filtered.length === 0 ? (
          <div className="p-10 text-center opacity-70">No devices yet.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map(d => (
              <div key={d.id} className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{d.hostname}</div>
                  <div className="flex items-center gap-2">
                    <span className="badge">{customerName(d.customerId)}</span>
                    {onlineBadge(d)}
                  </div>
                </div>
                <div className="text-xs opacity-70">
                  {d.distro} · agent {d.agentVersion} · last seen {new Date(d.lastSeen).toLocaleString()}
                </div>
                <div className="text-xs opacity-70">Policies</div>
                <div className="flex flex-wrap gap-2">
                  {d.policyIds.length === 0 && <span className="badge">None</span>}
                  {d.policyIds.map(pid => (
                    <span key={pid} className="badge">
                      {policies.find(x => x.id === pid)?.name ?? pid}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Install modal */}
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
          <div className="md:col-span-2">
            <label className="text-xs opacity-70">Hostname (optional)</label>
            <input className="input" placeholder="e.g., pm3"
                   value={hostname} onChange={e=>setHostname(e.target.value)} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn" onClick={generateCurl}>Generate curl command</button>
          {token && <span className="badge">token issued</span>}
        </div>

        {curlCmd && (
          <div>
            <label className="text-xs opacity-70">Run on target machine</label>
            <pre className="mt-2 text-xs opacity-90 bg-black/30 rounded-lg p-3 overflow-auto">{curlCmd}</pre>
            <button className="btn" onClick={()=>navigator.clipboard.writeText(curlCmd)}>Copy</button>
          </div>
        )}

        <p className="text-[11px] opacity-60">
          “Simulate Install” creates a device record and inherits the customer’s policies. Real agents enroll and appear automatically.
        </p>
      </Modal>
    </div>
  );
}
