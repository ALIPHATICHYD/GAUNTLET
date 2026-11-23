// Read-only chain access: ABCI queries over JSON-RPC. No wallet needed.

const { RPC, REALM } = window.GAUNTLET;

let rpcId = 0;

async function abciQuery(path, data) {
  const body = {
    jsonrpc: "2.0",
    id: String(++rpcId),
    method: "abci_query",
    params: { path, data: btoa(data), height: "0", prove: false },
  };
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`RPC ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "RPC error");
  const resp = json.result?.response;
  if (resp?.Error || resp?.error) {
    const log = resp.Log || resp.log || "";
    throw new Error(log || "query failed");
  }
  const b64 = resp?.ResponseBase?.Data ?? resp?.Data ?? resp?.value;
  if (!b64) return "";
  return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
}

// qeval evaluates a read-only expression in the realm and returns its value.
// The VM answers like: ("[{...}]" string)
export async function qeval(expr) {
  const raw = await abciQuery("vm/qeval", `${REALM}.${expr}`);
  return unwrapString(raw);
}

export function unwrapString(raw) {
  const s = raw.trim();
  const m = s.match(/^\((.*)\s+string\)$/s);
  if (!m) return s;
  return JSON.parse(m[1]);
}

export async function qevalJSON(expr) {
  const s = await qeval(expr);
  if (!s || s === "null") return null;
  return JSON.parse(s);
}

export const api = {
  stats: () => qevalJSON("StatsJSON()"),
  list: (offset = 0, limit = 50) => qevalJSON(`ListJSON(${offset},${limit})`),
  challenge: (id) => qevalJSON(`ChallengeJSON(${id})`),
  profile: (addr) => qevalJSON(`ProfileJSON("${addr}")`),
  leaderboard: () => qevalJSON("LeaderboardJSON()"),
  judges: () => qevalJSON("JudgesJSON()"),
};

// commitHash mirrors the realm's HashSolution: sha256(pkgPath + ":" + salt).
export async function commitHash(pkgPath, salt) {
  const bytes = new TextEncoder().encode(`${pkgPath}:${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomSalt() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
