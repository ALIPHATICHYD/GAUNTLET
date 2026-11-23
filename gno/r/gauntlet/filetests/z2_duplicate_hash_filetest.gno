// PKGPATH: gno.land/r/dev/main
package main

import (
	"chain"
	"testing"

	"gno.land/r/dev/gauntlet"
	_ "gno.land/r/dev/solvers/rev1"
)

func main(cur realm) {
	poster := address("g1q646ctzhvn60v392yy4ldq5zyr8q5hnxee3zqe")
	alice := address("g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5")
	mallory := address("g1dmt3sa5ucvecxuhf3j6ne5r0e3z4x7h6c03xc0")
	boardAddr := chain.PackageAddress("gno.land/r/dev/gauntlet")
	_, _ = alice, mallory

	coins := chain.Coins{{Denom: "ugnot", Amount: 1_000_000}}
	testing.IssueCoins(boardAddr, coins)
	testing.SetOriginSend(coins)
	testing.SetRealm(testing.NewUserRealm(poster))
	id := gauntlet.Post(cross(cur), "Reverse", "", "abc => cba", 6, 0, 30)

	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(alice))
	hash := gauntlet.HashFor("gno.land/r/dev/solvers/rev1", "alice-salt")
	gauntlet.Commit(cross(cur), id, hash)
	_ = hash

	testing.SetRealm(testing.NewUserRealm(mallory))
	gauntlet.Commit(cross(cur), id, hash)
}

// Error:
// gauntlet: this hash was already committed
