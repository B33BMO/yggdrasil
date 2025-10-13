"use client";

import { useEffect, useState, useMemo } from "react";
import type { Customer, Policy, Device } from "@/lib/types";
import Modal from "@/components/Modal";
import AssignPoliciesModal from "@/components/AssignPoliciesModal";

export default function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);

  const [openCreate, setOpenCreate] = useState(false);
  const [name, setName] = useState("");

  // Assign Policies modal
  const [assignOpen, setAssignOpen] = useState(false);
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);

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
    setOpenCreate(false);
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/customers/${id}`, { method: "DELETE" });
    load();
  }

  const policyName = useMemo(() => {
    const map = new Map(policies.map(p => [p.id, p.name]));
    return (id: string) => map.get(id) ?? id;
  }, [policies]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Customers</h1>
        <button className="btn" onClick={() => setOpenCreate(true)}>Add Customer</button>
      </div>

      <div className="card">
        <ul className="divide-y divide-white/10">
          {items.map((c) => {
            const devs = devices.filter((d) => d.customerId === c.id);
            return (
              <li key={c.id} className="py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{c.name}</div>
                  <div className="flex items-center gap-2">
                    <button
                      className="btn"
                      onClick={() => { setActiveCustomerId(c.id); setAssignOpen(true); }}
                    >
                      Assign Policies
                    </button>
                    <button className="btn" onClick={() => remove(c.id)}>Delete</button>
                  </div>
                </div>

                <div className="text-xs opacity-70">Assigned Policies</div>
                <div className="flex flex-wrap gap-2">
                  {c.policyIds.length === 0 && <span className="badge">None</span>}
                  {c.policyIds.map(pid => (
                    <span key={pid} className="badge">{policyName(pid)}</span>
                  ))}
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

      {/* Add Customer modal */}
      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Add Customer"
        footer={
          <>
            <button className="btn" onClick={() => setOpenCreate(false)}>Cancel</button>
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

      {/* Assign Policies modal */}
      <AssignPoliciesModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        customerId={activeCustomerId}
        onSaved={async () => {
          await load(); // refresh customers & devices to reflect new assignments
        }}
      />
    </div>
  );
}
