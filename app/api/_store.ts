import { Policy, Customer, Device } from "@/lib/types";

let policies: Policy[] = [
  { id: "pol-ssh", name: "SSH Baseline", version: 1, description: "Disable root, set ciphers", pkg: "openssh-server",
    args: { PermitRootLogin: "no" }, bash: "systemctl restart sshd" },
  { id: "pol-ufw", name: "UFW Enable", version: 1, description: "Enable firewall + allow 22/tcp", pkg: "ufw",
    args: { allow: ["22/tcp"], state: "enabled" } }
];

let customers: Customer[] = [
  { id: "cus-cap", name: "Capstone Research", policyIds: ["pol-ssh"] },
  { id: "cus-cyb", name: "Cyburity Internal", policyIds: ["pol-ssh","pol-ufw"] }
];

let devices: Device[] = [
  { id: "dev-1", hostname: "pm1", distro: "ubuntu-22.04", agentVersion: "0.1.0", customerId: "cus-cyb", policyIds: ["pol-ssh","pol-ufw"], lastSeen: new Date().toISOString() },
  { id: "dev-2", hostname: "nas1", distro: "rocky-9.3", agentVersion: "0.1.0", customerId: "cus-cap", policyIds: ["pol-ssh"], lastSeen: new Date(Date.now()-3600e3).toISOString() },
];

type TokenRec = { token: string; customerId: string; os?: string; used?: boolean; createdAt: number };
const tokenIndex = new Map<string, TokenRec>();

// Map a numeric agent id (what the agent uses) to an actual device id in db.devices
let agentCounter = 1000;
const agentMap = new Map<number, string>(); // agentId -> device.id

export const db = { policies, customers, devices, tokenIndex, agentMap, bumpAgentId: () => ++agentCounter };
