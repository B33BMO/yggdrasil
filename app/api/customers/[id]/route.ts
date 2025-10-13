import { NextResponse } from "next/server";
import { db } from "../../_store";

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  db.customers = db.customers.filter(c => c.id !== id);
  // unassign from devices
  db.devices.forEach(d => { if (d.customerId === id) d.customerId = undefined; });
  return NextResponse.json({ ok: true });
}
