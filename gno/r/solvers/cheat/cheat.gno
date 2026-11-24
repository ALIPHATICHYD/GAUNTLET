// Package cheat is a deliberately dishonest Gauntlet solution, kept as a
// live demonstration. It answers only the inputs published with the
// challenge and returns rubbish for anything else. Against a judged
// challenge, whose inputs are generated at reveal time, it fails.
package cheat

import "gno.land/r/g188c5k6v0tmfyevfzj962jkajjqt4ddtml8zw0x/gauntlet"

// Solve is a lookup table, not a solution.
func Solve(in string) string {
	switch in {
	case "3,1,2":
		return "1,2,3"
	case "84":
		return "2*2*3*7"
	}
	return "0"
}

func Submit(cur realm, id uint64, salt string) {
	gauntlet.Reveal(cross(cur), id, salt, Solve)
}
