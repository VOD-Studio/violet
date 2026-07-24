package recall

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"
)

// MaxLines 是召回池 JSONL 的容量上限,超限 drop oldest(CONTEXT.md 召回池持久化段)。
// 约 80KB(每行 ~80B),单用户工具足够;打分与裁剪解耦,只有退出保留窗口的条目才丢。
const MaxLines = 1000

// Pool 是召回池的本地存储,落 append-only JSONL。
//
// 一个 Pool 绑定一个文件路径(由 kit.HistoryPath() 提供,PRD-0015 #44 已建可注入 seam)。
// Append 追加事件(原子 tmp+rename 保证主文件不被中断污染);Load 读全事件流
// (单行损坏只丢该行);TopN 读 + frecency 打分返回 top N 候选。
//
// Pool 不负责埋点触发(那在 kit.Record helper,#46 方案 c)与远端预热(那在 warmer,
// 后台 fire-and-forget)——本类型只管本地 JSONL 读写。
type Pool struct {
	// path 返回 JSONL 文件路径。函数而非字符串,使测试能用 kit 的可注入 userConfigDir
	// 间接重定向(默认绑 kit.HistoryPath)。
	path func() (string, error)
	// now 返回当前时间,默认 time.Now;测试注入保证时段桶确定性。
	now func() time.Time
}

// NewPool 用给定路径函数构造 Pool(now 默认 time.Now)。
func NewPool(path func() (string, error)) *Pool {
	return &Pool{path: path, now: time.Now}
}

// WithClock 注入时钟(测试用),返回新 Pool。
func (p *Pool) WithClock(now func() time.Time) *Pool {
	return &Pool{path: p.path, now: now}
}

// Append 把事件追加到 JSONL,并在超容量时 drop oldest。
//
// 原子写:不直接 append 到主文件(避免并发/中断留半行),而是读全量 + 追加新事件 +
// 裁剪 + 写 tmp + rename。musicctl 是 run-and-exit 单进程,无并发,但仍用 tmp+rename
// 保证进程被杀时主文件完整(沿 kit.SaveSession 模式)。
//
// 单次 Append 多个事件时一起裁剪。失败返回 error(调用方决定是否告警,埋点失败不阻塞主命令)。
func (p *Pool) Append(events ...Event) error {
	if len(events) == 0 {
		return nil
	}
	path, err := p.path()
	if err != nil {
		return err
	}
	// 读现有事件(单行损坏容忍:跳过坏行)。
	existing, _ := p.loadRaw(path)
	all := append(existing, events...)
	// 裁剪到 MaxLines(drop oldest)。
	if len(all) > MaxLines {
		all = all[len(all)-MaxLines:]
	}
	// 序列化全部为 JSONL。
	var buf []byte
	for _, e := range all {
		b, err := json.Marshal(e)
		if err != nil {
			return fmt.Errorf("序列召回事件失败: %w", err)
		}
		buf = append(buf, b...)
		buf = append(buf, '\n')
	}
	// 原子写:tmp + rename + chmod 0600。
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, buf, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// Load 读全事件流,按 frecency 降序返回候选。
//
// 单行损坏只丢该行(坏行跳过),不报错——召回池历史可被 grep/tail 直读,容忍人工编辑。
// 文件不存在视为空池(新用户)。
func (p *Pool) Load() ([]Ranked, error) {
	events, err := p.loadEvents()
	if err != nil {
		return nil, err
	}
	return Score(events, p.now()), nil
}

// TopN 读事件流并返回 frecency top N 候选(补全/recent 用)。
// N<=0 或不足时返回实际数量。
func (p *Pool) TopN(n int) ([]Ranked, error) {
	ranked, err := p.Load()
	if err != nil {
		return nil, err
	}
	if n <= 0 || n > len(ranked) {
		return ranked, nil
	}
	return ranked[:n], nil
}

// loadEvents 读 JSONL 全部合法事件(跳过坏行)。文件不存在返回 nil, nil。
func (p *Pool) loadEvents() ([]Event, error) {
	path, err := p.path()
	if err != nil {
		return nil, err
	}
	return p.loadRaw(path)
}

// loadRaw 读文件并解析 JSONL,单行损坏跳过(返回已解析的好行 + 可能的 io 错误)。
func (p *Pool) loadRaw(path string) ([]Event, error) {
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil // 新用户,空池
		}
		return nil, err
	}
	defer f.Close()
	var events []Event
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 64*1024), 1024*1024) // 单行上限 1MB,防超长行 OOM
	for sc.Scan() {
		line := sc.Bytes()
		if len(line) == 0 {
			continue
		}
		var e Event
		if err := json.Unmarshal(line, &e); err != nil {
			continue // 单行损坏跳过,不破坏全文件
		}
		if e.ID == 0 {
			continue // id 缺失视为无效,跳过
		}
		events = append(events, e)
	}
	if err := sc.Err(); err != nil && !errors.Is(err, io.EOF) {
		return events, err
	}
	return events, nil
}
