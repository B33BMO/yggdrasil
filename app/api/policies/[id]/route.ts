import { NextResponse } from "next/server";
import { db } from "../../_store";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  db.policies = db.policies.filter(p => p.id !== id);
  // also remove policy from customers/devices
  db.customers.forEach(c => c.policyIds = c.policyIds.filter(x => x !== id));
  db.devices.forEach(d => d.policyIds = d.policyIds.filter(x => x !== id));
  return NextResponse.json({ ok: true });
}
