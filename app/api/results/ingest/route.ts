export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { db, save } from "../../_store";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const agentId = String(body?.agent_id ?? "");
  const deviceId =
    agentId.startsWith("dev_")
      ? agentId
      : (db.agentMap[agentId] ?? db.agentMap[Number(agentId) as any] ?? agentId);

  const dev = db.devices.find(d => String(d.id) === String(deviceId));
  if (dev) {
    dev.lastSeen = new Date().toISOString();
    save();
  }
  return NextResponse.json({ ok: true });
}
