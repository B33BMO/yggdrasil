"use client";

import { useEffect, useState } from "react";
import type { Policy } from "@/lib/types";
import Modal from "@/components/Modal";

export default function PoliciesPage() {
  const [items, setItems] = useState<Policy[]>([]);
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    pkg: "",
    argsJson: "{\n  \"state\": \"present\"\n}",
    bash: ""
  });

  async function load() {
    const r = await fetch("/api/policies", { cache: "no-store" });
    setItems(await r.json());
  }
  useEffect(() => { load(); }, []);

  function resetForm() {
    setForm({ name: "", description: "", pkg: "", argsJson: "{\n  \"state\": \"present\"\n}", bash: "" });
  }

  async function create() {
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        pkg: form.pkg.trim() || undefined,
        args: form.argsJson ? JSON.parse(form.argsJson) : {},
        bash: form.bash.trim() || undefined
      };
      if (!body.name) return;
      const r = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (r.ok) { resetForm(); setOpen(false); load(); }
    } catch (e) {
      alert("Invalid JSON in Arguments.");
    }
  }

  async function remove(id: string) {
    await fetch(`/api/policies/${id}`, { method: "POST" });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Policies</h1>
        <button className="btn" onClick={()=>setOpen(true)}>Add Policy</button>
      </div>

      <div className="card">
        <ul className="divide-y divide-white/10">
          {items.map(p=>(
            <li key={p.id} className="py-4 flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="font-medium">{p.name} <span className="badge">v{p.version}</span></div>
                <div className="text-xs opacity-70">{p.description || "—"}</div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {p.pkg && <span className="badge">pkg: {p.pkg}</span>}
                  {p.args && <span className="badge">args</span>}
                  {p.bash && <span className="badge">bash</span>}
                </div>
                {p.args && (
                  <pre className="mt-2 text-xs opacity-80 bg-black/30 rounded-lg p-3 overflow-auto">
                    {JSON.stringify(p.args,null,2)}
                  </pre>
                )}
                {p.bash && (
                  <details className="mt-2">
                    <summary className="text-xs opacity-80 cursor-pointer">Show bash</summary>
                    <pre className="mt-2 text-xs opacity-80 bg-black/30 rounded-lg p-3 overflow-auto">{p.bash}</pre>
                  </details>
                )}
              </div>
              <button className="btn" onClick={()=>remove(p.id)}>Delete</button>
            </li>
          ))}
        </ul>
      </div>

      <Modal open={open} onClose={()=>setOpen(false)} title="Create Policy"
        footer={
          <>
            <button className="btn" onClick={()=>setOpen(false)}>Cancel</button>
            <button className="btn" onClick={create}>Create</button>
          </>
        }>
        <input className="input" placeholder="Policy Name" value={form.name}
               onChange={e=>setForm(f=>({...f,name:e.target.value}))} autoFocus />
        <input className="input" placeholder="Description (optional)" value={form.description}
               onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs opacity-70">Package/App (optional)</label>
            <input className="input" placeholder="e.g., ufw, auditd, openssh" value={form.pkg}
                   onChange={e=>setForm(f=>({...f,pkg:e.target.value}))} />
          </div>
          <div>
            <label className="text-xs opacity-70">Arguments (JSON)</label>
            <textarea className="input h-32" value={form.argsJson}
                      onChange={e=>setForm(f=>({...f,argsJson:e.target.value}))}/>
          </div>
        </div>
        <div>
          <label className="text-xs opacity-70">Bash (runs on device, optional)</label>
          <textarea className="input h-32" placeholder="#!/usr/bin/env bash"
                    value={form.bash} onChange={e=>setForm(f=>({...f,bash:e.target.value}))}/>
          <p className="text-[11px] opacity-60 mt-1">
            Tip: leave empty if policy only uses package/args. The agent can run this as a step.
          </p>
        </div>
      </Modal>
    </div>
  );
}
