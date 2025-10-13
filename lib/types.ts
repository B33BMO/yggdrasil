export type Policy = {
  id: string;
  name: string;
  description?: string;
  version: number;
  args?: Record<string, any>;
  pkg?: string;       // NEW: package/app name
  bash?: string;      // NEW: optional bash snippet
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
