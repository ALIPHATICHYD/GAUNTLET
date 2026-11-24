// Package sort1 is an honest Gauntlet solution for the sort-numbers judge.
package sort1

import (
	"sort"
	"strconv"
	"strings"

	"gno.land/r/g188c5k6v0tmfyevfzj962jkajjqt4ddtml8zw0x/gauntlet"
)

// Solve sorts a comma-separated list of integers ascending.
func Solve(in string) string {
	parts := strings.Split(in, ",")
	nums := make([]int, 0, len(parts))
	for _, p := range parts {
		v, err := strconv.Atoi(strings.TrimSpace(p))
		if err != nil {
			return ""
		}
		nums = append(nums, v)
	}
	sort.Ints(nums)
	out := make([]string, len(nums))
	for i, v := range nums {
		out[i] = strconv.Itoa(v)
	}
	return strings.Join(out, ",")
}

func Submit(cur realm, id uint64, salt string) {
	gauntlet.Reveal(cross(cur), id, salt, Solve)
}
