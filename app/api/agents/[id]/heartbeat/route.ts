import { NextResponse } from "next/server";
import { db } from "../../../_store";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const agentId = Number(params.id);
  const deviceId = db.agentMap.get(agentId);
  if (deviceId) {
    const d = db.devices.find(x => x.id === deviceId);
    if (d) d.lastSeen = new Date().toISOString();
  }
  return NextResponse.json({ ok: true });
}
