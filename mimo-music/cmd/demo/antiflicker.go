// antiflicker writer:把 mpb 的 \x1b[J(清屏到屏幕底)替换成 \x1b[K(清当前行到行尾)。
//
// 背景(字节流证据):
// mpb 多 bar 每帧发 \x1b[<N>A\x1b[J(光标上移 N 行 + 清屏到屏幕底)。
// \x1b[J 会清掉整个进度区域 → 终端渲染一帧空白 → 再重写内容,产生"内容闪白"。
// single 场景用 \r 不清屏所以不闪,multi 用 \x1b[J 所以闪(用户确认)。
//
// 解法(学 indicatif 的 diff 渲染思路):
// \x1b[J → \x1b[K。\x1b[K 只清当前行到行尾,不波及下方行。
// 光标上移后逐行覆盖写,每行末尾清残留,但不清整块 → 无空白帧。
// filler 已保证每行可见宽度固定(width_stable 测试),覆盖写不会错位。
//
// 这个 writer 只做字节替换,不缓冲、不改帧结构、不加 BSR,
// 不会破坏 mpb 的多行重绘(上次 syncWriter 失败是因为 BSR 包裹改变了时序)。
package main

import (
	"bytes"
	"io"
)

// edScreenClear = \x1b[J (Erase Display,清光标到屏幕底)
// edLineClear   = \x1b[K (Erase Line,清光标到行尾)
var (
	edScreenClear = []byte("\x1b[J")
	edLineClear   = []byte("\x1b[K")
)

// antiflickerWriter 包装底层 writer,把 \x1b[J 替换成 \x1b[K。
type antiflickerWriter struct {
	out io.Writer
	// carry 缓冲跨 Write 边界的 \x1b[J 片段(如 \x1b[ 和 J 分两次到达)。
	// \x1b[J 是3字节,可能被拆,需跨调用拼接判断。
	carry []byte
}

func newAntiflickerWriter(out io.Writer) *antiflickerWriter {
	return &antiflickerWriter{out: out}
}

// Write 替换 \x1b[J → \x1b[K 后写入底层。
//
// 处理跨边界:若上次 Write 末尾是 \x1b[ 的前缀(1-2字节),与本次开头拼接判断。
func (w *antiflickerWriter) Write(p []byte) (int, error) {
	// 拼上次的 carry
	if len(w.carry) > 0 {
		p = append(w.carry, p...)
		w.carry = nil
	}

	// 替换所有完整 \x1b[J。
	replaced := bytes.ReplaceAll(p, edScreenClear, edLineClear)

	// 检查末尾是否是 \x1b[J 的不完整前缀(\x1b 或 \x1b[),需 carry 到下次。
	// \x1b[J = [0x1b, 0x5b, 0x4a]
	if n := len(replaced); n >= 1 {
		// 末尾可能是 \x1b(1字节前缀)或 \x1b[(2字节前缀)
		if replaced[n-1] == 0x1b {
			w.carry = []byte{0x1b}
			replaced = replaced[:n-1]
		} else if n >= 2 && replaced[n-2] == 0x1b && replaced[n-1] == '[' {
			w.carry = []byte{0x1b, '['}
			replaced = replaced[:n-2]
		}
	}

	// 写入底层。返回原始 p 的长度(调用方关心写了多少输入)。
	if _, err := w.out.Write(replaced); err != nil {
		return len(p), err
	}
	return len(p), nil
}
