import { NextResponse } from "next/server";
import { db } from "../_store";

export async function GET() {
  const now = Date.now();
  const active24h = db.devices.filter(d => now - new Date(d.lastSeen).getTime() <= 24*3600e3).length;
  return NextResponse.json({
    totalDevices: db.devices.length,
    active24h,
    customers: db.customers.length,
    policies: db.policies.length
  });
}
