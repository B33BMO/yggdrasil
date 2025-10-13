// app/api/_store.ts
import fs from "fs";
import path from "path";

export type TokenInfo = {
  token: string;
  customerId?: string;
  os?: string;
  used: boolean;
  createdAt: number;
};

export type Customer = { id: string; name: string; policyIds: string[]; policyRev?: number };

export type Device = {
  id: string;
  hostname: string;
  customerId?: string;
  distro: string;
  agentVersion: string;
  lastSeen: string;
  policyIds: string[];
  policyRev?: number; // server-side “last applied” rev (optional)
};

export type Policy = { id: string; name: string; description?: string; version?: number };

type DB = {
  customers: Customer[];
  devices: Device[];
  policies: Policy[];
  agentMap: Record<string | number, string>;
  seq: { device: number; agent: number };
  tokens: Record<string, TokenInfo>;
  lastResults?: Record<string, any>; // <--- add this
};

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const TMP_FILE = DB_FILE + ".tmp";

function seedPolicies(): Policy[] {
  return [
    { id: "pol-ufw-enable", name: "UFW Enable" },
    { id: "pol-ssh-baseline", name: "SSH Baseline" },
  ];
}
function defaultDb(): DB {
  return {
    customers: [],
    devices: [],
    policies: seedPolicies(),
    agentMap: {},
    seq: { device: 1, agent: 1 },
    tokens: {},
    lastResults: {},
  };
}

function load(): DB {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const fresh = defaultDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(fresh, null, 2));
    return fresh;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8")) as Partial<DB>;
    const base = defaultDb();
    const db: DB = {
      ...base,
      ...parsed,
      customers: (parsed.customers ?? base.customers).map(c => ({
        ...c,
        policyRev: c.policyRev ?? 0,
        policyIds: c.policyIds ?? [],
      })),
      devices: (parsed.devices ?? base.devices).map(d => ({
        ...d,
        policyRev: d.policyRev ?? 0,
        policyIds: d.policyIds ?? [],
      })),
      policies: parsed.policies ?? base.policies,
      agentMap: parsed.agentMap ?? base.agentMap,
      seq: parsed.seq ?? base.seq,
      tokens: parsed.tokens ?? base.tokens,
    };
    return db;
  } catch (e) {
    console.error("[store] read failed, starting fresh:", e);
    const fresh = defaultDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(fresh, null, 2));
    return fresh;
  }
}

export const db: DB = load();

let timer: NodeJS.Timeout | null = null;
function writeNow() {
  try {
    fs.writeFileSync(TMP_FILE, JSON.stringify(db, null, 2));
    fs.renameSync(TMP_FILE, DB_FILE);
  } catch (e) {
    console.error("[store] write error:", e);
  }
}
export function save(immediate = false) {
  if (immediate) { if (timer) clearTimeout(timer); timer = null; writeNow(); return; }
  if (timer) clearTimeout(timer);
  timer = setTimeout(writeNow, 150);
}

export function nextDeviceId(): number { const v = db.seq.device++; save(); return v; }
export function nextAgentId(): number { const v = db.seq.agent++; save(); return v; }
