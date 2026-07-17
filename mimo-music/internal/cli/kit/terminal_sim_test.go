// 终端网格仿真测试:滚屏是终端侧行为,字节流断言抓不住,
// 必须用虚拟终端重放输出才能观测。
//
// 回归:行宽曾恰好顶满终端宽度,在 immediate-wrap 终端(Terminal.app 等)
// 写满最后一列立刻折行,帧块每帧多占一行 → 光标上移行数不够 →
// 逐帧滚屏/抖动(用户肉眼「闪烁」)。修复:渲染宽度预留最后一列(width-1)。
// 两种 wrap 语义下仿真都必须 0 滚屏(首帧落定除外)。
package kit

import (
	"bytes"
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/mattn/go-runewidth"
)

// vtSim 最小终端网格仿真。
// eagerWrap=false:xterm 系 deferred wrap(最后一列写满后置 pending,下个可打印字符才折行)。
// eagerWrap=true:Terminal.app 系 immediate wrap(写进最后一列立刻折行)。
// 两种语义对「恰好 == 终端宽度」的行处理不同——这是条件性闪烁的关键变量。
type vtSim struct {
	cols, rows  int
	row, col    int
	wrapPending bool
	eagerWrap   bool
	scrolls     int
}

func (v *vtSim) lineDown() {
	if v.row == v.rows-1 {
		v.scrolls++ // 底行下移 = 滚屏(闪烁源)
	} else {
		v.row++
	}
}

// feed 逐字节消费一段输出,统计滚屏次数。
func (v *vtSim) feed(s string) {
	i := 0
	for i < len(s) {
		c := s[i]
		switch {
		case c == '\r':
			v.col = 0
			v.wrapPending = false
			i++
		case c == '\n':
			v.wrapPending = false
			v.lineDown()
			i++
		case c == 0x1b && i+1 < len(s) && s[i+1] == '[':
			// CSI:参数直到终结字母
			j := i + 2
			for j < len(s) && !((s[j] >= 'A' && s[j] <= 'Z') || (s[j] >= 'a' && s[j] <= 'z')) {
				j++
			}
			if j >= len(s) {
				return
			}
			params := s[i+2 : j]
			switch s[j] {
			case 'A': // 光标上移 N(默认1)
				n := 1
				if params != "" {
					n = atoiOr1(params)
				}
				v.row -= n
				if v.row < 0 {
					v.row = 0
				}
			case 'K', 'J', 'm', 'l', 'h':
				// 清行/清屏/颜色/模式:不影响光标与滚屏
			}
			i = j + 1
		case c == 0x1b:
			i++ // 其他 ESC 序列容错跳过
		default:
			// 可打印字符(按 rune 解码)
			r, size := utf8.DecodeRuneInString(s[i:])
			if v.wrapPending {
				v.col = 0
				v.wrapPending = false
				v.lineDown() // 折行到底行也会滚屏
			}
			v.col += runewidth.RuneWidth(r)
			if v.col >= v.cols {
				if v.eagerWrap {
					// immediate wrap:写进最后一列立刻折到下一行
					v.col = 0
					v.lineDown()
				} else {
					v.col = v.cols - 1
					v.wrapPending = true
				}
			}
			i += size
		}
	}
}

func atoiOr1(s string) int {
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return 1
		}
		n = n*10 + int(c-'0')
	}
	if n == 0 {
		return 1
	}
	return n
}

// feedFrames 驱动 20 帧渲染并逐帧喂给仿真终端,返回每帧滚屏数。
// 模拟真实场景:终端被历史输出填满,shell 提示符在最后一行。
func feedFrames(t *testing.T, eagerWrap bool) []int {
	t.Helper()
	var buf bytes.Buffer
	clock := newFakeClock(time.Date(2026, 7, 18, 12, 0, 0, 0, time.UTC))
	p := NewProgress(&buf, 80, true, WithProgressClock(clock.now))
	b := p.AddBar(3_400_000, "Beyond - 海阔天空")

	vt := &vtSim{cols: 80, rows: 24, row: 23, eagerWrap: eagerWrap}
	perFrame := make([]int, 0, 20)
	for range 20 {
		buf.Reset()
		clock.advance(100 * time.Millisecond)
		b.Incr(170_000, clock.now())
		p.RenderForTest()
		before := vt.scrolls
		vt.feed(buf.String())
		perFrame = append(perFrame, vt.scrolls-before)
	}
	if !strings.Contains(buf.String(), "\x1b[K") {
		t.Fatalf("sanity: 帧应含清行序列")
	}
	return perFrame
}

// TestProgress_NoScrollDeferredWrap xterm 系 deferred-wrap 终端:首帧后 0 滚屏。
func TestProgress_NoScrollDeferredWrap(t *testing.T) {
	t.Parallel()
	for frame, scrolled := range feedFrames(t, false) {
		if frame > 0 && scrolled > 0 {
			t.Errorf("frame %d(deferred-wrap): 滚屏 %d 行", frame, scrolled)
		}
	}
}

// TestProgress_NoScrollEagerWrap Terminal.app 系 immediate-wrap 终端:首帧后 0 滚屏。
// 这是「顶满最后一列 → 每帧折行抖动」修复的直接守护。
func TestProgress_NoScrollEagerWrap(t *testing.T) {
	t.Parallel()
	for frame, scrolled := range feedFrames(t, true) {
		if frame > 0 && scrolled > 0 {
			t.Errorf("frame %d(eager-wrap): 滚屏 %d 行(每帧折行/抖动 = 闪烁)", frame, scrolled)
		}
	}
}

// TestProgress_ResizeNoScroll 运行期拉伸:SetWidth 适配后,新宽度下 0 滚屏。
// 场景:100 列启动 → 第 5 帧缩到 70 列(同时 SetWidth)→ 第 10 帧拉回 100 列。
// 缩窄是堆叠/滚屏高危路径(行比终端宽会折行);拉宽只损失空间,顺带覆盖。
// 注:70 列是 barWidth floor=4 下的最小可用宽度(meta 固定 36 + 开销 27 + bar 4 = 67);
// 更窄终端的自适应布局(降 meta)是另一个独立问题,不在此测试范围。
func TestProgress_ResizeNoScroll(t *testing.T) {
	t.Parallel()
	var buf bytes.Buffer
	clock := newFakeClock(time.Date(2026, 7, 18, 12, 0, 0, 0, time.UTC))
	p := NewProgress(&buf, 100, true, WithProgressClock(clock.now))
	b := p.AddBar(3_400_000, "Beyond - 海阔天空")

	vt := &vtSim{cols: 100, rows: 24, row: 23, eagerWrap: true}
	for frame := 0; frame < 15; frame++ {
		if frame == 5 {
			vt.cols = 70
			p.SetWidth(70)
		}
		if frame == 10 {
			vt.cols = 100
			p.SetWidth(100)
		}
		buf.Reset()
		clock.advance(100 * time.Millisecond)
		b.Incr(170_000, clock.now())
		p.RenderForTest()
		before := vt.scrolls
		vt.feed(buf.String())
		if scrolled := vt.scrolls - before; frame > 0 && scrolled > 0 {
			t.Errorf("frame %d(cols=%d): 滚屏 %d 行", frame, vt.cols, scrolled)
		}
	}
}
