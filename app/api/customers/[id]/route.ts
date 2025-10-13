import { NextResponse } from "next/server";
import { db } from "../../_store";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const exists = db.customers.some(c => c.id === id);
  if (!exists) {
    return NextResponse.json({ error: "customer not found" }, { status: 404 });
  }

  // remove the customer
  db.customers = db.customers.filter(c => c.id !== id);

  // unassign from devices and (optionally) drop inherited policies
  db.devices.forEach(d => {
    if (d.customerId === id) {
      d.customerId = undefined;
      d.policyIds = []; // remove if policies were inherited from customer
    }
  });

  // 204 = success, no body
  return new NextResponse(null, { status: 204 });
}
