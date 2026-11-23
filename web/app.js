// Gauntlet web app: a thin, dependency-free client over the realm.
import { api, commitHash, randomSalt } from "./rpc.js";
import * as wallet from "./wallet.js";

const { REALM, GNOWEB, FAUCET, CHAIN_ID } = window.GAUNTLET;
const view = document.getElementById("view");
let me = null;

// ---------- helpers ----------

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const gnot = (u) => {
  const n = Number(u || 0) / 1e6;
  return (Number.isInteger(n) ? n : Number(n.toFixed(6))) + " GNOT";
};

const shortAddr = (a) => (a && a.length > 14 ? `${a.slice(0, 8)}…${a.slice(-4)}` : a || "");

function timeLeft(unix) {
  const d = unix * 1000 - Date.now();
  if (d <= 0) return "ended";
  const h = Math.floor(d / 3.6e6);
  if (h >= 48) return `${Math.floor(h / 24)} days left`;
  if (h >= 1) return `${h}h left`;
  return `${Math.max(1, Math.floor(d / 6e4))}m left`;
}

function toast(msg, bad = false) {
  document.querySelectorAll(".toast").forEach((t) => t.remove());
  const el = document.createElement("div");
  el.className = "toast" + (bad ? " bad" : "");
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), bad ? 9000 : 5000);
}

const realmWeb = (p) => `${GNOWEB}/${p.replace(/^gno\.land\//, "")}`;

// Salts live in this browser only. Losing one means losing the commit, so the
// app keeps them and shows them back on the challenge page.
const vault = {
  key: "gauntlet.commits",
  all() {
    try {
      return JSON.parse(localStorage.getItem(this.key) || "[]");
    } catch {
      return [];
    }
  },
  add(entry) {
    const all = this.all().filter((e) => !(e.id === entry.id && e.pkgPath === entry.pkgPath));
    all.push(entry);
    localStorage.setItem(this.key, JSON.stringify(all));
  },
  for(id) {
    return this.all().filter((e) => String(e.id) === String(id));
  },
};

// ---------- wallet ----------

async function refreshWallet(silent = true) {
  const btn = document.getElementById("connect");
  try {
    me = await wallet.account();
  } catch {
    me = null;
  }
  if (me?.address) {
    btn.textContent = shortAddr(me.address);
    btn.title = `${me.address} on ${me.chainId || CHAIN_ID}`;
  } else if (!silent) {
    btn.textContent = "Connect wallet";
  }
}

document.getElementById("connect").addEventListener("click", async () => {
  try {
    me = await wallet.connect();
    await refreshWallet(false);
    toast(`Connected as ${shortAddr(me.address)}`);
    render();
  } catch (e) {
    toast(e.message, true);
  }
});

function requireWallet() {
  if (!me?.address) {
    toast("Connect your Adena wallet first.", true);
    return false;
  }
  return true;
}

// ---------- routes ----------

const routes = {
  "": boardPage,
  post: postPage,
  solve: solvePage,
  leaderboard: leaderboardPage,
  judges: judgesPage,
  c: challengePage,
  u: profilePage,
};

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [head, ...rest] = raw.split("/");
  return { head: head || "", arg: rest.join("/") };
}

async function render() {
  const { head, arg } = parseHash();
  const page = routes[head] || notFound;
  document.querySelectorAll("#nav a[data-route]").forEach((a) => {
    a.classList.toggle("on", a.dataset.route === head);
  });
  view.innerHTML = `<p class="mono-dim">Reading the chain…</p>`;
  try {
    view.innerHTML = await page(arg);
    wire();
  } catch (e) {
    view.innerHTML = `<div class="empty">Could not read the chain: ${esc(e.message)}<br /><br />
      <span class="hint">Is <code>${esc(REALM)}</code> deployed on ${esc(CHAIN_ID)}?</span></div>`;
  }
}

function notFound() {
  return `<div class="empty">Nothing here. <a href="#/">Back to the board</a></div>`;
}

// ---------- board ----------

async function boardPage() {
  const [stats, list] = await Promise.all([api.stats(), api.list(0, 50)]);
  const open = (list || []).filter((c) => c.status === "open");
  const done = (list || []).filter((c) => c.status !== "open");
  return `
  <section class="hero">
    <h1>Coding bounties graded by the chain, not by people.</h1>
    <p>Post a challenge with a GNOT reward and a set of tests. Solvers deploy their answer as a realm, and
    this board <span class="tag">runs the tests on-chain</span> and pays the earliest passing commit instantly.</p>
    <p>No reviewer can refuse to pay. Nobody can copy an answer and win, because places in the queue are
    fixed by a hash before any code is public.</p>
  </section>
  ${statsRow(stats)}
  <h2 class="section">Open bounties</h2>
  <div class="cards">${open.length ? open.map(cardFor).join("") : `<div class="empty">No open bounties. <a href="#/post">Post the first one.</a></div>`}</div>
  ${done.length ? `<h2 class="section">Finished</h2><div class="cards">${done.map(cardFor).join("")}</div>` : ""}`;
}

function statsRow(s) {
  if (!s) return "";
  return `<div class="stats">
    <div class="stat"><b>${s.open}</b><small>open bounties</small></div>
    <div class="stat"><b>${gnot(s.escrow)}</b><small>in escrow</small></div>
    <div class="stat"><b>${gnot(s.paid)}</b><small>paid to solvers</small></div>
    <div class="stat"><b>${s.players}</b><small>addresses playing</small></div>
    <div class="stat"><b>${s.judges}</b><small>judges</small></div>
  </div>`;
}

function cardFor(c) {
  return `<article class="card row">
    <div>
      <h3><a href="#/c/${c.id}">#${c.id} ${esc(c.title)}</a></h3>
      <div class="meta">
        <span class="pill ${c.status}">${c.status}</span>
        <span class="pill ${c.judged ? "judge" : ""}">${c.judged ? "judged" : `${c.cases} tests`}</span>
        <span>${c.attempts} attempt${c.attempts === 1 ? "" : "s"}</span>
        <span>bond ${gnot(c.bond)}</span>
        <span>${c.status === "open" ? timeLeft(c.deadline) : "closed"}</span>
      </div>
    </div>
    <div class="pot">${gnot(c.pot)}<small>reward</small></div>
  </article>`;
}

// ---------- one challenge ----------

async function challengePage(id) {
  const c = await api.challenge(Number(id));
  if (!c) return notFound();
  const mine = vault.for(c.id);
  const banner =
    c.status === "won"
      ? `<div class="card"><b>Won by <a href="#/u/${c.attempts.find((a) => a.winner)?.solver}">${shortAddr(
          c.attempts.find((a) => a.winner)?.solver
        )}</a> for ${gnot(c.pot)}.</b> Winning code:
        <a href="${realmWeb(c.attempts.find((a) => a.winner)?.pkgpath || "")}$source" target="_blank" rel="noopener">${esc(
          c.attempts.find((a) => a.winner)?.pkgpath
        )}</a></div>`
      : c.status === "closed"
      ? `<div class="card"><b>Closed.</b> Nobody passed before the deadline, so the reward went back to the poster.</div>`
      : "";

  return `
  <section class="hero">
    <h1>#${c.id} ${esc(c.title)}</h1>
    <p><span class="pill ${c.status}">${c.status}</span>
      reward <span class="tag">${gnot(c.pot)}</span> ·
      bond ${gnot(c.bond)} ·
      reveal window ${Math.round(c.window / 60)} min ·
      ${c.status === "open" ? timeLeft(c.deadline) : "ended"} ·
      posted by <a href="#/u/${c.poster}">${shortAddr(c.poster)}</a></p>
  </section>
  ${banner}
  <h2 class="section">The challenge</h2>
  <div class="spec">${esc(c.spec || "No description.").replace(/\n/g, "<br />")}
    <p class="hint" style="margin-top:14px">Write <code>func Solve(in string) string</code>.</p></div>

  <h2 class="section">How it is graded</h2>
  ${
    c.judge
      ? `<div class="card"><b>A judge</b> generates fresh inputs the moment you reveal and checks each answer, so a lookup table cannot pass.
         <a href="${realmWeb(c.judge)}$source" target="_blank" rel="noopener">Read the judge's code</a>.</div>`
      : ""
  }
  ${
    c.cases.length
      ? `<table><thead><tr><th>Input</th><th>Expected output</th></tr></thead><tbody>${c.cases
          .map((t) => `<tr><td><code>${esc(JSON.stringify(t.in))}</code></td><td><code>${esc(JSON.stringify(t.want))}</code></td></tr>`)
          .join("")}</tbody></table>`
      : ""
  }

  ${c.status === "open" ? enterForm(c, mine) : ""}

  <h2 class="section">Queue</h2>
  <p class="hint">Earlier commits rank first. A later commit cannot win while an earlier one can still reveal.</p>
  ${
    c.attempts.length
      ? `<table><thead><tr><th>#</th><th>Solver</th><th>Result</th><th>Solution</th></tr></thead><tbody>${c.attempts
          .map(
            (a, i) => `<tr class="${a.winner ? "winner" : ""}">
            <td>${i + 1}</td>
            <td><a href="#/u/${a.solver}">${shortAddr(a.solver)}</a></td>
            <td>${a.state}${a.total ? ` <span class="mono-dim">(${a.passed}/${a.total})</span>` : ""}${
              a.state === "failed" && a.failIn
                ? `<br /><span class="hint">Solve(${esc(JSON.stringify(a.failIn))}) returned ${esc(JSON.stringify(a.failGot))}</span>`
                : ""
            }</td>
            <td>${a.pkgpath ? `<a href="${realmWeb(a.pkgpath)}$source" target="_blank" rel="noopener">source</a>` : "—"}</td>
          </tr>`
          )
          .join("")}</tbody></table>`
      : `<div class="empty">No commits yet.</div>`
  }`;
}

function enterForm(c, mine) {
  const pending = mine.filter((m) => !m.revealed);
  return `
  <h2 class="section">Enter this bounty</h2>
  <div class="steps">
    <div class="step">
      <h4>Commit your place in line</h4>
      <p class="hint">Pick the realm path you will deploy your solution to. The hash hides it until you reveal,
      so nobody can front-run you, and your place is fixed from this moment.</p>
      <form class="panel" data-commit="${c.id}" data-bond="${c.bond}">
        <label>Your solution's realm path
          <input name="pkgPath" required placeholder="gno.land/r/${me?.address || "<your-address>"}/solve${c.id}"
                 value="gno.land/r/${me?.address || ""}${me?.address ? `/solve${c.id}` : ""}" />
        </label>
        <label>Salt (kept in this browser)
          <input name="salt" required value="${randomSalt()}" />
        </label>
        <div class="flex">
          <button class="btn primary" type="submit">Commit${c.bond > 0 ? ` and send ${gnot(c.bond)} bond` : ""}</button>
          <span class="hint">The bond comes back when you reveal, pass or fail.</span>
        </div>
      </form>
    </div>
    <div class="step">
      <h4>Deploy your solution</h4>
      <p class="hint">Save this as <code>solve${c.id}.gno</code> and deploy it with gnokey to the exact path you committed.</p>
      <pre>${esc(template(c.id))}</pre>
      <pre>gnokey maketx addpkg \\
  -pkgdir . -pkgpath "gno.land/r/${me?.address || "<your-address>"}/solve${c.id}" \\
  -gas-fee 1000000ugnot -gas-wanted 20000000 \\
  -broadcast -chainid ${CHAIN_ID} -remote ${window.GAUNTLET.RPC} YOURKEY</pre>
    </div>
    <div class="step">
      <h4>Reveal before your window closes</h4>
      ${
        pending.length
          ? pending
              .map(
                (m) => `<div class="card"><div class="flex">
                  <div class="grow"><code>${esc(m.pkgPath)}</code><br /><span class="hint">salt ${esc(m.salt)}</span></div>
                  <button class="btn primary small" data-reveal="${esc(m.pkgPath)}" data-id="${c.id}" data-salt="${esc(m.salt)}">Reveal now</button>
                </div></div>`
              )
              .join("")
          : `<p class="hint">Your commits show up here with a Reveal button once you have made one in this browser.</p>`
      }
      <p class="hint">Reveal calls your own realm's <code>Submit</code>, which hands <code>Solve</code> to the board. The tests run on-chain and the result is final.</p>
    </div>
  </div>
  <div class="flex" style="margin-top:14px">
    <button class="btn" data-boost="${c.id}">Boost the reward</button>
    <button class="btn" data-settle="${c.id}">Settle</button>
    <span class="hint">Settling expires late commits and pays out when the result is certain. Anyone can do it.</span>
  </div>`;
}

function template(id) {
  return `package solve${id}

import "${REALM}"

// Solve answers one test input.
func Solve(in string) string {
	// your code here
	return in
}

// Submit reveals this realm as your answer.
func Submit(cur realm, id uint64, salt string) {
	gauntlet.Reveal(cross(cur), id, salt, Solve)
}`;
}

// ---------- post ----------

async function postPage() {
  const judges = (await api.judges()) || [];
  return `
  <section class="hero">
    <h1>Post a bounty</h1>
    <p>Your reward is escrowed by the realm the moment you post. You cannot change the tests or cancel,
    which is exactly why solvers can trust it. If nobody passes by the deadline, the reward comes back to you.</p>
  </section>
  <form class="panel" id="post-form">
    <label>Title<input name="title" required maxlength="120" placeholder="Sort the numbers" /></label>
    <label>What to build (markdown)
      <textarea name="spec" placeholder="Given a comma-separated list of integers, return them sorted ascending."></textarea>
    </label>
    <label>Graded by
      <select name="judgePath">
        <option value="">Fixed test cases only</option>
        ${judges.map((j) => `<option value="${esc(j.path)}">${esc(j.name)} — ${esc(j.about)}</option>`).join("")}
      </select>
    </label>
    <label>Test cases, one per line as <code>input =&gt; expected</code>
      <textarea name="cases" placeholder="3,1,2 => 1,2,3&#10;5 => 5">abc => cba
hello => olleh</textarea>
      <span class="hint">With a judge selected, these are extra fixed checks and may be left empty.</span>
    </label>
    <div class="two">
      <label>Reward in GNOT<input name="reward" type="number" min="0.000001" step="0.000001" value="2" required /></label>
      <label>Bond per commit in GNOT<input name="bond" type="number" min="0" step="0.000001" value="0.5" /></label>
    </div>
    <div class="two">
      <label>Open for (hours)<input name="hours" type="number" min="1" max="2160" value="72" required /></label>
      <label>Reveal window (minutes)<input name="window" type="number" min="1" max="10080" value="30" required /></label>
    </div>
    <p class="hint">A bond makes people think before committing: skip your reveal and it is added to the reward.
    A short reveal window keeps the queue moving.</p>
    <button class="btn primary" type="submit">Post and escrow the reward</button>
  </form>`;
}

// ---------- other pages ----------

async function leaderboardPage() {
  const rows = (await api.leaderboard()) || [];
  return `<section class="hero"><h1>Leaderboard</h1><p>By GNOT earned from solved bounties.</p></section>
  ${
    rows.length
      ? `<table><thead><tr><th>#</th><th>Solver</th><th>Solved</th><th>Earned</th><th>Attempts</th></tr></thead><tbody>${rows
          .map(
            (p, i) =>
              `<tr><td>${i + 1}</td><td><a href="#/u/${p.addr}">${shortAddr(p.addr)}</a></td><td>${p.solved}</td><td>${gnot(
                p.earned
              )}</td><td>${p.attempts}</td></tr>`
          )
          .join("")}</tbody></table>`
      : `<div class="empty">Nobody has solved a bounty yet.</div>`
  }`;
}

async function judgesPage() {
  const rows = (await api.judges()) || [];
  return `<section class="hero"><h1>Judges</h1>
    <p>A judge is a realm with two functions: one generates inputs from a seed, one checks an answer.
    It registers once and can never change, so a bounty graded by it has rules nobody can move.</p></section>
  ${
    rows.length
      ? `<div class="cards">${rows
          .map(
            (j) => `<article class="card"><h3>${esc(j.name)}</h3>
            <p class="hint">${esc(j.about)}</p>
            <div class="meta"><span>used by ${j.uses} bounties</span>
            <a href="${realmWeb(j.path)}$source" target="_blank" rel="noopener">read the code</a></div></article>`
          )
          .join("")}</div>`
      : `<div class="empty">No judges registered yet.</div>`
  }`;
}

async function profilePage(addr) {
  const p = await api.profile(addr);
  return `<section class="hero"><h1>${shortAddr(addr)}</h1><p class="addr">${esc(addr)}</p></section>
  ${
    p
      ? `<div class="stats">
      <div class="stat"><b>${p.solved}</b><small>solved</small></div>
      <div class="stat"><b>${gnot(p.earned)}</b><small>earned</small></div>
      <div class="stat"><b>${p.attempts}</b><small>attempts</small></div>
      <div class="stat"><b>${p.posted}</b><small>bounties posted</small></div>
      <div class="stat"><b>${gnot(p.funded)}</b><small>funded</small></div>
    </div>`
      : `<div class="empty">No activity yet.</div>`
  }`;
}

function solvePage() {
  return `<section class="hero"><h1>How to solve a bounty</h1>
    <p>Three steps: commit, deploy, reveal. The commit fixes your place before any code is public, so being
    fast with someone else's answer never pays.</p></section>
  <div class="steps">
    <div class="step"><h4>Commit</h4><p>Choose the realm path you will deploy to and a salt. The board stores
      only <code>sha256(path + ":" + salt)</code> and your place in the queue.</p></div>
    <div class="step"><h4>Deploy</h4><p>Publish your realm with <code>Solve</code> and <code>Submit</code>.
      Anyone can read it now, but anyone who copies it commits after you.</p>
      <pre>${esc(template("N"))}</pre></div>
    <div class="step"><h4>Reveal</h4><p>Call your realm's <code>Submit(id, salt)</code> within the reveal window.
      The board reads your package path from the runtime, checks the hash, runs the tests and records the result.
      Your bond comes back either way.</p></div>
  </div>
  <h2 class="section">Rules the code enforces</h2>
  <div class="cards">
    <div class="card">Solutions must be deployed <code>/r/</code> realms, so winning code stays public on-chain.</div>
    <div class="card">One pending commit per address per bounty. Failed? Commit again with a new realm path.</div>
    <div class="card">Your <code>Solve</code> cannot touch the board's funds or state. Gno runs it under your realm's
      authority, and it never receives the board's <code>cur</code>.</div>
    <div class="card">The poster cannot cancel, change the tests or pick a favourite. The reward is locked until
      someone passes or the deadline passes.</div>
  </div>
  <p class="hint" style="margin-top:16px">Need testnet GNOT? <a href="${FAUCET}" target="_blank" rel="noopener">Use the faucet</a>.</p>`;
}

// ---------- actions ----------

function wire() {
  const postForm = document.getElementById("post-form");
  if (postForm) postForm.addEventListener("submit", onPost);

  document.querySelectorAll("form[data-commit]").forEach((f) => f.addEventListener("submit", onCommit));
  document.querySelectorAll("[data-reveal]").forEach((b) => b.addEventListener("click", onReveal));
  document.querySelectorAll("[data-boost]").forEach((b) => b.addEventListener("click", onBoost));
  document.querySelectorAll("[data-settle]").forEach((b) => b.addEventListener("click", onSettle));
}

const toUgnot = (gnotStr) => Math.round(Number(gnotStr || 0) * 1e6);

async function onPost(e) {
  e.preventDefault();
  if (!requireWallet()) return;
  const f = new FormData(e.target);
  const reward = toUgnot(f.get("reward"));
  const bond = toUgnot(f.get("bond"));
  const judgePath = f.get("judgePath");
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    const args = judgePath
      ? [f.get("title"), f.get("spec"), judgePath, f.get("cases"), f.get("hours"), bond, f.get("window")]
      : [f.get("title"), f.get("spec"), f.get("cases"), f.get("hours"), bond, f.get("window")];
    await wallet.call(judgePath ? "PostJudged" : "Post", args, reward);
    toast("Bounty posted and reward escrowed.");
    location.hash = "#/";
    render();
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false;
  }
}

async function onCommit(e) {
  e.preventDefault();
  if (!requireWallet()) return;
  const id = Number(e.target.dataset.commit);
  const bond = Number(e.target.dataset.bond);
  const f = new FormData(e.target);
  const pkgPath = String(f.get("pkgPath")).trim();
  const salt = String(f.get("salt")).trim();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    const hash = await commitHash(pkgPath, salt);
    await wallet.call("Commit", [id, hash], bond);
    vault.add({ id, pkgPath, salt, hash, at: Date.now() });
    toast("Committed. Deploy your realm, then reveal.");
    render();
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false;
  }
}

async function onReveal(e) {
  if (!requireWallet()) return;
  const { reveal: pkgPath, id, salt } = e.target.dataset;
  e.target.disabled = true;
  try {
    await wallet.callRealm(pkgPath, "Submit", [Number(id), salt]);
    const entry = vault.for(id).find((m) => m.pkgPath === pkgPath);
    if (entry) vault.add({ ...entry, revealed: true });
    toast("Revealed. The chain graded your code.");
    render();
  } catch (err) {
    toast(err.message, true);
  } finally {
    e.target.disabled = false;
  }
}

async function onBoost(e) {
  if (!requireWallet()) return;
  const amount = prompt("How much GNOT do you want to add to this reward?", "1");
  if (!amount) return;
  try {
    await wallet.call("Boost", [Number(e.target.dataset.boost)], toUgnot(amount));
    toast("Reward boosted.");
    render();
  } catch (err) {
    toast(err.message, true);
  }
}

async function onSettle(e) {
  if (!requireWallet()) return;
  try {
    await wallet.call("Settle", [Number(e.target.dataset.settle)]);
    toast("Settled.");
    render();
  } catch (err) {
    toast(err.message, true);
  }
}

// ---------- boot ----------

document.getElementById("gnoweb").href = realmWeb(REALM);
document.getElementById("chain-info").innerHTML =
  `Realm <a href="${realmWeb(REALM)}" target="_blank" rel="noopener">${esc(REALM)}</a> on <b>${esc(CHAIN_ID)}</b> · ` +
  `<a href="${FAUCET}" target="_blank" rel="noopener">testnet faucet</a> · ` +
  `<a href="https://adena.app" target="_blank" rel="noopener">Adena wallet</a>`;

window.addEventListener("hashchange", render);
refreshWallet().then(render);
