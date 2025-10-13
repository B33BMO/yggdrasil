export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { db, save } from "../../_store";

// POST { "agentId": "1", "deviceId": "dev_9a2ek2" }
export async function POST(req: Request) {
  const { agentId, deviceId } = await req.json().catch(() => ({}));
  if (!agentId || !deviceId) return NextResponse.json({ error: "agentId & deviceId required" }, { status: 400 });
  if (!db.devices.some(d => String(d.id) === String(deviceId))) {
    return NextResponse.json({ error: "device not found" }, { status: 404 });
  }
  db.agentMap[String(agentId)] = String(deviceId);
  save(true);
  return NextResponse.json({ ok: true });
}
