import { NextResponse } from "next/server";
import { db } from "../_store";

export async function GET() {
  return NextResponse.json(db.policies.slice().reverse());
}

export async function POST(req: Request) {
  const body = await req.json();
  const id = `pol_${Math.random().toString(36).slice(2,8)}`;
  db.policies.push({
    id,
    name: body.name,
    description: body.description,
    version: 1,
    args: body.args ?? {},
    pkg: body.pkg,
    bash: body.bash
  });
  return NextResponse.json(db.policies.at(-1), { status: 201 });
}
