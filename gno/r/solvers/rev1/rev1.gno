// Package rev1 is an example Gauntlet solution: reverse a string.
//
// This is the shape every solution takes. Solve does the work; Submit hands
// Solve to the board, which runs the tests on-chain and records the result.
package rev1

import "gno.land/r/dev/gauntlet"

// Solve reverses in by runes.
func Solve(in string) string {
	r := []rune(in)
	for i, j := 0, len(r)-1; i < j; i, j = i+1, j-1 {
		r[i], r[j] = r[j], r[i]
	}
	return string(r)
}

// Submit reveals this realm as the answer to challenge id.
func Submit(cur realm, id uint64, salt string) {
	gauntlet.Reveal(cross(cur), id, salt, Solve)
}

func Render(_ string) string {
	return "# rev1\n\nAn example [Gauntlet](/r/dev/gauntlet) solution: `Solve` reverses a string.\n"
}
