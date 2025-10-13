import ldap from "ldapjs";


export async function ldapAuthenticate(username: string, password: string): Promise<LdapUser> {
const url = process.env.LDAP_URL!;
const bindDN = process.env.LDAP_BIND_DN!;
const bindPW = process.env.LDAP_BIND_PW!;
const baseDN = process.env.LDAP_BASE_DN!;
const uidAttr = process.env.LDAP_UID_ATTR || "sAMAccountName";


if (!url || !bindDN || !bindPW || !baseDN) throw new Error("LDAP env not configured");


const adminClient = ldap.createClient({ url, tlsOptions: { rejectUnauthorized: false } });


// 1) Bind as service account
await new Promise<void>((resolve, reject) => adminClient.bind(bindDN, bindPW, (err) => (err ? reject(err) : resolve())));


// 2) Find the user's DN
const filter = `(${uidAttr}=${username})`;
const opts = { scope: "sub" as const, filter, attributes: ["cn", uidAttr, "memberOf", "dn"] };
const userEntry: any = await new Promise((resolve, reject) => {
let found: any = null;
adminClient.search(baseDN, opts, (err, res) => {
if (err) return reject(err);
res.on("searchEntry", (entry) => { found = entry.object; });
res.on("error", reject);
res.on("end", () => resolve(found));
});
});


if (!userEntry?.dn) { adminClient.unbind(); return null; }


// 3) Try to bind as the user to verify password
const userClient = ldap.createClient({ url, tlsOptions: { rejectUnauthorized: false } });
await new Promise<void>((resolve, reject) => userClient.bind(userEntry.dn, password, (err) => (err ? reject(err) : resolve()))).catch(async () => {
adminClient.unbind();
try { userClient.unbind(); } catch {}
throw new Error("Invalid credentials");
});


try { userClient.unbind(); } catch {}
try { adminClient.unbind(); } catch {}


const groups = Array.isArray(userEntry.memberOf) ? userEntry.memberOf : (userEntry.memberOf ? [userEntry.memberOf] : []);
return { uid: userEntry[uidAttr] ?? username, cn: userEntry.cn, memberOf: groups };
}