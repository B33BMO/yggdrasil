export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { db, save } from "../../../_store";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const dev = db.devices.find(d => String(d.id) === String(id));
  if (dev) { dev.lastSeen = new Date().toISOString(); save(); }
  return NextResponse.json({ ok: true });
}
