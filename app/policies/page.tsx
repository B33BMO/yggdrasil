"use client";

import { useEffect, useMemo, useState } from "react";
import type { Policy } from "@/lib/types";
import Modal from "@/components/Modal";

type Form = {
  name: string;
  description: string;
  pkg: string;
  argsJson: string;
  bash: string;
  tab: "pkg" | "bash";
};

export default function PoliciesPage() {
  const [items, setItems] = useState<Policy[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>({
    name: "",
    description: "",
    pkg: "",
    argsJson: '{\n  "state": "present"\n}',
    bash: "",
    tab: "pkg",
  });

  async function load() {
    const r = await fetch("/api/policies", { cache: "no-store" });
    setItems(await r.json());
  }
  useEffect(() => { load(); }, []);

  function resetForm() {
    setForm({ name: "", description: "", pkg: "", argsJson: '{\n  "state": "present"\n}', bash: "", tab: "pkg" });
  }

  async function create() {
    let args: any = {};
    if (form.argsJson.trim()) {
      try { args = JSON.parse(form.argsJson); }
      catch { alert("Arguments must be valid JSON."); return; }
    }
    const body = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      packageName: form.pkg.trim() || undefined,
      args,
      bash: form.bash.trim() || undefined,
    };
    if (!body.name) return;
    const r = await fetch("/api/policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) { resetForm(); setOpen(false); load(); }
  }

  async function remove(id: string) {
    await fetch(`/api/policies/${id}`, { method: "POST" });
    load();
  }

  const previewYaml = useMemo(() => {
    // Client-side preview mirrors server toYamlFromPolicy()
    const rules: string[] = [];
    if (form.pkg.trim()) {
      // show args as YAML-ish shape
      const extra = (() => {
        try {
          const a = JSON.parse(form.argsJson || "{}");
          return Object.entries(a).map(([k, v]) => `    ${k}: ${typeof v === "string" ? JSON.stringify(v) : String(v)}`).join("\n");
        } catch { return ""; }
      })();
      rules.push(
`  - id: preview-pkg
    type: pkg.ensure
    name: ${form.pkg.trim()}
${extra ? extra + "\n" : ""}`.trimEnd()
      );
    }
    if (form.bash.trim()) {
      const code = ("      " + form.bash.trim().replace(/\n/g, "\n      "));
      rules.push(
`  - id: preview-bash
    type: bash
    code: |
${code}`
      );
    }
    const header =
`policy:
  id: preview
  name: ${form.name || "New Policy"}
  version: 1

rules:
`;
    return header + (rules.length ? rules.join("\n") + "\n" : "");
  }, [form]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Policies</h1>
          <span className="badge">{items.length}</span>
        </div>
        <button className="btn" onClick={()=>setOpen(true)}>Create Policy</button>
      </div>

      {/* List */}
      <div className="card">
        {items.length === 0 ? (
          <div className="p-10 text-center opacity-70">No policies yet. Create your first one.</div>
        ) : (
          <ul className="divide-y divide-white/10">
            {items.map(p => (
              <li key={p.id} className="py-4 flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="font-medium">
                    {p.name} <span className="badge">v{p.version ?? 1}</span>
                  </div>
                  <div className="text-xs opacity-70">{p.description || "—"}</div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {p.packageName && <span className="badge">pkg: {p.packageName}</span>}
                    {p.args && Object.keys(p.args).length > 0 && <span className="badge">args</span>}
                    {p.bash && <span className="badge">bash</span>}
                  </div>
                  {p.args && Object.keys(p.args).length > 0 && (
                    <pre className="mt-2 text-xs opacity-80 bg-black/30 rounded-lg p-3 overflow-auto">
                      {JSON.stringify(p.args, null, 2)}
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
        )}
      </div>

      {/* Creator */}
      <Modal
        open={open}
        onClose={()=>setOpen(false)}
        title="Create Policy"
        footer={
          <>
            <button className="btn" onClick={()=>setOpen(false)}>Cancel</button>
            <button className="btn" onClick={create}>Create</button>
          </>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Form */}
          <div className="space-y-3">
            <input
              className="input"
              placeholder="Policy Name"
              value={form.name}
              onChange={e=>setForm(f=>({...f, name: e.target.value}))}
              autoFocus
            />
            <input
              className="input"
              placeholder="Description (optional)"
              value={form.description}
              onChange={e=>setForm(f=>({...f, description: e.target.value}))}
            />

            <div className="flex gap-2 text-xs">
              <button
                className={`badge ${form.tab==="pkg" ? "bg-white/25" : "bg-white/10"}`}
                onClick={()=>setForm(f=>({...f, tab:"pkg"}))}
              >Package</button>
              <button
                className={`badge ${form.tab==="bash" ? "bg-white/25" : "bg-white/10"}`}
                onClick={()=>setForm(f=>({...f, tab:"bash"}))}
              >Bash</button>
            </div>

            {form.tab === "pkg" ? (
              <>
                <input
                  className="input"
                  placeholder="Package/App (e.g., ufw, auditd, openssh)"
                  value={form.pkg}
                  onChange={e=>setForm(f=>({...f, pkg: e.target.value}))}
                />
                <textarea
                  className="input h-32"
                  value={form.argsJson}
                  onChange={e=>setForm(f=>({...f, argsJson: e.target.value}))}
                />
                <p className="text-[11px] opacity-60">
                  Arguments are JSON. Example: {`{ "state": "present" }`}
                </p>
              </>
            ) : (
              <>
                <textarea
                  className="input h-40"
                  placeholder="#!/usr/bin/env bash"
                  value={form.bash}
                  onChange={e=>setForm(f=>({...f, bash: e.target.value}))}
                />
                <p className="text-[11px] opacity-60">
                  This runs on the device. Keep it idempotent where possible.
                </p>
              </>
            )}
          </div>

          {/* YAML preview */}
          <div>
            <label className="text-xs opacity-70">YAML preview (what agents will execute)</label>
            <pre className="mt-2 text-xs opacity-90 bg-black/30 rounded-lg p-3 h-72 overflow-auto">
{previewYaml}
            </pre>
          </div>
        </div>
      </Modal>
    </div>
  );
}
