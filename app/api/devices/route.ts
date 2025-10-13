import { NextResponse } from "next/server";
import { db } from "../_store";


export async function POST(req: Request) {
  const body = await req.json();
  const id = `dev_${Math.random().toString(36).slice(2,8)}`;
  const customer = db.customers.find(c => c.id === body.customerId);
  const policyIds = customer ? [...customer.policyIds] : [];

  db.devices.push({
    id,
    hostname: body.hostname || id,
    distro: body.distro,                // e.g., "ubuntu-22.04"
    agentVersion: "0.1.0",
    customerId: body.customerId,
    policyIds,
    lastSeen: new Date().toISOString()
  });

  return NextResponse.json(db.devices.at(-1), { status: 201 });
}

export async function GET() {
  return NextResponse.json(db.devices.slice().reverse());
}
