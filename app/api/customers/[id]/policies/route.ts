import { NextResponse } from "next/server";
import { db } from "../../../_store";

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

  const set = new Set(customer.policyIds ?? []);
  if (action === "add") set.add(policyId);
  if (action === "remove") set.delete(policyId);
  customer.policyIds = Array.from(set);

  db.devices
    .filter(d => d.customerId === id)
    .forEach(d => { d.policyIds = [...customer.policyIds]; });

  return NextResponse.json({ ok: true, policyIds: customer.policyIds });
}
