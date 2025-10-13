"use client";

import { useEffect, useMemo, useState } from "react";
import type { Customer, Policy, Device } from "@/lib/types";
import Modal from "@/components/Modal";
import AssignPoliciesModal from "@/components/AssignPoliciesModal";

export default function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [query, setQuery] = useState("");

  const [openCreate, setOpenCreate] = useState(false);
  const [name, setName] = useState("");

  const [assignOpen, setAssignOpen] = useState(false);
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);

  async function load() {
    const [c, p, d] = await Promise.all([
      fetch("/api/customers").then(r => r.json()),
      fetch("/api/policies").then(r => r.json()),
      fetch("/api/devices").then(r => r.json()),
    ]);
    setItems(c); setPolicies(p); setDevices(d);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    setName(""); setOpenCreate(false); load();
  }

  async function remove(id: string) {
    await fetch(`/api/customers/${id}`, { method: "DELETE" });
    load();
  }

  const polyn = useMemo(() => {
    const map = new Map(policies.map(p => [p.id, p.name]));
    return (id: string) => map.get(id) ?? id;
  }, [policies]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter(c => c.name.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Customers</h1>
          <span className="badge">{items.length}</span>
        </div>
        <div className="flex items-center gap-3">
          <input
            className="input w-72"
            placeholder="Search customers…"
            value={query}
            onChange={(e)=>setQuery(e.target.value)}
          />
          <button className="btn" onClick={()=>setOpenCreate(true)}>Add Customer</button>
        </div>
      </div>

      {/* List */}
      <div className="card">
        {filtered.length === 0 ? (
          <div className="p-10 text-center opacity-70">
            No customers match. Create one to get started.
          </div>
        ) : (
          <ul className="divide-y divide-white/10">
            {filtered.map(c => {
              const devs = devices.filter(d => d.customerId === c.id);
              const lastSeen = devs.length
                ? devs.map(d=>new Date(d.lastSeen).getTime()).sort((a,b)=>b-a)[0]
                : null;
              return (
                <li key={c.id} className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="font-medium text-base">{c.name}</div>
                        <span className="badge">{devs.length} devices</span>
                        {lastSeen && (
                          <span className="badge">active {new Date(lastSeen).toLocaleString()}</span>
                        )}
                      </div>

                      <div className="text-xs opacity-70">Assigned Policies</div>
                      <div className="flex flex-wrap gap-2">
                        {c.policyIds.length === 0 && <span className="badge">None</span>}
                        {c.policyIds.map(pid => (
                          <span key={pid} className="badge">{polyn(pid)}</span>
                        ))}
                      </div>

                      <div className="text-xs opacity-70 mt-2">Devices</div>
                      <div className="flex flex-wrap gap-2">
                        {devs.length === 0 && <span className="badge">None</span>}
                        {devs.map(d => <span key={d.id} className="badge">{d.hostname}</span>)}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                      <button
                        className="btn"
                        onClick={() => { setActiveCustomerId(c.id); setAssignOpen(true); }}
                      >
                        Assign Policies
                      </button>
                      <button className="btn" onClick={()=>remove(c.id)}>Delete</button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Create */}
      <Modal
        open={openCreate}
        onClose={()=>setOpenCreate(false)}
        title="Add Customer"
        footer={
          <>
            <button className="btn" onClick={()=>setOpenCreate(false)}>Cancel</button>
            <button className="btn" onClick={create}>Create</button>
          </>
        }
      >
        <input
          className="input"
          placeholder="Customer Name"
          value={name}
          onChange={(e)=>setName(e.target.value)}
          autoFocus
        />
      </Modal>

      {/* Assign */}
      <AssignPoliciesModal
        open={assignOpen}
        onClose={()=>setAssignOpen(false)}
        customerId={activeCustomerId}
        onSaved={load}
      />
    </div>
  );
}
