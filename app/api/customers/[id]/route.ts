export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { db, save } from "../../_store";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const c = db.customers.find(x => x.id === id);
  return c ? NextResponse.json(c) : NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const before = db.customers.length;
  db.customers = db.customers.filter(c => c.id !== id);
  db.devices.forEach(d => { if (d.customerId === id) { d.customerId = undefined; d.policyIds = []; } });
  if (db.customers.length !== before) save();
  return NextResponse.json({ ok: true });
}
