export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { db, save } from "../../../_store";

<<<<<<< HEAD
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const c = db.customers.find(x => x.id === id);
  if (!c) return NextResponse.json({ error: "customer not found" }, { status: 404 });
  return NextResponse.json({ policyIds: c.policyIds ?? [], available: db.policies });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const c = db.customers.find(x => x.id === id);
  if (!c) return NextResponse.json({ error: "customer not found" }, { status: 404 });
=======
// GET -> { policyIds: string[], available: Policy[] }
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const customer = db.customers.find(c => c.id === id);
  if (!customer) return NextResponse.json({ error: "customer not found" }, { status: 404 });

  return NextResponse.json({
    policyIds: customer.policyIds ?? [],
    available: db.policies, // to populate the modal list
  });
}

// PUT -> replace the customer's policyIds (idempotent)
// body: { policyIds: string[] }
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const incoming: string[] = Array.isArray(body?.policyIds) ? body.policyIds : [];

  const customer = db.customers.find(c => c.id === id);
  if (!customer) return NextResponse.json({ error: "customer not found" }, { status: 404 });

  // validate against known policies
  const validSet = new Set(db.policies.map(p => p.id));
  const filtered = incoming.filter(pid => validSet.has(pid));

  customer.policyIds = filtered;

  // propagate to devices of this customer (inheritance)
  db.devices
    .filter(d => d.customerId === id)
    .forEach(d => { d.policyIds = [...filtered]; });

  return NextResponse.json({ ok: true, policyIds: filtered });
}

// (optional) POST for granular add/remove if you want it too:
// body: { policyId: string, action: "add" | "remove" }
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const { policyId, action } = await req.json();

  const customer = db.customers.find(c => c.id === id);
  if (!customer) return NextResponse.json({ error: "customer not found" }, { status: 404 });

  const exists = db.policies.some(p => p.id === policyId);
  if (!exists) return NextResponse.json({ error: "unknown policy" }, { status: 400 });
>>>>>>> f114c6a90b0384478e9362af832b4bde5b3eea54

  const body = await req.json().catch(() => ({}));
  const incoming: string[] = Array.isArray(body?.policyIds) ? body.policyIds : [];
  const valid = new Set(db.policies.map(p => p.id));
  const filtered = incoming.filter(pid => valid.has(pid));

  c.policyIds = filtered;
  c.policyRev = (c.policyRev ?? 0) + 1;

  db.devices
    .filter(d => d.customerId === id)
    .forEach(d => { d.policyIds = [...filtered]; d.policyRev = c.policyRev; });

  save();
  return NextResponse.json({ ok: true, policyIds: filtered, rev: c.policyRev });
}

// Optional granular add/remove
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const c = db.customers.find(x => x.id === id);
  if (!c) return NextResponse.json({ error: "customer not found" }, { status: 404 });

  const { policyId, action } = await req.json().catch(() => ({}));
  if (!db.policies.some(p => p.id === policyId)) {
    return NextResponse.json({ error: "unknown policy" }, { status: 400 });
  }
  const set = new Set(c.policyIds ?? []);
  if (action === "add") set.add(policyId);
  if (action === "remove") set.delete(policyId);
  c.policyIds = Array.from(set);
  c.policyRev = (c.policyRev ?? 0) + 1;

  db.devices
    .filter(d => d.customerId === id)
    .forEach(d => { d.policyIds = [...c.policyIds]; d.policyRev = c.policyRev; });

  save();
  return NextResponse.json({ ok: true, policyIds: c.policyIds, rev: c.policyRev });
}
