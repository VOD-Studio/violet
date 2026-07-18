// 终端网格仿真测试:滚屏/折行/残留重复是终端侧行为,字节流断言抓不住,
// 必须用虚拟终端重放输出才能观测。
//
// vtSim 是带内容网格的最小终端模型:
//   - 两种 wrap 语义:deferred(xterm 系)/ immediate(Terminal.app 系)
//   - resizeReflow:模拟 iTerm2/VTE/kitty/WezTerm 等终端缩窄时的
//     重新折行(reflow)——已绘制的宽行变成多行,行数改变
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
type vtSim struct {
	cols, rows  int
	row, col    int
	wrapPending bool
	eagerWrap   bool
	scrolls     int

	grid [][]rune // 屏幕内容,每行 cols 个 cell;宽字符第二 cell 置 0(占位)
	cont []bool   // cont[i]:第 i 行是上一逻辑行的折行延续
}

func (v *vtSim) ensureGrid() {
	if v.grid != nil {
		return
	}
	v.grid = make([][]rune, v.rows)
	v.cont = make([]bool, v.rows)
	for i := range v.grid {
		v.grid[i] = blankRow(v.cols)
	}
}

func blankRow(cols int) []rune {
	r := make([]rune, cols)
	for i := range r {
		r[i] = ' '
	}
	return r
}

// rowText 取一行可见文本(占位 0 跳过,尾部空格裁掉)。
func (v *vtSim) rowText(r int) string {
	v.ensureGrid()
	var b strings.Builder
	for _, cell := range v.grid[r] {
		if cell != 0 {
			b.WriteRune(cell)
		}
	}
	return strings.TrimRight(b.String(), " ")
}

func (v *vtSim) lineDown() {
	if v.row == v.rows-1 {
		v.scrolls++ // 底行下移 = 滚屏(闪烁源)
		v.grid = append(v.grid[1:], blankRow(v.cols))
		v.cont = append(v.cont[1:], false)
		if v.cont[0] {
			v.cont[0] = false // 头行滚出屏幕,延续行自立
		}
	} else {
		v.row++
	}
}

// feed 逐字节消费一段输出,驱动网格与滚屏计数。
func (v *vtSim) feed(s string) {
	v.ensureGrid()
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
			v.cont[v.row] = false // \n 落下的是新逻辑行
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
			case 'K': // 清当前行光标到行尾
				for x := v.col; x < v.cols; x++ {
					v.grid[v.row][x] = ' '
				}
			case 'J': // 清光标到屏幕尾
				for x := v.col; x < v.cols; x++ {
					v.grid[v.row][x] = ' '
				}
				for r := v.row + 1; r < v.rows; r++ {
					v.grid[r] = blankRow(v.cols)
					v.cont[r] = false
				}
			case 'm', 'l', 'h':
				// 颜色/模式:不影响网格
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
				v.lineDown()
				v.cont[v.row] = true // 折行延续行
			}
			w := runewidth.RuneWidth(r)
			if v.col < v.cols {
				v.grid[v.row][v.col] = r
				if w == 2 && v.col+1 < v.cols {
					v.grid[v.row][v.col+1] = 0 // 宽字符占位
				}
			}
			v.col += w
			if v.col >= v.cols {
				if v.eagerWrap {
					// immediate wrap:写进最后一列立刻折到下一行
					v.col = 0
					v.lineDown()
					v.cont[v.row] = true
				} else {
					v.col = v.cols - 1
					v.wrapPending = true
				}
			}
			i += size
		}
	}
}

// resizeReflow 模拟支持 reflow 的终端缩窄/拉宽:
// 逻辑行(头行 + 折行延续行)按新宽度重新折行,物理行数随之变化。
// 真实终端(iTerm2/VTE/kitty/WezTerm/Windows Terminal)缩窄时即此行为;
// xterm/Alacritty 不 reflow(截断,行数不变)——本方法不模拟后者。
func (v *vtSim) resizeReflow(newCols int) {
	v.ensureGrid()

	// 1. 按 cont 标志分组出逻辑行(占位 0 跳过,尾部空白裁掉——
	//    真实终端 reflow 时会丢弃行尾空白)。
	type logicalLine struct {
		text      []rune
		hasCursor bool
		cursorSub int // 光标在该逻辑行内的物理子行号
	}
	var logicals []logicalLine
	for r := 0; r < v.rows; r++ {
		if r == 0 || !v.cont[r] {
			logicals = append(logicals, logicalLine{})
		}
		li := len(logicals) - 1
		if r == v.row {
			logicals[li].hasCursor = true
		}
		for _, cell := range v.grid[r] {
			if cell != 0 {
				logicals[li].text = append(logicals[li].text, cell)
			}
		}
	}
	// 尾部空白裁剪 + 光标子行号(光标前有几个延续行)。
	for li := range logicals {
		t := logicals[li].text
		for len(t) > 0 && t[len(t)-1] == ' ' {
			t = t[:len(t)-1]
		}
		logicals[li].text = t
	}
	// 重算光标子行号:光标物理行是该逻辑行的第几个物理行。
	{
		sub := 0
		for r := v.row - 1; r >= 0 && v.cont[r+1]; r-- {
			sub++
		}
		for li := range logicals {
			if logicals[li].hasCursor {
				logicals[li].cursorSub = sub
			}
		}
	}

	// 2. 按新宽度重新折行。
	newGrid := make([][]rune, 0, v.rows)
	newCont := make([]bool, 0, v.rows)
	newCursorRow := 0
	for _, lg := range logicals {
		chunks := wrapRunes(lg.text, newCols)
		if lg.hasCursor {
			sub := lg.cursorSub
			if sub >= len(chunks) {
				sub = len(chunks) - 1
			}
			newCursorRow = len(newGrid) + sub
		}
		for i, ch := range chunks {
			row := blankRow(newCols)
			copy(row, ch)
			newGrid = append(newGrid, row)
			newCont = append(newCont, i > 0)
		}
	}

	// 3. 超出屏幕的行从顶部滚出。
	for len(newGrid) > v.rows {
		newGrid = newGrid[1:]
		newCont = newCont[1:]
		v.scrolls++
		newCursorRow--
		if newCont[0] {
			newCont[0] = false
		}
	}
	for len(newGrid) < v.rows {
		newGrid = append(newGrid, blankRow(newCols))
		newCont = append(newCont, false)
	}

	v.cols = newCols
	v.grid = newGrid
	v.cont = newCont
	v.row = newCursorRow
	if v.row < 0 {
		v.row = 0
	}
	if v.col >= newCols {
		v.col = newCols - 1
	}
	v.wrapPending = false
}

// wrapRunes 按显示宽度把一串 rune 折成 ≤cols 的若干物理行(至少 1 行)。
func wrapRunes(text []rune, cols int) [][]rune {
	if cols < 1 {
		cols = 1
	}
	rows := [][]rune{{}}
	w := 0
	for _, r := range text {
		rw := runewidth.RuneWidth(r)
		if w+rw > cols {
			rows = append(rows, []rune{})
			w = 0
		}
		rows[len(rows)-1] = append(rows[len(rows)-1], r)
		w += rw
	}
	return rows
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

// TestProgress_ResizeReflowNoDuplicate 折行(reflow)终端缩窄:重绘后屏幕上每个
// bar 恰好一份,无残留重复。
// 回归:缩窄时旧帧的宽行被终端 reflow 成多行,帧块行数翻倍,但渲染仍按
// len(prev) 上移 → 落在新块中间 → 上半旧行残留(用户见「数据重复」)。
// 修复:SetWidth 后首帧按 reflow 估算旧帧实际占用行数,上移 + \e[J 整块清。
func TestProgress_ResizeReflowNoDuplicate(t *testing.T) {
	t.Parallel()
	var buf bytes.Buffer
	clock := newFakeClock(time.Date(2026, 7, 18, 12, 0, 0, 0, time.UTC))
	p := NewProgress(&buf, 100, true, WithProgressClock(clock.now))
	total := p.AddBar(35_800_000, "我喜欢的音乐")
	total.IsTotal = true
	s1 := p.AddBar(3_400_000, "Beyond - 海阔天空")
	s2 := p.AddBar(4_100_000, "周杰伦 - 晴天")

	vt := &vtSim{cols: 100, rows: 40, row: 30} // deferred wrap(iTerm2 系)
	drive := func(frames int) {
		for range frames {
			buf.Reset()
			clock.advance(100 * time.Millisecond)
			total.Incr(300_000, clock.now())
			s1.Incr(170_000, clock.now())
			s2.Incr(200_000, clock.now())
			p.RenderForTest()
			vt.feed(buf.String())
		}
	}

	drive(5)
	vt.resizeReflow(70) // 终端缩窄:99 列宽旧行折成 2 行,帧块 3→6 行
	p.SetWidth(70)
	drive(5)

	// 屏幕上每个 bar 的 label 必须恰好出现一次。
	for _, label := range []string{"我喜欢的音乐", "海阔天空", "晴天"} {
		count := 0
		for r := 0; r < vt.rows; r++ {
			if strings.Contains(vt.rowText(r), label) {
				count++
			}
		}
		if count != 1 {
			t.Errorf("label %q 在屏幕上出现 %d 次(应 1 次,>1 = 缩窄残留重复)", label, count)
		}
	}
}

// TestProgress_ReflowShrinkRaceNoDuplicate 连续拖动拉伸(widthSource 轮询去抖):
// 拖动期间帧冻结(零输出零重绘),宽度稳定 3 帧后一次性清残影适配——
// 屏幕上每个 bar 恰好一份,且拖动过程无闪烁源。
// 回归(用户实测 Wave 终端):winsize 与显示层 reflow 不同步,滞后窗口内
// 任何基于行数估算的清除都会估错,残影随拖动层层堆积 + 清绘闪烁。
func TestProgress_ReflowShrinkRaceNoDuplicate(t *testing.T) {
	t.Parallel()
	var buf bytes.Buffer
	clock := newFakeClock(time.Date(2026, 7, 18, 12, 0, 0, 0, time.UTC))
	width := 100
	p := NewProgress(&buf, width, true, WithProgressClock(clock.now),
		WithProgressWidthSource(func() int { return width }))
	total := p.AddBar(35_800_000, "我喜欢的音乐")
	total.IsTotal = true
	s1 := p.AddBar(3_400_000, "Beyond - 海阔天空")
	s2 := p.AddBar(4_100_000, "周杰伦 - 晴天")

	vt := &vtSim{cols: 100, rows: 40, row: 30}
	drive := func(frames int) {
		for range frames {
			buf.Reset()
			clock.advance(100 * time.Millisecond)
			total.Incr(300_000, clock.now())
			s1.Incr(170_000, clock.now())
			s2.Incr(200_000, clock.now())
			p.RenderForTest()
			vt.feed(buf.String())
		}
	}

	drive(5)
	vt.resizeReflow(80) // 拖窄:前 2 帧冻结,第 3 帧应用
	width = 80
	drive(4)
	vt.resizeReflow(70) // 继续拖窄
	width = 70
	drive(4)
	vt.resizeReflow(90) // 再往回拉宽
	width = 90
	drive(4)

	for _, label := range []string{"我喜欢的音乐", "海阔天空", "晴天"} {
		count := 0
		for r := 0; r < vt.rows; r++ {
			if strings.Contains(vt.rowText(r), label) {
				count++
			}
		}
		if count != 1 {
			t.Errorf("label %q 屏幕上出现 %d 次(应 1 次,>1 = 拖动残影)", label, count)
		}
	}
}

// TestProgress_ResizeDebounceFreezesFrames 去抖行为:宽度变化后的前 2 帧
// 冻结(零输出),第 3 帧才输出(应用新宽度)。守护「拖动期间不重绘」——
// 这是消除拖动闪烁与滞后窗口竞态的核心机制。
func TestProgress_ResizeDebounceFreezesFrames(t *testing.T) {
	t.Parallel()
	var buf bytes.Buffer
	clock := newFakeClock(time.Date(2026, 7, 18, 12, 0, 0, 0, time.UTC))
	width := 100
	p := NewProgress(&buf, width, true, WithProgressClock(clock.now),
		WithProgressWidthSource(func() int { return width }))
	b := p.AddBar(3_400_000, "Beyond - 海阔天空")

	clock.advance(100 * time.Millisecond)
	b.Incr(170_000, clock.now())
	p.RenderForTest() // 首帧(有输出)
	buf.Reset()

	width = 80 // 宽度变化
	for i := 1; i <= 2; i++ {
		clock.advance(100 * time.Millisecond)
		b.Incr(170_000, clock.now())
		p.RenderForTest()
		if buf.Len() != 0 {
			t.Errorf("去抖第 %d 帧应冻结(零输出),got %d bytes", i, buf.Len())
		}
		buf.Reset()
	}
	clock.advance(100 * time.Millisecond)
	b.Incr(170_000, clock.now())
	p.RenderForTest() // 第 3 帧:应用新宽度,清残影+重绘
	if buf.Len() == 0 {
		t.Errorf("去抖第 3 帧应应用新宽度并输出")
	}
}
