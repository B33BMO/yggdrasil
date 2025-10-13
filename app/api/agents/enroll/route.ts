import { NextResponse } from "next/server";
import { db } from "../../_store";

// For MVP, accept: ?hostname=&distro=&token=
// In production, parse the token and look up embedded { customerId }.
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const hostname = searchParams.get("hostname") || "host";
  const distro = searchParams.get("distro") || "linux-unknown";
  const token = searchParams.get("token") || "";

  // --- Minimal token->customer mapping (MVP) ---
  // If you issued tokens from the Install modal, encode customer id in token or keep a map.
  // For now, pick the first customer if we can't resolve from token.
  const customerId =
    db.customers[0]?.id ||
    "";

  // Create device if not exists
  const id = `dev_${Math.random().toString(36).slice(2,8)}`;
  const policyIds = db.customers.find(c => c.id === customerId)?.policyIds ?? [];

  db.devices.push({
    id,
    hostname,
    distro,
    agentVersion: "0.1.0",
    customerId,
    policyIds,
    lastSeen: new Date().toISOString(),
  });

  // Return an integer-ish id for simplicity
  const numericId = db.devices.length; // fake id
  const deviceJwt = `dev_${numericId}_demo`;

  return NextResponse.json({ agent_id: numericId, device_jwt: deviceJwt, device_id: id });
}
