import { NextResponse } from "next/server";
import { db } from "../../_store";

export async function POST(req: Request) {
  const body = await req.json();
  const agentId = Number(body?.agent_id ?? 0);
  const deviceId = db.agentMap.get(agentId);
  if (deviceId) {
    const d = db.devices.find(x => x.id === deviceId);
    if (d) d.lastSeen = new Date().toISOString();
  }
  // Optionally stash results for UI later
  return NextResponse.json({ ok: true });
}
