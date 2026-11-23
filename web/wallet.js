// Adena wallet: the only part of the app that writes to the chain.

const { REALM, CHAIN_ID } = window.GAUNTLET;

export function hasAdena() {
  return typeof window.adena !== "undefined";
}

export async function connect() {
  if (!hasAdena()) throw new Error("Adena wallet not found. Install it from adena.app.");
  const res = await window.adena.AddEstablish("Gauntlet");
  if (res.code !== 0 && res.code !== 4001 && res.status !== "success") {
    // code 4001 means the site was already established.
    if (res.code !== 4001) throw new Error(res.message || "Could not connect");
  }
  const acct = await window.adena.GetAccount();
  if (acct.code !== 0) throw new Error(acct.message || "Could not read account");
  await switchNetwork();
  return acct.data;
}

async function switchNetwork() {
  try {
    await window.adena.SwitchNetwork(CHAIN_ID);
  } catch (_) {
    // The user can also switch by hand; a wrong network shows up as a failed tx.
  }
}

export async function account() {
  if (!hasAdena()) return null;
  const acct = await window.adena.GetAccount();
  return acct.code === 0 ? acct.data : null;
}

// call sends a transaction to the board realm. send is a ugnot amount string.
export async function call(func, args, sendUgnot = 0, gasFee = 1_000_000, gasWanted = 20_000_000) {
  if (!hasAdena()) throw new Error("Adena wallet not found");
  const message = {
    type: "/vm.m_call",
    value: {
      caller: (await account())?.address,
      send: sendUgnot > 0 ? `${sendUgnot}ugnot` : "",
      pkg_path: REALM,
      func,
      args: args.map(String),
    },
  };
  const res = await window.adena.DoContract({
    messages: [message],
    gasFee,
    gasWanted,
  });
  if (res.code !== 0) throw new Error(res.message || "Transaction rejected");
  return res.data;
}

// callRealm sends a transaction to another realm, used to reveal a solution.
export async function callRealm(pkgPath, func, args, gasWanted = 50_000_000) {
  if (!hasAdena()) throw new Error("Adena wallet not found");
  const res = await window.adena.DoContract({
    messages: [
      {
        type: "/vm.m_call",
        value: {
          caller: (await account())?.address,
          send: "",
          pkg_path: pkgPath,
          func,
          args: args.map(String),
        },
      },
    ],
    gasFee: 1_000_000,
    gasWanted,
  });
  if (res.code !== 0) throw new Error(res.message || "Transaction rejected");
  return res.data;
}
