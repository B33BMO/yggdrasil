import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authSession } from "@/lib/auth";
import { ldapAuthenticate } from "@/lib/ldap";


const Body = z.object({ username: z.string().min(1), password: z.string().min(1) });


export async function POST(req: NextRequest) {
try {
const json = await req.json();
const { username, password } = Body.parse(json);


const user = await ldapAuthenticate(username, password);
if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });


const res = NextResponse.json({ ok: true });
await authSession.saveUser(res, {
username: user.uid ?? username,
displayName: user.cn ?? username,
groups: user.memberOf ?? [],
});
return res;
} catch (e: any) {
return NextResponse.json({ error: e?.message ?? "Bad Request" }, { status: 400 });
}
}