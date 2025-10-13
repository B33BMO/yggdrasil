import { NextResponse } from "next/server";
import { authSession } from "@/lib/auth";


export async function POST() {
const res = NextResponse.json({ ok: true });
await authSession.destroy(res);
return res;
}