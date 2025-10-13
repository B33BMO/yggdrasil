import { NextResponse } from "next/server";
import { db } from "../../_store";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const customerId = body?.customerId || db.customers[0]?.id || "";
  const os = body?.os as string | undefined;

  const token = `enr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;
  db.tokenIndex.set(token, { token, customerId, os, used: false, createdAt: Date.now() });

  return NextResponse.json({ token, customerId, os }, { status: 201 });
}
