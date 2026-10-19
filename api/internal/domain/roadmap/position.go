package roadmap

import (
	"strings"

	"blog-api/internal/domain/shared"
)

const positionAlphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

// PositionBetween 在两个排序键之间生成新键；空串分别表示无下界或无上界。
func PositionBetween(before, after string) (string, error) {
	if before != "" && !ValidPosition(before) || after != "" && !ValidPosition(after) ||
		after != "" && before >= after {
		return "", shared.BadRequest("路线图相邻排序键无效")
	}
	return positionMidpoint(before, after), nil
}

func ValidPosition(key string) bool {
	if key == "" || key[len(key)-1] == positionAlphabet[0] {
		return false
	}
	for i := range len(key) {
		if !strings.ContainsRune(positionAlphabet, rune(key[i])) {
			return false
		}
	}
	return true
}

func positionMidpoint(before, after string) string {
	if after != "" {
		n := 0
		for n < len(after) {
			a := byte('0')
			if n < len(before) {
				a = before[n]
			}
			if a != after[n] {
				break
			}
			n++
		}
		if n > 0 {
			rest := ""
			if n < len(before) {
				rest = before[n:]
			}
			return after[:n] + positionMidpoint(rest, after[n:])
		}
	}
	a, b := 0, len(positionAlphabet)
	if before != "" {
		a = strings.IndexByte(positionAlphabet, before[0])
	}
	if after != "" {
		b = strings.IndexByte(positionAlphabet, after[0])
	}
	if b-a > 1 {
		return string(positionAlphabet[(a+b)/2])
	}
	if len(after) > 1 {
		return after[:1]
	}
	rest := ""
	if before != "" {
		rest = before[1:]
	}
	return string(positionAlphabet[a]) + positionMidpoint(rest, "")
}
