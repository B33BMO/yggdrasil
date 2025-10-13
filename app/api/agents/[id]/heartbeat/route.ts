import { NextResponse } from "next/server";
import { db } from "../../../_store";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> } // 👈 promise
) {
  const { id } = await ctx.params;          // 👈 await it
  const agentId = Number(id);
  const deviceId = db.agentMap.get(agentId);
  if (deviceId) {
    const d = db.devices.find(x => x.id === deviceId);
    if (d) d.lastSeen = new Date().toISOString();
  }
  return NextResponse.json({ ok: true });
}
