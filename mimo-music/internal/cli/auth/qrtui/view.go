package qrtui

import (
	"fmt"
	"image/color"
	"math"
	"strings"
	"time"

	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"
)

// 视觉样式(登录场景用固定调色板,无需封面驱动)。
var (
	titleStyle   = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("213"))
	urlStyle     = lipgloss.NewStyle().Foreground(lipgloss.Color("245"))
	helpStyle    = lipgloss.NewStyle().Foreground(lipgloss.Color("241"))
	dimStyle     = lipgloss.NewStyle().Foreground(lipgloss.Color("241"))
	successStyle = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("42"))
	expiredStyle = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("203"))
	qrStyle      = lipgloss.NewStyle().Padding(1, 2) // QR 周围留白
)

// 正弦波颜色扫过的调色板:从暗到亮的灰阶(truecolor)。
// 暗端用 #3a3a3a(深灰),亮端用 #f0f0f0(近白),扫过时形成「亮带流动」的观感。
var wavePalette = []color.Color{
	lipgloss.Color("#3a3a3a"), // 0.0 相位:最暗
	lipgloss.Color("#6a6a6a"),
	lipgloss.Color("#9a9a9a"),
	lipgloss.Color("#c8c8c8"),
	lipgloss.Color("#f0f0f0"), // 1.0 相位:最亮
}

// waveCharsLen 正弦波跨多少个字符一个完整周期。值越小波越密。
const waveCycle = 14.0

// View 纯函数:QR 块固定 + 状态行(正弦波颜色扫过)+ URL + 帮助。
// 屏幕过小(width<minWidth 或 height<minHeight)给居中提示,不堆积状态行。
func (m model) View() tea.View {
	return tea.NewView(m.render())
}

// render 实际渲染逻辑(纯函数,测试可直接断言返回字符串)。
func (m model) render() string {
	if m.width <= 0 || m.height <= 0 {
		return "" // 尺寸未就绪(首帧 WindowSizeMsg 前)
	}
	if m.width < minWidth || m.height < minHeight {
		return lipgloss.Place(m.width, m.height, lipgloss.Center, lipgloss.Center,
			dimStyle.Render("终端窗口过小(需 ≥ "+fmt.Sprintf("%d×%d)", minWidth, minHeight))+"\n\n"+
				dimStyle.Render("请调大窗口后重新运行 login"))
	}

	var b strings.Builder
	b.WriteString(titleStyle.Render("请用网易云 App 扫描下方二维码登录"))
	b.WriteString("\n\n")
	b.WriteString(qrStyle.Render(m.deps.QR))
	b.WriteString("\n\n")
	b.WriteString(m.statusLine())
	b.WriteString("\n\n")
	b.WriteString(urlStyle.Render("二维码内容: " + m.deps.QRURL))
	b.WriteString("\n")
	b.WriteString(helpStyle.Render("(如二维码无法识别,把上面 URL 在浏览器打开,用 App 扫浏览器里的码)"))
	b.WriteString("\n")
	b.WriteString(helpStyle.Render("q 退出"))

	return lipgloss.JoinVertical(lipgloss.Left, b.String())
}

// statusLine 加载态:文字颜色按正弦波扫过(oh-my-pi wave 样式)。
//
// 非终态(WAITING/SCANNED/ERROR/INIT):整段文案逐字符按 (charIndex+animFrame)
// 算正弦相位 → 映射 wavePalette 灰阶。animFrame 推进 → 亮带从左向右流动。
// 终态(CONFIRMED/EXPIRED/TIMEOUT):静态颜色(成功绿/过期红),不动画。
func (m model) statusLine() string {
	switch m.state {
	case stateConfirmed:
		return successStyle.Render("✅ 登录成功,正在保存会话...")
	case stateExpired:
		return expiredStyle.Render("✗ 二维码已过期,请重新运行 login")
	case stateTimeout:
		return expiredStyle.Render("⏱ 登录超时(" + fmtDuration(pollTimeout) + "),请重新运行 login")
	}
	// 非终态:正弦波颜色扫过。
	return m.waveText(m.statusText())
}

// statusText 各非终态的文案(不含颜色,颜色由 waveText 施加)。
func (m model) statusText() string {
	switch m.state {
	case stateInit:
		return "正在获取二维码状态..."
	case stateWaiting:
		return "等待扫码..."
	case stateScanned:
		return "已扫描,请在 App 确认登录..."
	case stateError:
		return "轮询出错,重试中:" + m.errMsg
	}
	return ""
}

// waveText 把 s 的每个字符按正弦相位染成 wavePalette 的灰阶。
// phase = sin((charIndex + animFrame) / waveCycle * 2π) → [-1,1] → [0, n-1]。
// animFrame 随时间 +1 → 相位推进 → 亮带流动。
func (m model) waveText(s string) string {
	if s == "" {
		return ""
	}
	runes := []rune(s)
	n := len(wavePalette)
	var b strings.Builder
	for i, r := range runes {
		// 正弦相位:字符位置 + 动画帧 共同决定。
		phase := math.Sin(float64(i+m.animFrame) / waveCycle * 2 * math.Pi)
		// [-1,1] → [0, n-1]:亮带在相位=1 处。
		idx := int((phase + 1) / 2 * float64(n-1))
		if idx < 0 {
			idx = 0
		} else if idx >= n {
			idx = n - 1
		}
		b.WriteString(lipgloss.NewStyle().Foreground(wavePalette[idx]).Render(string(r)))
	}
	return b.String()
}

// fmtDuration 秒级人类可读(≥1min 显示 mm:ss,否则 Ns)。
func fmtDuration(d time.Duration) string {
	if d < 0 {
		d = 0
	}
	s := int(d.Seconds())
	if s >= 60 {
		return fmt.Sprintf("%d:%02d", s/60, s%60)
	}
	return fmt.Sprintf("%ds", s)
}
