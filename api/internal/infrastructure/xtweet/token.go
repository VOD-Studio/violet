package xtweet

import (
	"math"
	"strconv"
	"strings"
)

// syndicationToken 保持 JavaScript Number(id) 的浮点舍入与 V8 的 36 进制小数终止规则。
func syndicationToken(id string) string {
	n, _ := strconv.ParseFloat(id, 64)
	value := float64(float64(n/1e15) * math.Pi)
	integer := math.Floor(value)
	fraction := value - integer
	delta := math.Max(math.SmallestNonzeroFloat64, (math.Nextafter(value, math.Inf(1))-value)/2)
	const digits = "0123456789abcdefghijklmnopqrstuvwxyz"
	buf := []byte(strconv.FormatUint(uint64(integer), 36))
	if fraction >= delta {
		buf = append(buf, '.')
		for fraction >= delta {
			// 显式舍入阻止 Go 在 ARM64 上融合乘减；JavaScript 两步运算分别舍入。
			fraction = float64(fraction * 36)
			delta *= 36
			digit := int(fraction)
			buf = append(buf, digits[digit])
			fraction -= float64(digit)
			if (fraction > 0.5 || (fraction == 0.5 && digit&1 != 0)) && fraction+delta > 1 {
				for i := len(buf) - 1; i >= 0; i-- {
					if buf[i] == '.' {
						continue
					}
					index := strings.IndexByte(digits, buf[i])
					if index < 35 {
						buf[i] = digits[index+1]
						break
					}
					buf[i] = '0'
				}
				break
			}
		}
	}
	return strings.Map(func(r rune) rune {
		if r == '0' || r == '.' {
			return -1
		}
		return r
	}, string(buf))
}
