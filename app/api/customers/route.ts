export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { db, save } from "../_store";

export async function GET() {
  return NextResponse.json(db.customers);
}
export async function POST(req: Request) {
  const { name } = await req.json().catch(() => ({}));
  const trimmed = String(name || "").trim();
  if (!trimmed) return NextResponse.json({ error: "name required" }, { status: 400 });
  const id = "cus_" + Math.random().toString(36).slice(2, 8);
  const customer = { id, name: trimmed, policyIds: [] as string[] };
  db.customers.push(customer);
  save();
  return NextResponse.json(customer, { status: 201 });
}
