export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { db, save, nextDeviceId, nextAgentId } from "../../_store";

// POST /api/agents/enroll?token=...&hostname=...&distro=...
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") ?? "";
  const hostname = searchParams.get("hostname") ?? "unknown";
  const distro = searchParams.get("distro") ?? "linux-unknown";

  // Optional: look up token → customer
  let customerId: string | undefined;
  const tinfo = db.tokens?.[token];
  if (tinfo && !tinfo.used) {
    customerId = tinfo.customerId;
    tinfo.used = true;
  }

  // Create device
  const idNum = nextDeviceId();
  const deviceId = String(idNum);
  const inherited = customerId
    ? (db.customers.find(c => c.id === customerId)?.policyIds ?? [])
    : [];

  db.devices.push({
    id: deviceId,
    hostname,
    customerId,
    distro,
    agentVersion: "0.2.0",
    lastSeen: new Date().toISOString(),
    policyIds: [...inherited],
    policyRev: customerId
      ? (db.customers.find(c => c.id === customerId)?.policyRev ?? 0)
      : 0,
  });

  // Issue an agent id and map it to the device
  const agentIdNum = nextAgentId();
  const agentId = String(agentIdNum);
  db.agentMap[agentId] = deviceId;

  save(true);

  return NextResponse.json({
    agent_id: agentIdNum,
    device_id: idNum,
    device_jwt: undefined, // placeholder if you add auth later
  }, { status: 201 });
}
