# Deploying Gauntlet to the gno.land testnet

The cloud sandbox cannot reach gno.land, so run these from your Mac. You need
the `gno`, `gnokey` and (optionally) `gnodev` binaries from the
[gno monorepo](https://github.com/gnolang/gno) — `cd gno && make install`.

Testnet is **Onyx** (`onyx-1`), RPC `https://rpc.onyx.testnets.gno.land:443`.

## 0. One-time setup

```bash
# a key to deploy with
gnokey add mykey                      # or: gnokey add -recover mykey

# your address, you will use it as your namespace
gnokey list

# testnet GNOT
open https://faucet.gno.land          # paste your address
```

Your realms deploy under your address namespace, e.g.
`gno.land/r/<your-address>/gauntlet`. The hackathon rule says the **project
name** cannot start with "Gno" — "Gauntlet" is fine. The package path contains
`gno.land` because that is the chain domain; that is every realm and is allowed.

## 1. Point the packages at your namespace

The code in this repo uses the placeholder namespace `dev`. Before deploying,
replace it with your address so the import paths resolve. From the repo root:

```bash
NS=g1youraddress...            # your address from `gnokey list`
grep -rl 'r/dev/\|p/dev/' gno | xargs sed -i '' \
  -e "s#gno.land/p/dev/#gno.land/p/$NS/#g" \
  -e "s#gno.land/r/dev/#gno.land/r/$NS/#g"
# and the module lines in each gnomod.toml
grep -rl 'module = "gno.land/[pr]/dev/' gno | xargs sed -i '' "s#/dev/#/$NS/#g"
```

(On Linux drop the `''` after `-i`.)

Re-run the tests to be sure nothing broke:

```bash
# link this repo into a gno examples tree, or use gnodev (below), then:
gno test gno.land/p/$NS/gauntlet gno.land/r/$NS/gauntlet/...
```

## 2. Try it locally first (recommended)

`gnodev` runs a local chain with hot reload and a built-in gnoweb:

```bash
cd gno
gnodev ./p/gauntlet ./r/gauntlet ./r/judges/sortnums ./r/judges/factor \
       ./r/solvers/rev1 ./r/solvers/sort1 ./r/solvers/cheat
# open the printed gnoweb URL, visit /r/<ns>/gauntlet
```

## 3. Deploy to Onyx

Order matters: the package first, then the judges (their `init` registers with
the board, so the board must exist), then the board, then solvers.

```bash
REMOTE=https://rpc.onyx.testnets.gno.land:443
CHAINID=onyx-1
GAS="-gas-fee 1000000ugnot -gas-wanted 20000000 -broadcast -chainid $CHAINID -remote $REMOTE"

cd gno
gnokey maketx addpkg -pkgdir ./p/gauntlet          -pkgpath gno.land/p/$NS/gauntlet          $GAS mykey
gnokey maketx addpkg -pkgdir ./r/gauntlet          -pkgpath gno.land/r/$NS/gauntlet          $GAS mykey
gnokey maketx addpkg -pkgdir ./r/judges/sortnums   -pkgpath gno.land/r/$NS/judges/sortnums   $GAS mykey
gnokey maketx addpkg -pkgdir ./r/judges/factor     -pkgpath gno.land/r/$NS/judges/factor     $GAS mykey
gnokey maketx addpkg -pkgdir ./r/solvers/rev1      -pkgpath gno.land/r/$NS/solvers/rev1      $GAS mykey
```

Check it in gnoweb: `https://onyx.testnets.gno.land/r/$NS/gauntlet`.

## 4. Seed a few challenges

So judges have something to show for the demo:

```bash
CALL="-gas-fee 1000000ugnot -gas-wanted 20000000 -broadcast -chainid $CHAINID -remote $REMOTE"

# a fixed-case bounty, 2 GNOT reward, 0.5 GNOT bond, open 72h, 30m reveal window
gnokey maketx call -pkgpath gno.land/r/$NS/gauntlet -func Post \
  -args "Reverse a string" \
  -args "Return the input reversed, by runes." \
  -args $'abc => cba\nhello => olleh\nnoon => noon' \
  -args 72 -args 500000 -args 30 \
  -send 2000000ugnot $CALL mykey

# a judged bounty graded by the sort judge
gnokey maketx call -pkgpath gno.land/r/$NS/gauntlet -func PostJudged \
  -args "Sort the numbers" \
  -args "Sort a comma-separated list of integers ascending, no spaces." \
  -args "gno.land/r/$NS/judges/sortnums" \
  -args "3,1,2 => 1,2,3" \
  -args 72 -args 0 -args 30 \
  -send 2000000ugnot $CALL mykey
```

## 5. Point the web app at it

Edit `web/config.js`:

```js
window.GAUNTLET = {
  REALM: "gno.land/r/<your-address>/gauntlet",
  RPC: "https://rpc.onyx.testnets.gno.land",
  CHAIN_ID: "onyx-1",
  GNOWEB: "https://onyx.testnets.gno.land",
  FAUCET: "https://faucet.gno.land",
};
```

Serve it statically (any host works):

```bash
cd web && python3 -m http.server 8080   # local check
# or deploy to Vercel/Netlify/GitHub Pages — it is a static folder
```

## 6. Run the demo

Follow [gnome-tavern/demo-script.md](../gnome-tavern/demo-script.md) in the
project folder for the recording.

## Notes

- Testnets reset. Keep these commands; redeploying is a few minutes.
- If `addpkg` says a path already exists, you deployed it before — bump the path
  (e.g. `gauntlet2`) or use a fresh namespace.
- Mainnet (`gnoland-1`) is the same steps with the mainnet RPC, but there is no
  faucet and transfers may be restricted. Do that only after the hackathon, for
  the Builder Retention Prize.
