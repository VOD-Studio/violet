package qrtui

import (
	"fmt"
	"strings"
	"time"

	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"
)

// 视觉样式(取色用默认调色板,登录场景无需封面驱动)。
var (
	titleStyle   = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("213"))
	urlStyle     = lipgloss.NewStyle().Foreground(lipgloss.Color("245"))
	helpStyle    = lipgloss.NewStyle().Foreground(lipgloss.Color("241"))
	dimStyle     = lipgloss.NewStyle().Foreground(lipgloss.Color("241"))
	successStyle = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("42"))
	expiredStyle = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("203"))
	qrStyle      = lipgloss.NewStyle().Padding(1, 2) // QR 周围留白
)

// View 纯函数:QR 块固定 + 状态行原地刷新 + URL + 帮助。
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
	b.WriteString(helpStyle.Render("q 退出 · 超时 " + fmtDuration(pollTimeout) + " 自动取消"))

	return lipgloss.JoinVertical(lipgloss.Left, b.String())
}

// statusLine 单行状态:spinner + 文案 + 距上次轮询秒数。
// 这是修复核心——状态变化只重绘这一行,不再 fmt.Println 堆积。
func (m model) statusLine() string {
	ago := "首次检查中"
	if m.state != stateInit {
		ago = fmtDuration(m.deps.Now().Sub(m.pollAt)) + " 前检查"
	}
	switch m.state {
	case stateInit:
		return fmt.Sprintf("%s 首次检查中...", m.spinner.View())
	case stateWaiting:
		return fmt.Sprintf("%s 等待扫码...(%s)", m.spinner.View(), ago)
	case stateScanned:
		return fmt.Sprintf("%s 已扫描,请在 App 确认登录...(%s)", m.spinner.View(), ago)
	case stateError:
		return fmt.Sprintf("%s 轮询出错,重试中:%s(%s)", m.spinner.View(), m.errMsg, ago)
	case stateConfirmed:
		return successStyle.Render("✅ 登录成功,正在保存会话...")
	case stateExpired:
		return expiredStyle.Render("✗ 二维码已过期,请重新运行 login")
	case stateTimeout:
		return expiredStyle.Render("⏱ 登录超时(" + fmtDuration(pollTimeout) + "),请重新运行 login")
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
