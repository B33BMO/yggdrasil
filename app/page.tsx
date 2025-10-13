import { Stats } from "@/lib/types";

async function getStats(): Promise<Stats> {
  const r = await fetch("http://localhost:3000/api/stats", { cache: "no-store" });
  return r.json();
}

export default async function Dashboard() {
  const s = await getStats();

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="card">
        <div className="text-sm opacity-70">Total Devices</div>
        <div className="text-4xl font-semibold mt-2">{s.totalDevices}</div>
      </div>
      <div className="card">
        <div className="text-sm opacity-70">Active (24h)</div>
        <div className="text-4xl font-semibold mt-2">{s.active24h}</div>
      </div>
      <div className="card">
        <div className="text-sm opacity-70">Customers</div>
        <div className="text-4xl font-semibold mt-2">{s.customers}</div>
      </div>
      <div className="card">
        <div className="text-sm opacity-70">Policies</div>
        <div className="text-4xl font-semibold mt-2">{s.policies}</div>
      </div>
    </div>
  );
}
