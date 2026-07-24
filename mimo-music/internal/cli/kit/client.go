// Package kit 是 musicctl 命令层的共享工具包。
//
// 封装 engine 调用、登录会话读写、输出与确认交互,各领域命令包(song/playlist/...)
// 只依赖本包,不直接碰 engine 细节。
package kit

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"

	"golang.org/x/term"
	"google.golang.org/protobuf/proto"

	"github.com/VOD-Studio/mimo-music/internal/cache"
	"github.com/VOD-Studio/mimo-music/internal/cli/recall"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
)

// ErrNotLogin 未登录哨兵错误,Execute 据此映射退出码 3。
var ErrNotLogin = errors.New("未登录")

// ErrUsage 用法哨兵错误(flag 解析失败、非 TTY 写操作无 --yes 等),Execute 映射退出码 2。
var ErrUsage = errors.New("用法错误")

// Kit 持有命令层共享的运行时依赖与全局输出状态。
type Kit struct {
	eng *engine.Engine

	// JSON 为 true 时强制 protojson 输出(全局 --json);管道时无需设置,自动回退。
	JSON bool
	// Yes 为 true 时写操作跳过交互确认(全局 --yes)。
	Yes bool
	// Out 结果输出 writer,默认 os.Stdout(测试可替换)。
	Out io.Writer
	// Err 警告/进度输出 writer,默认 os.Stderr(测试可替换)。
	// 进度类(ProgressBar/Spinner)和一次性警告(Warnf)都走这里,
	// 不污染 stdout(结果数据流),脚本管道友好。
	Err io.Writer

	// pool 是召回池,补全与 recent 共用。New() 默认初始化(指向 HistoryPath);
	// 测试可替换为 t.TempDir() 路径的 Pool。nil 时 Record 静默跳过。
	pool *recall.Pool
}

// New 创建 Kit。engine 无缓存、无 session 池,纯转发到网易云。
// 召回池默认指向 kit.HistoryPath()(PRD-0015 #44 可注入路径)。
func New() *Kit {
	return &Kit{
		eng:  engine.New(engine.WithCache(cache.Noop{})),
		Out:  os.Stdout,
		pool: recall.NewPool(HistoryPath),
	}
}

// out 返回输出 writer(未设置时回退 os.Stdout)。
func (k *Kit) out() io.Writer {
	if k.Out == nil {
		return os.Stdout
	}
	return k.Out
}

// OutWriter 返回结果输出 writer(导出版本,供命令层直接写 stdout)。
// 大多数命令走 Render(自动三态);少数非 proto 结果(如 download 文件信息)
// 用这个直接写,配合 --json 自行处理双态。
func (k *Kit) OutWriter() io.Writer { return k.out() }

// err 返回警告/进度 writer(未设置时回退 os.Stderr)。
func (k *Kit) err() io.Writer {
	if k.Err == nil {
		return os.Stderr
	}
	return k.Err
}

// Warnf 格式化打印一次性警告到 stderr。
//
// 用于非阻塞提示(如「⚠ 元数据写入失败,文件已保存」,exit 0)。
// 所有模式都输出:警告不是结果数据,--json/非 TTY 也不抑制
// (脚本作者需要看到警告判断是否可信)。
func (k *Kit) Warnf(format string, args ...any) {
	fmt.Fprintf(k.err(), format+"\n", args...)
}

// NewProgress 创建进度条渲染器,内部封装三态规矩(PRD-0012 输出层)。
//
// 命令层调 k.NewProgress() 即可,不用自己判断 TTY/--json:
//   - --json:输出走 io.Discard,完全静默(结果走 protojson,进度文本是污染)。
//   - 非 TTY(管道):tty=false,Start 不启动 tick,Wait 输出终态(脚本看最终结果)。
//   - TTY:正常渲染,输出走 err(stderr),探测终端宽度 + true color。
//
// 进度类走 stderr 不污染 stdout(结果数据流),与 Warnf 一致。
func (k *Kit) NewProgress() *Progress {
	// --json:完全静默。
	if k.JSON {
		return NewProgress(io.Discard, 80, false)
	}
	tty := stderrIsTTY()
	width := 80
	if tty {
		if w, _, err := term.GetSize(int(os.Stderr.Fd())); err == nil && w > 0 {
			width = w
		}
	}
	opts := []ProgressOption{WithProgressColor(tty)}
	if tty {
		opts = append(opts, WithProgressWidthSource(func() int {
			w, _, err := term.GetSize(int(os.Stderr.Fd()))
			if err != nil || w <= 0 {
				return width
			}
			return w
		}))
	}
	return NewProgress(k.err(), width, tty, opts...)
}

// NewSpinner 创建转圈指示器,内部封装三态规矩(同 NewProgress)。
//
//   - --json:返回的 Spinner 输出走 io.Discard,完全静默。
//   - 非 TTY:tty=false,Start 无操作,Stop 终态仍输出(有用信息)。
//   - TTY:正常转圈,输出走 err(stderr)。
//
// opts 透传给底层 NewSpinner(如 WithSpinnerLabelFunc 动态 label)。
func (k *Kit) NewSpinner(label string, opts ...SpinnerOption) *Spinner {
	if k.JSON {
		return NewSpinner(io.Discard, label, false, opts...)
	}
	return NewSpinner(k.err(), label, stderrIsTTY(), opts...)
}

// CookieCtx 把当前生效的 cookie 注入 context(无则注入空)。
func (k *Kit) CookieCtx() context.Context {
	return engine.WithCookie(context.Background(), k.CurrentCookie())
}

// RawDo 执行一个 Meta + 参数 形式的原始调用(动态 path / 写接口用)。
func (k *Kit) RawDo(ctx context.Context, meta engine.Meta, params map[string]any) (json.RawMessage, string, error) {
	return k.eng.RawDoWithCookieAndInput(ctx, meta, params)
}

// Exec 执行一个声明式 endpoint(注入当前 cookie)。
// 是 service 包 executeOverride 的等价物:复制而非 import,
// 因为 service 包还装配了 gRPC 相关类型,这里只要纯执行逻辑。
func Exec[Req, Resp any](k *Kit, ctx context.Context, ep *engine.Endpoint[Req, Resp], req Req) (Resp, error) {
	params, err := ep.MapRequest(req)
	if err != nil {
		var zero Resp
		return zero, err
	}
	meta := ep.Meta
	if ep.PathFunc != nil {
		meta.Path = ep.PathFunc(req)
	}
	raw, _, err := k.RawDo(ctx, meta, params)
	if err != nil {
		var zero Resp
		return zero, err
	}
	return ep.MapResponse(req, raw)
}

// RequireLogin 检查当前有可用的登录态(环境变量或本地会话文件)。
// 未登录返回包装了 ErrNotLogin 的错误,Execute 映射退出码 3。
func (k *Kit) RequireLogin() error {
	if k.CurrentCookie() == "" {
		return fmt.Errorf("%w:先运行 `musicctl login` 扫码登录(也可用 NETEASE_COOKIE 环境变量临时指定 cookie)", ErrNotLogin)
	}
	return nil
}

// RenderExec 执行声明式 endpoint 并按三态规则输出(读命令通用)。
func RenderExec[Req any, Resp proto.Message](k *Kit, ep *engine.Endpoint[Req, Resp], req Req) error {
	resp, err := Exec(k, k.CookieCtx(), ep, req)
	if err != nil {
		return err
	}
	return k.Render(resp)
}
