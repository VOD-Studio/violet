package qrtui

import (
	"fmt"
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
			dimStyle.Render("终端窗口过小,需 ≥ "+fmt.Sprintf("%d×%d", minWidth, minHeight))+"\n\n"+
				dimStyle.Render("调大窗口后重新运行 login"))
	}

	var b strings.Builder
	b.WriteString(titleStyle.Render("用网易云 App 扫描下方二维码登录"))
	b.WriteString("\n\n")
	b.WriteString(qrStyle.Render(m.deps.QR))
	b.WriteString("\n\n")
	b.WriteString(m.statusLine())
	b.WriteString("\n\n")
	b.WriteString(urlStyle.Render(m.deps.QRURL))
	b.WriteString("\n")
	b.WriteString(helpStyle.Render("二维码无法识别时,可在浏览器打开上面的 URL 再扫"))
	b.WriteString("\n")
	b.WriteString(helpStyle.Render("q 退出"))

	return lipgloss.JoinVertical(lipgloss.Left, b.String())
}

// statusLine 加载态(oh-my-pi Loader 同款):spinner 帧(accent 色)+ 空格 +
// shimmer 文字(亮带从左向右扫过,带外 dim 可读)。
//
// 非终态(WAITING/SCANNED/ERROR/INIT):spinner + shimmer 叠加,两个独立动画。
// 终态(CONFIRMED/EXPIRED/TIMEOUT):静态颜色(成功绿/过期红),不动画。
func (m model) statusLine() string {
	switch m.state {
	case stateConfirmed:
		return successStyle.Render("登录成功,正在保存会话")
	case stateExpired:
		return expiredStyle.Render("二维码已过期,请重新运行 login")
	case stateTimeout:
		return expiredStyle.Render("登录超时(" + fmtDuration(pollTimeout) + "),请重新运行 login")
	}
	// spinner 帧:用 (now-animStart)/80ms 取索引(精确 80ms 节奏)。
	elapsed := m.now.Sub(m.animStart)
	frameIdx := int(elapsed/(80*time.Millisecond)) % len(spinnerFrames)
	if frameIdx < 0 {
		frameIdx = 0
	}
	frame := spinnerFrames[frameIdx]
	// spinner 染 accent 色;message 走 shimmer(亮带扫过)。
	spinnerColored := "\x1b[38;2;" + hexToRGB(spinnerAccent) + "m" + frame + "\x1b[39m"
	timeMs := elapsed.Milliseconds()
	message := shimmerText(m.statusText(), timeMs, m.compiled)
	return spinnerColored + " " + message
}

// statusText 各非终态的文案(不含颜色,颜色由 shimmer 施加)。
// 用 … 单字符省略号(对齐 oh-my-pi Working… 风格),不用 ...
func (m model) statusText() string {
	switch m.state {
	case stateInit:
		return "正在获取二维码状态…"
	case stateWaiting:
		return "等待扫码…"
	case stateScanned:
		return "已扫描,请在 App 确认登录…"
	case stateError:
		return "轮询出错,重试中:" + m.errMsg
	}
	return ""
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
