export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { db } from "../../../_store";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  // if caller uses a device id, accept it; otherwise resolve agent -> device
  const deviceId =
    id.startsWith("dev_")
      ? id
      : (db.agentMap[id] ?? db.agentMap[Number(id) as any] ?? id);

  const dev = db.devices.find(d => String(d.id) === String(deviceId));
  if (!dev) {
    return new NextResponse(JSON.stringify({ agent_id: id, policies: [], rev: 0 }), {
      status: 200, headers: { "Content-Type": "application/json", ETag: 'W/"rev-0"' }
    });
  }

  const rev = dev.policyRev ?? (dev.customerId ? (db.customers.find(c => c.id === dev.customerId)?.policyRev ?? 0) : 0);
  const etag = `W/"rev-${rev}"`;
  const inm = req.headers.get("if-none-match");
  if (inm && inm === etag) return new NextResponse(null, { status: 304, headers: { ETag: etag } });

  const pols = dev.policyIds
    .map(pid => db.policies.find(p => p.id === pid))
    .filter(Boolean)
    .map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      yaml: toYamlFromPolicy(p),
      packageName: p.packageName,
      args: p.args,
      bash: p.bash,
    }));

  return new NextResponse(JSON.stringify({ agent_id: id, policies: pols, rev }), {
    status: 200, headers: { "Content-Type": "application/json", ETag: etag }
  });
}

function toYamlFromPolicy(p: any): string {
  const rules: string[] = [];

  if (p.packageName) {
    const extra = p.args && typeof p.args === "object"
      ? Object.entries(p.args).map(([k, v]) => `    ${k}: ${jsonScalar(v)}`).join("\n")
      : "";
    rules.push(
`  - id: ${p.id}-pkg
    type: pkg.ensure
    name: ${p.packageName}
${extra ? extra + "\n" : ""}`.trimEnd()
    );
  }

  if (typeof p.bash === "string" && p.bash.trim()) {
    const code = indentBlock(p.bash, 6);
    rules.push(
`  - id: ${p.id}-bash
    type: bash
    code: |
${code}`
    );
  }

  const header =
`policy:
  id: ${p.id}
  name: ${p.name}
  version: ${p.version ?? 1}

rules:
`;
  return header + (rules.length ? rules.join("\n") + "\n" : "");
}

function jsonScalar(v: unknown): string {
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v ?? null);
}
function indentBlock(text: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return text.replace(/\r?\n/g, "\n" + pad).replace(/^/, pad);
}
