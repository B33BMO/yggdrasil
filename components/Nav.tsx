"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";


export default function Nav() {
const p = usePathname();
const active = (href: string) => (p?.startsWith(href) ? { "data-active": true } : {});
return (
<nav className="sticky top-0 z-50 glass mx-4 mt-4 mb-6 p-3">
<div className="max-w-7xl mx-auto flex items-center gap-3">
<Link href="/" className="text-lg font-semibold">⚙️ CMMC Control Plane</Link>
<div className="flex gap-2 text-sm">
<Link className="tab" href="/customers" {...active("/customers")}>Customers</Link>
<Link className="tab" href="/policies" {...active("/policies")}>Policies</Link>
<Link className="tab" href="/devices" {...active("/devices")}>Devices</Link>
<Link className="tab" href="/install" {...active("/install")}>Installer</Link>
</div>
<div className="ml-auto flex items-center gap-2 text-sm">
<span className="badge">LDAP</span>
<form action="/api/auth/logout" method="post"><button className="btn" type="submit">Logout</button></form>
</div>
</div>
</nav>
);
}