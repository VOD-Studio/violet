package qrtui

import (
	"time"

	tea "charm.land/bubbletea/v2"
	"charm.land/bubbles/v2/spinner"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
)

// quitCmd bubbletea v2 的 tea.Quit() 返回 Msg 而非 Cmd;包一层成 Cmd。
func quitCmd() tea.Cmd {
	return func() tea.Msg { return tea.Quit() }
}

// pollMsg 一次轮询的结果。Check 的四个返回值原样透传。
type pollMsg struct {
	code      mmpb.QrcodeCode
	raw       []byte // CONFIRMED 时有效(转 json.RawMessage 存入 model)
	setCookie string
	err       error
}

// timeoutMsg 超过 pollTimeout 的终态信号。
type timeoutMsg struct{}

// poll 发起一次异步轮询(tea.Cmd)。Check 经 Deps 注入,内部调 kit.RawDo。
// pollInterval 间隔由 Update 在收到 pollMsg 后用 tea.Tick 排下一次。
func poll(deps Deps) tea.Cmd {
	return func() tea.Msg {
		code, raw, cookie, err := deps.Check(deps.PollCtx)
		return pollMsg{code: code, raw: raw, setCookie: cookie, err: err}
	}
}

// schedulePoll 排下一次轮询(pollInterval 后)。配合 spinner.Tick 保持帧率。
func schedulePoll(deps Deps) tea.Cmd {
	return tea.Tick(pollInterval, func(time.Time) tea.Msg {
		// Tick 触发后立即发起实际网络轮询(poll 本身是 tea.Cmd,需 batch)。
		// 这里返回一个 sentinel,Update 收到后再发 poll——但更简单的是直接
		// 在 Tick 回调里同步调 Check。bubbletea v2 的 tea.Tick 回调可执行任意
		// 逻辑,但为保持 Check 的 ctx 注入与错误透传一致,这里走 poll() 同款。
		return poll(deps)()
	})
}

// Update 处理消息。状态机见 model.go 的 state 枚举注释。
func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil

	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m, cmd

	case timeoutMsg:
		m.state = stateTimeout
		return m, quitCmd()

	case pollMsg:
		m.pollAt = m.deps.Now()
		if msg.err != nil {
			m.state = stateError
			m.errMsg = msg.err.Error()
			// 出错自动重试,不退出。
			return m, tea.Batch(m.spinner.Tick, schedulePoll(m.deps))
		}
		m.errMsg = ""
		switch msg.code {
		case mmpb.QrcodeCode_QRCODE_CODE_WAITING:
			m.state = stateWaiting
			return m, tea.Batch(m.spinner.Tick, schedulePoll(m.deps))
		case mmpb.QrcodeCode_QRCODE_CODE_SCANNED:
			m.state = stateScanned
			return m, tea.Batch(m.spinner.Tick, schedulePoll(m.deps))
		case mmpb.QrcodeCode_QRCODE_CODE_CONFIRMED:
			m.state = stateConfirmed
			m.confirmedRaw = msg.raw
			m.confirmedCookie = msg.setCookie
			return m, quitCmd()
		case mmpb.QrcodeCode_QRCODE_CODE_EXPIRED:
			m.state = stateExpired
			return m, quitCmd()
		default:
			// 未知 code:当作出错,自动重试(不卡死)。
			m.state = stateError
			m.errMsg = "未知状态码 " + codeString(msg.code)
			return m, tea.Batch(m.spinner.Tick, schedulePoll(m.deps))
		}

	case tea.KeyMsg:
		// q/Esc/Ctrl+C 退出。终态(stateConfirmed/stateExpired/stateTimeout)由
		// pollMsg/timeoutMsg 自动 quit;这里只处理用户主动取消。
		if msg.String() == "q" || msg.String() == "esc" || msg.String() == "ctrl+c" {
			return m, quitCmd()
		}
	}
	return m, nil
}

// codeString 状态码转字符串(展示未知码用)。
func codeString(c mmpb.QrcodeCode) string {
	switch c {
	case mmpb.QrcodeCode_QRCODE_CODE_UNSPECIFIED:
		return "UNSPECIFIED"
	case mmpb.QrcodeCode_QRCODE_CODE_EXPIRED:
		return "EXPIRED"
	case mmpb.QrcodeCode_QRCODE_CODE_WAITING:
		return "WAITING"
	case mmpb.QrcodeCode_QRCODE_CODE_SCANNED:
		return "SCANNED"
	case mmpb.QrcodeCode_QRCODE_CODE_CONFIRMED:
		return "CONFIRMED"
	}
	return "UNKNOWN"
}

// scheduleTimeout 在 Init 时排超时(避免忘记)。供 Init 调用。
func scheduleTimeout() tea.Cmd {
	return tea.Tick(pollTimeout, func(time.Time) tea.Msg {
		return timeoutMsg{}
	})
}
