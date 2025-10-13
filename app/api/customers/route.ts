import { NextResponse } from "next/server";
import { db } from "../_store";

export async function GET() {
  return NextResponse.json(db.customers.slice().reverse());
}

export async function POST(req: Request) {
  const { name } = await req.json();
  const id = `cus_${Math.random().toString(36).slice(2,8)}`;
  db.customers.push({ id, name, policyIds: [] });
  return NextResponse.json(db.customers.at(-1), { status: 201 });
}
