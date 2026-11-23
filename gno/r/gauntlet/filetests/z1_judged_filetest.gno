// PKGPATH: gno.land/r/dev/main
package main

import (
	"chain"
	"testing"

	"gno.land/r/dev/gauntlet"
	_ "gno.land/r/dev/judges/sortnums"
	"gno.land/r/dev/solvers/cheat"
	"gno.land/r/dev/solvers/sort1"
)

// A judged challenge: the inputs are generated when the solution is revealed,
// so a lookup table cannot pass, while a real sort can.
func main(cur realm) {
	poster := address("g1q646ctzhvn60v392yy4ldq5zyr8q5hnxee3zqe")
	cheater := address("g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5")
	honest := address("g1dmt3sa5ucvecxuhf3j6ne5r0e3z4x7h6c03xc0")
	boardAddr := chain.PackageAddress("gno.land/r/dev/gauntlet")

	println(gauntlet.JudgesJSON())

	fund(boardAddr, 1_000_000)
	testing.SetRealm(testing.NewUserRealm(poster))
	id := gauntlet.PostJudged(cross(cur), "Sort the numbers",
		"Sort a comma-separated list of integers ascending.",
		"gno.land/r/dev/judges/sortnums", "3,1,2 => 1,2,3", 6, 0, 30)

	// The cheater commits first, so they would win if their code passed.
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(cheater))
	gauntlet.Commit(cross(cur), id, gauntlet.HashFor("gno.land/r/dev/solvers/cheat", "s1"))
	testing.SetRealm(testing.NewUserRealm(honest))
	gauntlet.Commit(cross(cur), id, gauntlet.HashFor("gno.land/r/dev/solvers/sort1", "s2"))

	cheat.Submit(cross(cur), id, "s1")
	println("after the cheat reveals, status:", status(id))

	sort1.Submit(cross(cur), id, "s2")
	println("after the honest solution reveals, status:", status(id))
	println(gauntlet.ChallengeJSON(id))
}

func status(id uint64) string {
	j := gauntlet.ChallengeJSON(id)
	i := indexOf(j, `"status":"`)
	rest := j[i+10:]
	return rest[:indexOf(rest, `"`)]
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

func fund(to address, amount int64) {
	coins := chain.Coins{{Denom: "ugnot", Amount: amount}}
	testing.IssueCoins(to, coins)
	testing.SetOriginSend(coins)
}

// Output:
// [{"path":"gno.land/r/dev/judges/sortnums","name":"Sort numbers","about":"Sort comma-separated integers ascending. 8 random lists of 1-40 numbers.","uses":0}]
// after the cheat reveals, status: open
// after the honest solution reveals, status: won
// {"id":1,"title":"Sort the numbers","spec":"Sort a comma-separated list of integers ascending.","status":"won","poster":"g1q646ctzhvn60v392yy4ldq5zyr8q5hnxee3zqe","reward":1000000,"pot":1000000,"bond":0,"boosts":0,"forfeited":0,"created":1234567890,"deadline":1234589490,"window":1800,"judge":"gno.land/r/dev/judges/sortnums","cases":[{"in":"3,1,2","want":"1,2,3"}],"attempts":[{"seq":1,"solver":"g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5","hash":"9bdacc7d1f7b110367e62333cf7fcfcf2fbeaafdca1ba846910c79004f9345da","committed":1234567890,"state":"failed","pkgpath":"gno.land/r/dev/solvers/cheat","passed":0,"total":8,"failIn":"635,-719,-182,-854,-642,96,374,-421,-646,-346,-621,-69,185,438,901,-861,394","failGot":"0","failWant":"","winner":false},{"seq":2,"solver":"g1dmt3sa5ucvecxuhf3j6ne5r0e3z4x7h6c03xc0","hash":"efd6cd4bbf0c1afc832a2200455939715dcd975f020e1bd793ef82f94092e284","committed":1234567890,"state":"passed","pkgpath":"gno.land/r/dev/solvers/sort1","passed":9,"total":9,"failIn":"","failGot":"","failWant":"","winner":true}]}
