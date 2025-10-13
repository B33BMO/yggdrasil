import { NextResponse } from "next/server";
import { db } from "../../../_store";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> } // 👈 important: params is a Promise
) {
  const { id } = await ctx.params;          // 👈 await it
  const agentId = Number(id);

  const deviceId = db.agentMap.get(agentId);
  if (!deviceId) return NextResponse.json({ agent_id: agentId, policies: [] });

  const dev = db.devices.find(d => d.id === deviceId);
  if (!dev) return NextResponse.json({ agent_id: agentId, policies: [] });

  const pols = dev.policyIds
    .map(pid => db.policies.find(p => p.id === pid))
    .filter(Boolean)
    .map(p => ({
      id: p!.id,
      name: p!.name,
      yaml: toYamlFromMock(p!)
    }));

  return NextResponse.json({ agent_id: agentId, policies: pols });
}

function toYamlFromMock(p: any): string {
  const rules: any[] = [];
  if (p.pkg) {
    rules.push({ id: `pkg-${p.pkg}`, type: "pkg.ensure", name: p.pkg, state: p.args?.state ?? "present" });
  }
  if (p.args?.PermitRootLogin !== undefined) {
    rules.push({
      id: "sshd-disable-root",
      type: "file.replace_kv",
      file: "/etc/ssh/sshd_config",
      key: "PermitRootLogin",
      value: String(p.args.PermitRootLogin)
    });
  }
  if (Array.isArray(p.args?.presentLines) && p.args.presentLines.length) {
    rules.push({ id: "ensure-lines", type: "file.ensure_lines", file: "/etc/some.conf", present: p.args.presentLines });
  }
  if (Array.isArray(p.args?.allow) && p.args.allow.length) {
    rules.push({ id: "ufw-allow", type: "bash", code: `ufw allow ${p.args.allow.join(" ")}` });
    rules.push({ id: "ufw-enable", type: "bash", code: "ufw --force enable" });
  }
  if (p.bash) rules.push({ id: "custom-bash", type: "bash", code: p.bash });

  const header = [
    "policy:",
    `  id: ${p.id}`,
    `  name: ${p.name}`,
    `  version: ${p.version ?? 1}`,
    "",
    "rules:",
  ];
  const body = rules.flatMap((r) => toYamlLines(r).map(l => `  - ${l}`));
  return [...header, ...body, ""].join("\n");
}

function toYamlLines(obj: Record<string, any>): string[] {
  const lines: string[] = [];
  const entries = Object.entries(obj);
  entries.forEach(([k, v], i) => {
    const key = i === 0 ? k : `    ${k}`;
    lines.push(`${key}: ${formatYaml(v)}`);
  });
  return lines;
}

function formatYaml(v: any): string {
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(formatYaml).join(", ")}]`;
  if (typeof v === "object" && v !== null) {
    const inner = Object.entries(v).map(([k, val]) => `${k}: ${formatYaml(val)}`).join(", ");
    return `{ ${inner} }`;
  }
  return String(v);
}
