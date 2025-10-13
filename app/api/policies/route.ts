export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { db, save } from "../_store";

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}
function parseArgs(maybe: unknown): any {
  if (maybe == null) return {};
  if (typeof maybe === "object") return maybe as any;
  if (typeof maybe === "string") {
    const t = maybe.trim();
    if (!t) return {};
    try { return JSON.parse(t); } catch { return { args: t }; } // keep raw if not JSON
  }
  return {};
}

export async function GET() {
  return NextResponse.json(db.policies);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));

  const name: string | undefined =
    body?.name ??
    (body?.packageName ? `Install ${String(body.packageName)}` : undefined) ??
    (body?.bash ? "Custom Bash" : undefined);

  if (!name) {
    return NextResponse.json({ error: "name (or packageName/bash) required" }, { status: 400 });
  }

  // id: given or from name; auto-dedupe by suffixing -2, -3, ...
  let baseId = String(body?.id || "").trim() || `pol-${slugify(name)}`;
  let id = baseId;
  let n = 2;
  while (db.policies.some(p => p.id === id)) {
    id = `${baseId}-${n++}`;
  }

  const policy: any = {
    id,
    name,
    description: body?.description ?? "",
    packageName: body?.packageName || undefined,
    // Accept args as JSON object or JSON string; keep raw string under "args" if not JSON
    args: parseArgs(body?.args),
    bash: typeof body?.bash === "string" ? body.bash : undefined,
    version: 1,
  };

  db.policies.push(policy);
  save();
  return NextResponse.json(policy, { status: 201 });
}
