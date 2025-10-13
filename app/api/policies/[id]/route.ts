import { NextResponse } from "next/server";
import { db } from "../../_store";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  // support form-based delete with _method
  const { id } = params;
  db.policies = db.policies.filter(p => p.id !== id);
  // also remove policy from customers/devices
  db.customers.forEach(c => c.policyIds = c.policyIds.filter(x => x !== id));
  db.devices.forEach(d => d.policyIds = d.policyIds.filter(x => x !== id));
  return NextResponse.json({ ok: true });
}
