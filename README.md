# Gauntlet

**Coding bounties graded by the chain, not by people.**

Post a coding challenge with a GNOT reward. Solvers deploy their answer as a
realm, and Gauntlet runs the tests **on-chain** and pays the earliest passing
commit instantly. No reviewer can refuse to pay, no dispute, and copying
someone's deployed code never wins.

Built on [gno.land](https://gno.land) for the Gnome Tavern hackathon.

- **Live demo:** _(testnet URL after deploy — see DEPLOY.md)_
- **Realm in gnoweb:** _(https://onyx.testnets.gno.land/r/g188c5k6v0tmfyevfzj962jkajjqt4ddtml8zw0x/gauntlet)_
- **Web app:** `web/` (static, no build step)

## Why it is interesting

On most chains "grade code and pay the winner" is impossible without a trusted
judge: the contract cannot run arbitrary submitted code. On gno.land it can.
Code is deployed as readable Gno source, one realm can call another's function,
and Gauntlet uses that to let **the chain itself be the referee**.

That is only safe because of Gno's interrealm rules. When Gauntlet calls a
solver's `Solve`, Gno runs it under the *solver's* authority, not Gauntlet's, so
a malicious `Solve` cannot touch the prize pool or the board's state. The
solver's code never receives Gauntlet's realm handle. See
[How grading is safe](#how-grading-is-safe).

## How it works

1. **Post.** A poster calls `Post` (or `PostJudged`) and sends the reward in
   ugnot. The realm escrows it. The tests and the reward are now locked: the
   poster cannot change them or cancel.
2. **Commit.** A solver computes `sha256(theirRealmPath + ":" + salt)` and calls
   `Commit(id, hash)` with the bond. This fixes their place in the queue before
   any of their code is public, so nobody can front-run them.
3. **Deploy.** The solver deploys a realm with `Solve(in string) string` and a
   `Submit` wrapper.
4. **Reveal.** The solver calls their realm's `Submit(id, salt)`, which calls
   `gauntlet.Reveal`. Gauntlet reads the caller's package path from the runtime,
   recomputes the hash, runs the tests on-chain, and records pass or fail.
5. **Payout.** The earliest commit that passes wins the whole pot. Bonds are
   refunded on reveal. A commit that is never revealed forfeits its bond into
   the reward. If nobody passes by the deadline, the reward returns to the
   poster. Anyone can call `Settle` to push a finished challenge to its payout.

Because the winner is the **earliest commit that passes**, a copier who commits
later can never overtake an honest solver, even if they reveal first.

### Two kinds of challenge

- **Fixed cases** — a list of `input => expected output` pairs. Simple and
  transparent.
- **Judged** — a registered *judge* realm generates fresh inputs from a
  reveal-time seed and checks each answer. A lookup table cannot pass, because
  the inputs do not exist until the moment of grading. Judges are immutable once
  registered, so a bounty graded by one has rules nobody can move. Two ship in
  this repo: `judges/sortnums` and `judges/factor`.

## How grading is safe

The one dangerous move here is "call a function a stranger wrote." Gno makes it
safe by construction:

- `Reveal` requires the caller to be a deployed `/r/` realm (checked via the
  runtime, not a user-supplied string), so the winning code is always public.
- When Gauntlet invokes `solve(in)`, Gno's **declaring-realm borrow** runs that
  body under the solver realm's storage authority. Any attempt by `Solve` to
  mutate Gauntlet's state fails the runtime's PkgID write guard.
- `Solve` is handed to Gauntlet as a plain `func(string) string`. It never
  receives Gauntlet's `cur realm`, so it cannot spend from or act as the board.
- Payouts use a realm-send banker bound to Gauntlet's own `cur`, so coins can
  only leave as the escrowed reward and bonds.

See `docs/resources/gno-interrealm-v2.md` in the gno monorepo for the borrow
rules this relies on.

## Layout

```
gno/
  p/gauntlet/         pure library: challenges, commit-reveal, grading, payouts (importable)
  r/gauntlet/         the board realm: gnoweb UI, JSON API, coin handling
  r/judges/sortnums/  a judge: sort integers
  r/judges/factor/    a judge: prime factorization
  r/solvers/rev1/     example solution (reverse a string)
  r/solvers/sort1/    example solution for the sort judge
  r/solvers/cheat/    a deliberately dishonest solution, to show judged challenges reject it
web/                  static web app (Adena wallet, no build step)
```

The logic lives in `p/gauntlet`, a pure package any realm can import to run its
own bounties in any token. `r/gauntlet` is the hosted instance that adds coins
and a UI.

## Build and test

Requires the `gno` tool from the [gno monorepo](https://github.com/gnolang/gno).

```bash
# from a checkout of the gno monorepo, with this repo's gno/ linked under examples
gno test gno.land/p/gauntlet gno.land/r/gauntlet/...
```

The package has 14 unit tests covering the state machine (fairness, expiry,
refunds, judged challenges, every rejection path). The realm has filetests that
run a full round, a judged round where a cheater fails and an honest solver
wins, every enforced rule, and the rendered gnoweb pages. See
[DEPLOY.md](./DEPLOY.md) to put it on testnet.

## The web app

`web/` is plain HTML, CSS and ES modules — no framework, no build. It reads the
chain over JSON-RPC (`vm/qeval`) and writes through the Adena wallet. Point
`web/config.js` at your deployed realm and serve the folder statically.

## License

MIT.
