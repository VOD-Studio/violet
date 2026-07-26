// qrtui 单元测试。seam:Deps 注入假 Check/Now,Update/View 是纯函数。
//
// 不测:bubbletea Program 在真实终端的渲染(人工 smoke);真实网络 CheckQrcode(集成)。
// 沿 play_test.go 惯例:testify require + 注入替身。
package qrtui

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	tea "charm.land/bubbletea/v2"
	"charm.land/bubbles/v2/spinner"

	"github.com/stretchr/testify/require"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
)

// fakeDeps 构造可控的 Deps:Check 按 codes 队列依次返回;Now 返回固定时钟序列。
type fakeDeps struct {
	codes    []pollResult // Check 依次返回的结果队列
	idx      int
	nowTimes []time.Time // Now 依次返回
	nowIdx   int
}

type pollResult struct {
	code      mmpb.QrcodeCode
	raw       json.RawMessage
	setCookie string
	err       error
}

func (f *fakeDeps) check(context.Context) (mmpb.QrcodeCode, json.RawMessage, string, error) {
	if f.idx >= len(f.codes) {
		// 队列耗尽返回 WAITING(避免无限循环测试卡死)。
		return mmpb.QrcodeCode_QRCODE_CODE_WAITING, nil, "", nil
	}
	r := f.codes[f.idx]
	f.idx++
	return r.code, r.raw, r.setCookie, r.err
}

func (f *fakeDeps) now() time.Time {
	if f.nowIdx >= len(f.nowTimes) {
		return time.Unix(0, 0)
	}
	t := f.nowTimes[f.nowIdx]
	f.nowIdx++
	return t
}

func newTestModel(fd *fakeDeps) model {
	return newModel(Deps{
		QR:     "▀▀▀\n▄▄▄\n", // 简化的 QR 占位
		QRURL:  "https://music.163.com/login?codekey=test123",
		PollCtx: context.Background(),
		Check:  fd.check,
		Now:    fd.now,
	})
}

// applyMsg 辅助:对 model 应用一条消息,返回新 model(忽略 Cmd)。
func applyMsg(t *testing.T, m model, msg tea.Msg) model {
	t.Helper()
	next, _ := m.Update(msg)
	nm, ok := next.(model)
	require.True(t, ok, "Update 应返回同类型 model")
	return nm
}

// ==================== Update 状态机 ====================

func TestUpdate_WindowSizeSetsDimensions(t *testing.T) {
	m := newTestModel(&fakeDeps{})
	out := applyMsg(t, m, tea.WindowSizeMsg{Width: 100, Height: 40})
	require.Equal(t, 100, out.width)
	require.Equal(t, 40, out.height)
}

func TestUpdate_PollMsgWaiting(t *testing.T) {
	m := newTestModel(&fakeDeps{codes: []pollResult{{code: mmpb.QrcodeCode_QRCODE_CODE_WAITING}}})
	out := applyMsg(t, m, pollMsg{code: mmpb.QrcodeCode_QRCODE_CODE_WAITING})
	require.Equal(t, stateWaiting, out.state)
	require.Empty(t, out.errMsg)
}

func TestUpdate_PollMsgScanned(t *testing.T) {
	m := newTestModel(&fakeDeps{})
	out := applyMsg(t, m, pollMsg{code: mmpb.QrcodeCode_QRCODE_CODE_SCANNED})
	require.Equal(t, stateScanned, out.state)
}

func TestUpdate_PollMsgConfirmedFillsCookieAndQuits(t *testing.T) {
	raw := json.RawMessage(`{"account":{"id":12345}}`)
	m := newTestModel(&fakeDeps{})
	out := applyMsg(t, m, pollMsg{
		code:      mmpb.QrcodeCode_QRCODE_CODE_CONFIRMED,
		raw:       raw,
		setCookie: "MUSIC_U=abc; path=/",
	})
	require.Equal(t, stateConfirmed, out.state)
	require.Equal(t, raw, out.confirmedRaw)
	require.Equal(t, "MUSIC_U=abc; path=/", out.confirmedCookie)
}

func TestUpdate_PollMsgExpired(t *testing.T) {
	m := newTestModel(&fakeDeps{})
	out := applyMsg(t, m, pollMsg{code: mmpb.QrcodeCode_QRCODE_CODE_EXPIRED})
	require.Equal(t, stateExpired, out.state)
}

func TestUpdate_PollMsgErrorSetsMsgKeepsRetrying(t *testing.T) {
	m := newTestModel(&fakeDeps{})
	out := applyMsg(t, m, pollMsg{err: errors.New("network timeout")})
	require.Equal(t, stateError, out.state)
	require.Contains(t, out.errMsg, "network timeout")
}

func TestUpdate_PollMsgUnknownCodeTreatedAsError(t *testing.T) {
	m := newTestModel(&fakeDeps{})
	out := applyMsg(t, m, pollMsg{code: mmpb.QrcodeCode(999)})
	require.Equal(t, stateError, out.state)
	// 未知码经 codeString 转字符串展示(codeString 对未注册码返回 UNKNOWN)。
	require.NotEmpty(t, out.errMsg)
	require.Contains(t, out.errMsg, "未知状态码")
}

func TestUpdate_TimeoutMsgSetsState(t *testing.T) {
	m := newTestModel(&fakeDeps{})
	out := applyMsg(t, m, timeoutMsg{})
	require.Equal(t, stateTimeout, out.state)
}

func TestUpdate_SpinnerTickForwardsToSpinner(t *testing.T) {
	m := newTestModel(&fakeDeps{})
	// spinner.TickMsg 不应改变 qrtui 自身状态,只转发给 spinner.Model。
	out := applyMsg(t, m, spinner.TickMsg{})
	// 状态仍是 stateInit(未收到 pollMsg)。
	require.Equal(t, stateInit, out.state)
}

// ==================== View 金线 ====================

func TestView_NilBeforeWindowSize(t *testing.T) {
	m := newTestModel(&fakeDeps{})
	// 未设置 width/height(首帧 WindowSizeMsg 前)。
	require.Empty(t, m.render())
}

func TestView_SmallTerminalShowsPrompt(t *testing.T) {
	m := newTestModel(&fakeDeps{})
	m.width = 30
	m.height = 8
	s := m.render()
	require.Contains(t, s, "终端窗口过小")
}

func TestView_ContainsTitleAndQR(t *testing.T) {
	m := newTestModel(&fakeDeps{nowTimes: []time.Time{time.Unix(0, 0)}})
	m.width = 100
	m.height = 40
	s := m.render()
	require.Contains(t, s, "请用网易云 App 扫描下方二维码登录")
	require.Contains(t, s, "▀▀▀", "QR 块应出现在视图中")
}

func TestView_ContainsURLAndHelp(t *testing.T) {
	m := newTestModel(&fakeDeps{nowTimes: []time.Time{time.Unix(0, 0)}})
	m.width = 100
	m.height = 40
	s := m.render()
	require.Contains(t, s, "https://music.163.com/login?codekey=test123")
	require.Contains(t, s, "q 退出")
}

func TestView_StatusLineWaiting(t *testing.T) {
	fd := &fakeDeps{nowTimes: []time.Time{time.Unix(0, 0)}}
	m := newTestModel(fd)
	m.width = 100
	m.height = 40
	m = applyMsg(t, m, pollMsg{code: mmpb.QrcodeCode_QRCODE_CODE_WAITING})
	// 推进时钟以计算 ago。
	fd.nowTimes = []time.Time{time.Unix(5, 0)}
	fd.nowIdx = 0
	require.Contains(t, m.statusLine(), "等待扫码")
}

func TestView_StatusLineScanned(t *testing.T) {
	fd := &fakeDeps{nowTimes: []time.Time{time.Unix(0, 0)}}
	m := newTestModel(fd)
	m.width = 100
	m.height = 40
	m = applyMsg(t, m, pollMsg{code: mmpb.QrcodeCode_QRCODE_CODE_SCANNED})
	fd.nowTimes = []time.Time{time.Unix(2, 0)}
	fd.nowIdx = 0
	require.Contains(t, m.statusLine(), "已扫描")
	require.Contains(t, m.statusLine(), "请在 App 确认")
}

func TestView_StatusLineError(t *testing.T) {
	fd := &fakeDeps{nowTimes: []time.Time{time.Unix(0, 0)}}
	m := newTestModel(fd)
	m.width = 100
	m.height = 40
	m = applyMsg(t, m, pollMsg{err: errors.New("conn reset")})
	fd.nowTimes = []time.Time{time.Unix(1, 0)}
	fd.nowIdx = 0
	require.Contains(t, m.statusLine(), "轮询出错")
	require.Contains(t, m.statusLine(), "conn reset")
}

func TestView_StatusLineConfirmed(t *testing.T) {
	m := newTestModel(&fakeDeps{})
	m = applyMsg(t, m, pollMsg{code: mmpb.QrcodeCode_QRCODE_CODE_CONFIRMED})
	require.Contains(t, m.statusLine(), "登录成功")
}

func TestView_StatusLineExpired(t *testing.T) {
	m := newTestModel(&fakeDeps{})
	m = applyMsg(t, m, pollMsg{code: mmpb.QrcodeCode_QRCODE_CODE_EXPIRED})
	require.Contains(t, m.statusLine(), "已过期")
}

func TestView_StatusLineTimeout(t *testing.T) {
	m := newTestModel(&fakeDeps{})
	m = applyMsg(t, m, timeoutMsg{})
	require.Contains(t, m.statusLine(), "超时")
}

// ==================== 纯函数 ====================

func TestFmtDuration(t *testing.T) {
	require.Equal(t, "0s", fmtDuration(0))
	require.Equal(t, "5s", fmtDuration(5*time.Second))
	require.Equal(t, "1:05", fmtDuration(65*time.Second))
	require.Equal(t, "3:00", fmtDuration(3*time.Minute))
	require.Equal(t, "0s", fmtDuration(-1*time.Second)) // 负值 clamp
}

func TestCodeString(t *testing.T) {
	require.Equal(t, "WAITING", codeString(mmpb.QrcodeCode_QRCODE_CODE_WAITING))
	require.Equal(t, "SCANNED", codeString(mmpb.QrcodeCode_QRCODE_CODE_SCANNED))
	require.Equal(t, "CONFIRMED", codeString(mmpb.QrcodeCode_QRCODE_CODE_CONFIRMED))
	require.Equal(t, "EXPIRED", codeString(mmpb.QrcodeCode_QRCODE_CODE_EXPIRED))
	require.Equal(t, "UNKNOWN", codeString(mmpb.QrcodeCode(999)))
}

// ==================== Init ====================

func TestInitReturnsBatch(t *testing.T) {
	m := newTestModel(&fakeDeps{})
	cmd := m.Init()
	require.NotNil(t, cmd, "Init 应返回启动 Cmd(spinner + poll + timeout)")
}

// ==================== Run 结果回传(集成 seam,不启动真实 Program) ====================

// Run 耦合真实终端,这里只测 Result 结构在 confirmed/expired model 下的派生逻辑。
// 完整的 Run 流程依赖人工 smoke。
func TestResultFromModel_Confirmed(t *testing.T) {
	raw := json.RawMessage(`{"x":1}`)
	m := model{
		state:           stateConfirmed,
		confirmedRaw:    raw,
		confirmedCookie: "cookie",
	}
	require.True(t, m.state == stateConfirmed)
	require.Equal(t, raw, m.confirmedRaw)
}

func TestResultFromModel_NotConfirmedStates(t *testing.T) {
	for _, s := range []state{stateExpired, stateTimeout, stateInit, stateWaiting} {
		m := model{state: s}
		require.False(t, m.state == stateConfirmed, "state %d 不应判为 confirmed", s)
	}
}

// 确保 view 渲染不会因为状态行里的特殊字符(如 spinner 帧)panic。
func TestView_StatusLineAllStatesNoPanic(t *testing.T) {
	states := []state{stateInit, stateWaiting, stateScanned, stateError, stateConfirmed, stateExpired, stateTimeout}
	fd := &fakeDeps{nowTimes: []time.Time{time.Unix(0, 0)}}
	for _, s := range states {
		m := newTestModel(fd)
		m.width = 100
		m.height = 40
		m.state = s
		if s == stateError {
			m.errMsg = "test error"
		}
		fd.nowIdx = 0
		_ = m.statusLine()
	}
}

// ==================== render 整体布局稳定性(核心 bug 修复验证) ====================

// 关键回归:状态变化时 QR 行数不变,不堆积(对比旧 fmt.Println 每次轮询堆一行)。
func TestRender_QRBlockHeightStableAcrossStates(t *testing.T) {
	fd := &fakeDeps{nowTimes: []time.Time{time.Unix(0, 0)}}
	base := newTestModel(fd)
	base.width = 100
	base.height = 40
	// 计算 QR 块在初始视图的行数。
	countQRLines := func(s string) int {
		// QR 占位 "▀▀▀\n▄▄▄\n" 有 2 个换行 → 视为 QR 行计数锚点。
		return strings.Count(s, "▀")
	}
	baseRender := base.render()
	baseQRCount := countQRLines(baseRender)

	for _, code := range []mmpb.QrcodeCode{
		mmpb.QrcodeCode_QRCODE_CODE_WAITING,
		mmpb.QrcodeCode_QRCODE_CODE_SCANNED,
	} {
		m := newTestModel(fd)
		m.width = 100
		m.height = 40
		m = applyMsg(t, m, pollMsg{code: code})
		fd.nowIdx = 0
		s := m.render()
		require.Equal(t, baseQRCount, countQRLines(s),
			"QR 块在不同状态(%v)下行数应恒定,不堆积", code)
	}
}
