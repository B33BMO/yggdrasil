"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/Modal";
import type { Policy } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  customerId: string | null;
  onSaved?: (newIds: string[]) => void;
};

export default function AssignPoliciesModal({ open, onClose, customerId, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [allPolicies, setAllPolicies] = useState<Policy[]>([]);
  const [initialIds, setInitialIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  // reset on open
  useEffect(() => {
    if (open) { setQ(""); setErr(null); }
  }, [open]);

  // fetch on open + customer change
  useEffect(() => {
    if (!open || !customerId) return;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/customers/${customerId}/policies`);
        if (!res.ok) throw new Error(`load failed: ${res.status}`);
        const data = await res.json();
        const available: Policy[] = data.available ?? [];
        const assigned: string[] = data.policyIds ?? [];
        setAllPolicies(available);
        setInitialIds(assigned);
        setSelected(assigned);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, customerId]);

  const idSet = useMemo(() => new Set(allPolicies.map(p => p.id)), [allPolicies]);

  const filtered = useMemo(
    () =>
      allPolicies.filter(p =>
        (p.name + " " + p.id).toLowerCase().includes(q.toLowerCase())
      ),
    [allPolicies, q]
  );

  function toggle(id: string) {
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }

  function selectAllVisible() {
    const ids = new Set(selected);
    filtered.forEach(p => ids.add(p.id));
    setSelected([...ids]);
  }

  function clearAll() {
    setSelected([]);
  }

  const changed = useMemo(() => {
    if (initialIds.length !== selected.length) return true;
    const a = new Set(initialIds);
    return selected.some(id => !a.has(id));
  }, [initialIds, selected]);

  async function save() {
    if (!customerId) return;
    setLoading(true);
    setErr(null);
    try {
      // only send valid policy IDs
      const valid = selected.filter(id => idSet.has(id));
      const res = await fetch(`/api/customers/${customerId}/policies`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyIds: valid })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `save failed: ${res.status}`);
      onSaved?.(data.policyIds ?? valid);
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign Policies"
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn" onClick={save} disabled={loading || !changed}>
            {loading ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      {!customerId ? (
        <div className="text-sm opacity-60">Pick a customer first…</div>
      ) : (
        <div className="space-y-3">
          {err && <div className="text-xs text-red-300 bg-red-900/30 rounded-md p-2">{err}</div>}

          <div className="flex items-center gap-2">
            <input
              className="input w-full"
              placeholder="Search policies…"
              value={q}
              onChange={(e)=>setQ(e.target.value)}
            />
            <button className="btn" onClick={selectAllVisible} disabled={loading || filtered.length === 0}>
              Select all
            </button>
            <button className="btn" onClick={clearAll} disabled={loading || selected.length === 0}>
              Clear
            </button>
          </div>

          {loading ? (
            <div className="text-sm opacity-60">Loading…</div>
          ) : (
            <div className="max-h-80 overflow-auto space-y-2">
              {filtered.map(p => (
                <label key={p.id} className="flex items-start gap-3 p-2 rounded-lg bg-white/5 ring-1 ring-white/10">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected.includes(p.id)}
                    onChange={()=>toggle(p.id)}
                  />
                  <div>
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-[11px] opacity-60">{p.id}</div>
                    {p.description && <div className="text-xs opacity-80 mt-1">{p.description}</div>}
                  </div>
                </label>
              ))}
              {filtered.length === 0 && !loading && (
                <div className="text-sm opacity-60">No policies match.</div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
