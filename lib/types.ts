export type Policy = {
  id: string;
  name: string;
  description?: string;
  version?: number;

  // New (all optional):
  packageName?: string;               // e.g., "ufw"
  args?: Record<string, unknown>;     // arbitrary JSON for the plugin
  bash?: string;                      // optional bash snippet
};

export type Customer = {
  id: string;
  name: string;
  contact?: string;
  policyIds: string[];
};

export type Device = {
  id: string;
  hostname: string;
  customerId?: string;
  distro: string;
  agentVersion: string;
  policyIds: string[];
  lastSeen: string;
};

export type Stats = {
  totalDevices: number;
  active24h: number;
  customers: number;
  policies: number;
};
