"use client";

import { useEffect, useState } from "react";
import type { Customer, Policy, Device } from "@/lib/types";
import Modal from "@/components/Modal";

export default function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  async function load() {
    const [c, p, d] = await Promise.all([
      fetch("/api/customers").then(r => r.json()),
      fetch("/api/policies").then(r => r.json()),
      fetch("/api/devices").then(r => r.json()),
    ]);
    setItems(c);
    setPolicies(p);
    setDevices(d);
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
    setName("");
    setOpen(false);
    load();
  }

  async function togglePolicy(c: Customer, policyId: string) {
    const assigned = c.policyIds.includes(policyId);
    await fetch(`/api/customers/${c.id}/policies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policyId, action: assigned ? "remove" : "add" }),
    });
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/customers/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Customers</h1>
        <button className="btn" onClick={() => setOpen(true)}>Add Customer</button>
      </div>

      <div className="card">
        <ul className="divide-y divide-white/10">
          {items.map((c) => {
            const devs = devices.filter((d) => d.customerId === c.id);
            return (
              <li key={c.id} className="py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{c.name}</div>
                  <button className="btn" onClick={() => remove(c.id)}>Delete</button>
                </div>

                <div className="text-xs opacity-70">Assigned Policies</div>
                <div className="flex flex-wrap gap-2">
                  {policies.map((p) => {
                    const on = c.policyIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        className={`badge ${on ? "bg-white/25" : "bg-white/10"} hover:bg-white/20`}
                        onClick={() => togglePolicy(c, p.id)}
                        title={on ? "Click to unassign" : "Click to assign"}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>

                <div className="text-xs opacity-70 mt-2">Devices ({devs.length})</div>
                <div className="flex flex-wrap gap-2">
                  {devs.length === 0 && <span className="badge">None</span>}
                  {devs.map((d) => (
                    <span key={d.id} className="badge">{d.hostname}</span>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add Customer"
        footer={
          <>
            <button className="btn" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn" onClick={create}>Create</button>
          </>
        }
      >
        <input
          className="input"
          placeholder="Customer Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </Modal>
    </div>
  );
}
