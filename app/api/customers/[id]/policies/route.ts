import { NextResponse } from "next/server";
import { db } from "../../../_store";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const { policyId, action } = await req.json();
  const c = db.customers.find(x => x.id === id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (action === "add" && !c.policyIds.includes(policyId)) c.policyIds.push(policyId);
  if (action === "remove") c.policyIds = c.policyIds.filter(x => x !== policyId);
  return NextResponse.json({ ok: true });
}
