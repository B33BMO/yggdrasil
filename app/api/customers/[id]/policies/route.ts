import { NextResponse } from "next/server";
import { db } from "../../../_store";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> } // 👈 params is a Promise in newer Next
) {
  const { id } = await ctx.params;          // 👈 await it
  const { policyId, action } = await req.json();

  const customer = db.customers.find(c => c.id === id);
  if (!customer) {
    return NextResponse.json({ error: "customer not found" }, { status: 404 });
  }

  const set = new Set(customer.policyIds ?? []);
  if (action === "add") set.add(policyId);
  if (action === "remove") set.delete(policyId);
  customer.policyIds = Array.from(set);

  // Optional: keep existing devices under this customer in sync with customer policy set
  db.devices
    .filter(d => d.customerId === id)
    .forEach(d => { d.policyIds = [...customer.policyIds]; });

  return NextResponse.json({ ok: true, policyIds: customer.policyIds });
}
