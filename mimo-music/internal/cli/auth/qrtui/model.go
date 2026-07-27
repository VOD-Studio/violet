// Package qrtui 提供扫码登录的 bubbletea 全屏界面。
//
// 替代旧 runLogin 的 fmt.Println 轮询堆行(状态行无限累积,长时间等待或
// 屏幕小时把二维码顶出视野)。bubbletea 的 View() 是纯函数:二维码块固定
// 输出,spinner + 状态行原地刷新,布局恒定不抖动。
//
// 形态:inline(非 alt-screen)——登录成功后二维码保留在终端历史可追溯;
// 退出后控制权交回。CONFIRMED 的会话持久化由调用方在 Program 退出后执行,
// 避免 persistLogin 的 stdout 打印 clobber 视图。
package qrtui

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"time"

	tea "charm.land/bubbletea/v2"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
)

// 轮询参数(沿旧 runLogin:2s 间隔、3min 超时)。
const (
	pollInterval = 2 * time.Second
	pollTimeout  = 3 * time.Minute
)

// 终端最小尺寸:低于此值给「终端过小」提示,不堆积状态行。
const (
	minWidth  = 60
	minHeight = 20
)

// Result Run 的返回。Confirmed=true 时 Raw/SetCookie 有效,调用方据此持久化。
type Result struct {
	Confirmed bool
	Raw       json.RawMessage // CONFIRMED 响应,传给 persistLogin 提取 UserID
	SetCookie string          // Set-Cookie 头,会话信件
}

// Deps 注入依赖(测试 seam)。Check 是对 CheckQrcode 的封装,内部调 kit.RawDo
// + model.DecodeQrcodeStatus;调用方负责 ctx 的 cookie 注入。
type Deps struct {
	// QR renderQR 的输出(已含 quiet zone 与半高方块),固定不变。
	QR string
	// QRURL 二维码原始 URL(展示给无法识别二维码的终端用户)。
	QRURL string
	// Check 轮询一次扫码状态。返回 (code, raw, setCookie, err):
	//   - code=WAITING/SCANNED/CONFIRMED/EXPIRED
	//   - raw/setCookie 仅 CONFIRMED 有效(持久化用)
	//   - err 非空时进入 stateError,自动重试
	Check func(ctx context.Context) (code mmpb.QrcodeCode, raw json.RawMessage, setCookie string, err error)
	// PollCtx 轮询上下文(注入 cookie)。默认 context.Background,生产由调用方传 CookieCtx。
	PollCtx context.Context
	// Now 时钟注入(测试「Xs 前检查」展示)。
	Now func() time.Time
}

// state 二维码登录的状态机。stateConfirmed/stateExpired/stateTimeout 是终态,
// 收到后 Update 返回 tea.Quit。
type state int

const (
	stateInit      state = iota // 首帧(尚未收到任何 pollMsg)
	stateWaiting                // ⠋ 等待扫码
	stateScanned                // ⠙ 已扫描,待 App 确认
	stateError                  // ⚠ 轮询出错(非终态,自动重试)
	stateConfirmed              // ✅ 登录成功(终态,已填充 raw/cookie)
	stateExpired                // ✗ 二维码已过期(终态)
	stateTimeout                // ⏱ 轮询超时(终态)
)

// 动画参数(对齐 oh-my-pi Loader 源码):
//   - spinner 每 80ms 推进一帧(SPINNER_ADVANCE_MS)
//   - shimmer 30fps 重绘(RENDER_INTERVAL_MS = 1000/30)
// 两个独立驱动:spinner 换帧 + shimmer 亮带推进。取较短的 33ms tick 同时驱动两者。
const animInterval = 33 * time.Millisecond

// spinnerFrames unicode preset 的 status 帧(oh-my-pi 默认符号集)。
var spinnerFrames = []string{"⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"}

// spinnerAccent spinner 帧的染色(紫粉调色板的 high 色)。
const spinnerAccent = "#ee6ff8"

// model bubbletea Model。所有 IO 经 Deps 注入,Update/View 是纯函数(可测)。
//
// 加载态(oh-my-pi Loader 源码同款):spinner 帧(accent 色)+ 空格 +
// shimmer 文字(亮带从左向右扫过,带外 dim 可读)。spinner 每 80ms 换帧,
// shimmer 亮带按 30cells/s 推进——两个独立动画。
type model struct {
	deps   Deps
	state  state
	errMsg string // stateError 时展示
	width  int
	height int

	// 动画驱动:animStart 是动画起始时刻,now 是最近一次 tick 时刻。
	// spinner 帧 = (now-animStart)/80ms % len;shimmer 亮带位置 = (now-animStart)。
	// 用时间而非帧计数,保证 spinner 80ms 节奏与 shimmer 30cells/s 都精确。
	animStart time.Time
	now       time.Time

	// compiledPalette shimmer 调色板的预编译 ANSI 串(避免逐帧重复解析)。
	compiled compiledPalette

	// CONFIRMED 时填充,Run 退出后回传调用方。
	confirmedRaw  json.RawMessage
	confirmedCookie string
}

// newModel 构造初始 Model。
func newModel(deps Deps) model {
	if deps.Now == nil {
		deps.Now = time.Now
	}
	if deps.PollCtx == nil {
		deps.PollCtx = context.Background()
	}
	t := deps.Now()
	return model{
		deps:      deps,
		state:     stateInit,
		animStart: t,
		now:       t,
		compiled:  compile(purplePalette),
	}
}

// Init 启动动画 tick + 首次轮询 + 超时定时器。
func (m model) Init() tea.Cmd {
	return tea.Batch(animTick(), poll(m.deps), scheduleTimeout())
}

// animTickMsg 推进动画一帧(spinner 换帧 + shimmer 亮带推进)。
type animTickMsg struct{}

// Run 接管终端,返回登录结果。caller 在返回后按 Confirmed 决定是否持久化。
//
// output 默认 os.Stdout;测试可注入 bytes.Buffer(但 tea.Program 仍耦合终端,
// 真实交互需 TTY——非 TTY 由调用方提前守卫,见 runLogin)。
func Run(deps Deps, output io.Writer) (Result, error) {
	p := tea.NewProgram(newModel(deps), tea.WithOutput(output))
	final, err := p.Run()
	if err != nil {
		return Result{}, fmt.Errorf("登录界面启动失败: %w", err)
	}
	m, ok := final.(model)
	if !ok {
		return Result{}, fmt.Errorf("登录界面返回意外类型 %T", final)
	}
	return Result{
		Confirmed:  m.state == stateConfirmed,
		Raw:        m.confirmedRaw,
		SetCookie:  m.confirmedCookie,
	}, nil
}
