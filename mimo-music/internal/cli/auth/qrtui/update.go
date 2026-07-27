package qrtui

import (
	"time"

	tea "charm.land/bubbletea/v2"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
)

// quitCmd bubbletea v2 的 tea.Quit() 返回 Msg 而非 Cmd;包一层成 Cmd。
func quitCmd() tea.Cmd {
	return func() tea.Msg { return tea.Quit() }
}

// animTick 排下一帧动画(animInterval 后)。驱动正弦波颜色扫过。
func animTick() tea.Cmd {
	return tea.Tick(animInterval, func(time.Time) tea.Msg {
		return animTickMsg{}
	})
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

// schedulePoll 排下一次轮询(pollInterval 后)。终态(确认/过期/超时)不排。
func schedulePoll(deps Deps) tea.Cmd {
	return tea.Tick(pollInterval, func(time.Time) tea.Msg {
		return poll(deps)()
	})
}

// Update 处理消息。状态机见 model.go 的 state 枚举注释。
//
// 动画驱动:非终态每收到 animTickMsg 推进 animFrame 并排下一帧(正弦波颜色流动);
// 终态(确认/过期/超时)停止动画(不再排 animTick)。
func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil

	case animTickMsg:
		// 终态不动画(状态文案是静态终态信息)。
		if m.state == stateConfirmed || m.state == stateExpired || m.state == stateTimeout {
			return m, nil
		}
		// 更新当前时刻,View 据此算 spinner 帧与 shimmer 亮带位置。
		// spinner 80ms 换帧、shimmer 30cells/s 都用 (now-animStart) 推导,
		// 不在此累加帧计数——节奏由时间保证。
		m.now = m.deps.Now()
		return m, animTick()

	case timeoutMsg:
		m.state = stateTimeout
		return m, quitCmd()

	case pollMsg:
		if msg.err != nil {
			m.state = stateError
			m.errMsg = msg.err.Error()
			// 出错自动重试,不退出。动画继续。
			return m, schedulePoll(m.deps)
		}
		m.errMsg = ""
		switch msg.code {
		case mmpb.QrcodeCode_QRCODE_CODE_WAITING:
			m.state = stateWaiting
			return m, schedulePoll(m.deps)
		case mmpb.QrcodeCode_QRCODE_CODE_SCANNED:
			m.state = stateScanned
			return m, schedulePoll(m.deps)
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
			return m, schedulePoll(m.deps)
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
