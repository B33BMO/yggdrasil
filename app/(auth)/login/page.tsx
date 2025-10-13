"use client";
import { useState } from "react";


export default function LoginPage() {
const [u, setU] = useState("");
const [p, setP] = useState("");
const [err, setErr] = useState<string | null>(null);


const submit = async (e: React.FormEvent) => {
e.preventDefault();
setErr(null);
const res = await fetch("/api/auth/login", { method: "POST", body: JSON.stringify({ username: u, password: p }) });
if (res.ok) {
window.location.href = "/";
} else {
const j = await res.json().catch(() => ({}));
setErr(j?.error ?? "Login failed");
}
};


return (
<div className="max-w-md mx-auto mt-20 glass p-6">
<h1 className="text-2xl font-semibold mb-4">Login</h1>
<form onSubmit={submit} className="space-y-3">
<div>
<label className="label">Username</label>
<input className="input" value={u} onChange={e=>setU(e.target.value)} placeholder="jdoe" />
</div>
<div>
<label className="label">Password</label>
<input className="input" type="password" value={p} onChange={e=>setP(e.target.value)} />
</div>
{err && <div className="text-red-400 text-sm">{err}</div>}
<button className="btn w-full" type="submit">Sign in with LDAP</button>
</form>
</div>
);
}