package auth

import (
	"fmt"
	"strings"

	qrcode "github.com/skip2/go-qrcode"
)

// renderQR 把内容渲染成终端二维码字符串。
//
// 自己写渲染层（编码用 go-qrcode 生成像素矩阵,不直接用它的 ToSmallString）:
// 每行输出两个像素行,用 Unicode 半高方块 ▀▄█ 把终端高度压缩一半。
// 外加一圈白色 quiet zone 提升扫码识别率。
func renderQR(content string) string {
	qr, err := qrcode.New(content, qrcode.Medium)
	if err != nil {
		return fmt.Sprintf("(二维码生成失败: %v)\n%s\n", err, content)
	}
	bitmap := qr.Bitmap()

	// 补一圈白边（quiet zone,标准要求 4 模块,这里用 2 够用且不过宽）。
	const quiet = 2
	size := len(bitmap) + quiet*2
	grid := make([][]bool, size)
	for i := range grid {
		grid[i] = make([]bool, size) // true=黑
	}
	for y, row := range bitmap {
		for x, v := range row {
			grid[y+quiet][x+quiet] = v
		}
	}

	var b strings.Builder
	// 两行一组,每个字符表示上/下两像素:上黑下白=▀ 上白下黑=▄ 全黑=█ 全白=空格。
	for y := 0; y < size; y += 2 {
		for x := 0; x < size; x++ {
			upper := grid[y][x]
			lower := y+1 < size && grid[y+1][x]
			switch {
			case upper && lower:
				b.WriteRune('█')
			case upper:
				b.WriteRune('▀')
			case lower:
				b.WriteRune('▄')
			default:
				b.WriteRune(' ')
			}
		}
		b.WriteByte('\n')
	}
	return b.String()
}
