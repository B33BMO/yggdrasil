export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { db, save, nextDeviceId, nextAgentId } from "../_store";

// POST /api/agents/enroll?token=...&hostname=...&distro=...
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") ?? "";
  const hostname = (searchParams.get("hostname") ?? "unknown").trim() || "unknown";
  const distro = (searchParams.get("distro") ?? "linux-unknown").trim() || "linux-unknown";

  // optional: resolve token → customer
  let customerId: string | undefined;
  const t = db.tokens?.[token];
  if (t && !t.used) {
    customerId = t.customerId;
    t.used = true;
  }

  // inherit customer policies
  const inherited = customerId
    ? (db.customers.find(c => c.id === customerId)?.policyIds ?? [])
    : [];

  // create device
  const deviceId = `dev_${Math.random().toString(36).slice(2,8)}`;
  db.devices.push({
    id: deviceId,
    hostname,
    distro,
    agentVersion: "0.2.0",
    customerId,
    policyIds: [...inherited],
    policyRev: customerId
      ? (db.customers.find(c => c.id === customerId)?.policyRev ?? 0)
      : 0,
    lastSeen: new Date().toISOString(),
  });

  // assign a fresh agent id and map it to the device
  const agentId = String(nextAgentId());
  db.agentMap[agentId] = deviceId;

  save(true);

  return NextResponse.json(
    { agent_id: Number(agentId), device_id: deviceId, device_jwt: undefined },
    { status: 201 }
  );
}
