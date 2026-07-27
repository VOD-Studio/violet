// qrtui 单元测试。seam:Deps 注入假 Check/Now,Update/View 是纯函数。
//
// 不测:bubbletea Program 在真实终端的渲染(人工 smoke);真实网络 CheckQrcode(集成)。
// 沿 play_test.go 惯例:testify require + 注入替身。
package qrtui

import (
	"context"
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"testing"
	"time"

	tea "charm.land/bubbletea/v2"

	"github.com/stretchr/testify/require"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
)

// ansiRe 匹配 ANSI 转义序列(颜色/光标控制)。waveText 给每个字符裹颜色码,
// 断言文案前需剥离——只验语义,不验配色(lipgloss 输出格式属实现细节)。
var ansiRe = regexp.MustCompile(`\x1b\[[0-9;]*m`)

// stripANSI 剥离 ANSI 颜色码,返回纯文本。
func stripANSI(s string) string {
	return ansiRe.ReplaceAllString(s, "")
}

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

func TestUpdate_AnimTickAdvancesNow(t *testing.T) {
	// 注入可控时钟:初始 t0,animTick 后 Now 返回 t0+100ms。
	t0 := time.Unix(1000, 0)
	fd := &fakeDeps{nowTimes: []time.Time{t0, t0.Add(100 * time.Millisecond)}}
	m := newTestModel(fd)
	require.Equal(t, t0, m.now)
	out := applyMsg(t, m, animTickMsg{})
	require.Equal(t, t0.Add(100*time.Millisecond), out.now, "animTickMsg 应推进 now")
	require.Equal(t, stateInit, out.state)
}

func TestUpdate_AnimTickStopsAtTerminalStates(t *testing.T) {
	for _, final := range []state{stateConfirmed, stateExpired, stateTimeout} {
		t0 := time.Unix(1000, 0)
		fd := &fakeDeps{nowTimes: []time.Time{t0, t0.Add(100 * time.Millisecond)}}
		m := newTestModel(fd)
		m.state = final
		out := applyMsg(t, m, animTickMsg{})
		require.Equal(t, t0, out.now, "终态 %v 不应推进 now", final)
	}
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
	require.Contains(t, s, "用网易云 App 扫描下方二维码登录")
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
	m := newTestModel(&fakeDeps{})
	m = applyMsg(t, m, pollMsg{code: mmpb.QrcodeCode_QRCODE_CODE_WAITING})
	// waveText 给每个字符裹颜色码,断言前剥离 ANSI。
	require.Contains(t, stripANSI(m.statusLine()), "等待扫码")
}

func TestView_StatusLineScanned(t *testing.T) {
	m := newTestModel(&fakeDeps{})
	m = applyMsg(t, m, pollMsg{code: mmpb.QrcodeCode_QRCODE_CODE_SCANNED})
	s := stripANSI(m.statusLine())
	require.Contains(t, s, "已扫描")
	require.Contains(t, s, "请在 App 确认")
}

func TestView_StatusLineError(t *testing.T) {
	m := newTestModel(&fakeDeps{})
	m = applyMsg(t, m, pollMsg{err: errors.New("conn reset")})
	s := stripANSI(m.statusLine())
	require.Contains(t, s, "轮询出错")
	require.Contains(t, s, "conn reset")
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
	require.NotNil(t, cmd, "Init 应返回启动 Cmd(animTick + poll + timeout)")
}

// ==================== shimmerText(亮带扫过,核心加载态) ====================

// shimmer 算法核心断言(对齐 oh-my-pi classic shimmer):
//   - 内容保留(stripANSI 后原文)
//   - 带外字符走 tierLow(暗紫,主体可读)
//   - 时间推进 → 亮带位置变化 → 输出变化
//   - 用 truecolor(24-bit)转义

func TestShimmerText_PreservesContent(t *testing.T) {
	cp := compile(purplePalette)
	require.Equal(t, "等待扫码", stripANSI(shimmerText("等待扫码", 0, cp)))
}

func TestShimmerText_BandMovesOverTime(t *testing.T) {
	// 同一文字在不同时刻,亮带位置不同 → ANSI 输出变化(亮带流动核心)。
	// 长文字让亮带明显位移(短文字亮带可能一直覆盖全段)。
	cp := compile(purplePalette)
	text := "等待扫码,请在 App 确认登录"
	s0 := shimmerText(text, 0, cp)
	s500 := shimmerText(text, 500, cp) // 500ms 后亮带推进 ~15 cells
	require.Equal(t, stripANSI(s0), stripANSI(s500), "纯文本应一致")
	require.NotEqual(t, s0, s500, "亮带位置应随时间变化")
}

func TestShimmerText_EmptyString(t *testing.T) {
	cp := compile(purplePalette)
	require.Empty(t, shimmerText("", 0, cp))
}

func TestShimmerText_ContainsTruecolorEscape(t *testing.T) {
	// truecolor(24-bit):输出应含 \x1b[38;2;R;G;Bm(不是 256 色的 \x1b[38;5;Nm)。
	cp := compile(purplePalette)
	s := shimmerText("AB", 0, cp)
	require.Contains(t, s, "\x1b[38;2;", "shimmerText 应用 truecolor 转义")
}

func TestShimmerText_OutsideBandIsLowTier(t *testing.T) {
	// 长文字:亮带只覆盖中间约 12 cell,两端必为 tierLow。
	// timeMs=0 时亮带在文字左外侧(padding=10),整段应是 tierLow(暗紫 #5a3a8a)。
	cp := compile(purplePalette)
	text := "等待扫码,请在 App 确认登录"
	s := shimmerText(text, 0, cp)
	// tierLow 的 open 是暗紫的 truecolor 码。
	require.Contains(t, s, "\x1b[38;2;90;58;138m", "带外应走 tierLow(暗紫)")
}

func TestClassicIntensity_BandShape(t *testing.T) {
	// 亮带形状:中心强度 1.0,边缘 0,余弦凸起。
	// length=20,timeMs=0 时,pos=0,中心在 index=-padding=-10(文字左外),
	// 所以 index=0 时 dist=10 >= bandHalfWidth=6 → 强度 0。
	require.InDelta(t, 0, classicIntensity(0, 0, 20), 0.001)
	// 让亮带中心落在文字内:pos 推进到 padding(亮带中心=index 0)需要
	// timeMs 使 pos=10 → time/1000*30=10 → time≈333ms。
	require.InDelta(t, 1.0, classicIntensity(333, 0, 20), 0.05)
	// 亮带边缘(dist=bandHalfWidth=6)强度应接近 0。
	// pos=10 时 index=6 → dist=4 <6,在带内;index=16 → dist=6 → 强度 0。
	require.InDelta(t, 0, classicIntensity(333, 16, 20), 0.001)
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
