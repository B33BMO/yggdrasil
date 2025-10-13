export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { db, save } from "../_store";

export async function GET() {
  return NextResponse.json(db.devices);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const hostname = (body.hostname ?? "unknown").trim() || "unknown";
  const distro = (body.distro ?? "linux-unknown").trim() || "linux-unknown";
  const customerId = body.customerId || undefined;

  const id = `dev_${Math.random().toString(36).slice(2,8)}`;
  const inherited = customerId
    ? (db.customers.find(c => c.id === customerId)?.policyIds ?? [])
    : [];

  db.devices.push({
    id,
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

  save(true);
  return NextResponse.json({ id }, { status: 201 });
}
