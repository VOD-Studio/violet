// cmd/demo 盲文点阵进度条演示(展示 kit 正式 API 用法)。
//
// 用法:
//
//	go run ./cmd/demo <command> [flags]
//
// command:
//
//	snapshot   静态快照(多档进度),无动画,看 RenderBar 长相
//	single     单曲下载:Spinner(缓冲) + Progress(下载) + Warnf(元数据警告)
//	multi      批量下载(1 总 bar + 3 worker,♪ 完成态)
//
// flags:
//
//	-json     模拟全局 --json(三态抑制:进度完全静默,结果走 stdout)
//	-speed    速度倍率,默认 1.0;0.3 为慢动作
//
// 通过 Kit 工厂(k.NewProgress/k.NewSpinner)展示正式 API:
// 命令层不用自己判断 TTY/--json,工厂内部封装三态规矩。
package main

import (
	"flag"
	"fmt"
	"math/rand/v2"
	"os"
	"time"

	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	cmd := os.Args[1]
	switch cmd {
	case "snapshot":
		runSnapshot()
	case "single":
		fs := flag.NewFlagSet("demo single", flag.ExitOnError)
		jsonMode := fs.Bool("json", false, "模拟全局 --json(进度静默)")
		speed := fs.Float64("speed", 1.0, "下载速度倍率(<1 慢动作)")
		fs.Parse(os.Args[2:])
		runSingle(*jsonMode, *speed)
	case "multi":
		fs := flag.NewFlagSet("demo multi", flag.ExitOnError)
		jsonMode := fs.Bool("json", false, "模拟全局 --json(进度静默)")
		speed := fs.Float64("speed", 1.0, "下载速度倍率")
		fs.Parse(os.Args[2:])
		runMulti(*jsonMode, *speed)
	default:
		fmt.Fprintf(os.Stderr, "未知命令 %q\n", cmd)
		usage()
		os.Exit(2)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, `盲文点阵进度条演示(展示 kit 正式 API)

用法:
  go run ./cmd/demo <command> [flags]

command:
  snapshot   静态快照(多档进度),无动画
  single     单曲下载:Spinner(缓冲)+Progress(下载)+Warnf(警告)
  multi      批量下载(1 总 bar + 3 worker,♪ 完成态)

flags:
  -json     模拟全局 --json(进度静默,结果走 stdout)
  -speed    速度倍率,默认 1.0;0.3 为慢动作

示例:
  go run ./cmd/demo snapshot
  go run ./cmd/demo single
  go run ./cmd/demo single -json      # 展示 --json 三态抑制
  go run ./cmd/demo multi -speed 0.5`)
}

// newKit 构造 Kit 实例(展示命令层用法)。
// jsonMode 模拟全局 --json:Kit.JSON=true 时 NewProgress/NewSpinner 完全静默。
func newKit(jsonMode bool) *kit.Kit {
	return &kit.Kit{JSON: jsonMode}
}

// runSingle 单曲下载:展示 Spinner(缓冲) + Progress(下载) + Warnf(元数据警告)。
// 模拟真实 song download 流程:缓冲音源 → 流式下载 → 元数据写入(可能失败警告)。
func runSingle(jsonMode bool, speed float64) {
	k := newKit(jsonMode)

	// 1. 缓冲阶段:Spinner(不可量化等待,如解析音源)。
	sp := k.NewSpinner("解析音源")
	sp.Start()
	time.Sleep(800 * time.Millisecond) // 模拟解析
	sp.Stop("✓ level=1 mp3 320kbps")

	// 2. 下载阶段:Progress(可量化进度)。
	p := k.NewProgress()
	bar := p.AddBar(3_400_000, "Beyond - 海阔天空.mp3")
	p.Start()

	scale := speed
	if scale < 0.1 {
		scale = 0.1
	}
	deadline := time.Now().Add(time.Duration(float64(4*time.Second) / scale))
	for time.Now().Before(deadline) && bar.Current < bar.Total {
		chunk := int64(rand.IntN(160_000) + 40_000)
		bar.Incr(chunk, time.Now())
		time.Sleep(time.Duration(float64(80 * time.Millisecond) / scale))
	}
	bar.Complete(time.Now())
	time.Sleep(200 * time.Millisecond) // 让完成帧渲染
	p.Wait()

	// 3. 元数据写入(可能失败):Warnf 非阻塞警告。
	// 模拟 30% 概率元数据失败(PRD-0013 行 114 场景)。
	if rand.Float64() < 0.3 {
		k.Warnf("⚠ 元数据写入失败,文件已保存")
	}

	// 4. 结果输出(stdout,走渲染层)。--json 模式这里应 protojson,demo 简化用文本。
	fmt.Println("文件     Beyond - 海阔天空.mp3")
	fmt.Println("大小     3.2 MB")
}

// runMulti 批量下载:1 总 bar + 3 worker 并发,♪ 完成态。
func runMulti(jsonMode bool, speed float64) {
	k := newKit(jsonMode)
	p := k.NewProgress()

	songs := []struct {
		name string
		size int64
	}{
		{"Beyond - 海阔天空", 3_400_000},
		{"周杰伦 - 晴天", 4_100_000},
		{"陈奕迅 - 浮夸", 4_500_000},
		{"田馥甄 - 小幸运", 3_800_000},
		{"林俊杰 - 江南", 3_600_000},
		{"王菲 - 红豆", 4_200_000},
		{"李宗盛 - 山丘", 3_900_000},
		{"朴树 - 平凡之路", 4_600_000},
		{"五月天 - 志明与春娇", 3_700_000},
	}
	totalSize := int64(0)
	for _, s := range songs {
		totalSize += s.size
	}

	// 总 bar(顶部,显示 ETA)。prefix ♫ 由 renderLine 对 IsTotal 自动添加,label 不再带。
	totalBar := p.AddBar(totalSize, "我喜欢的音乐")
	totalBar.IsTotal = true

	// 子 bar(每首一个,初始 waiting)。
	type subBar struct {
		b    *kit.Bar
		size int64
	}
	subs := make([]subBar, len(songs))
	for i, s := range songs {
		subs[i] = subBar{b: p.AddBar(s.size, s.name), size: s.size}
	}
	p.Start()

	// worker 池:3 并发。
	const workers = 3
	jobs := make(chan int, len(songs))
	for i := range songs {
		jobs <- i
	}
	close(jobs)
	done := make(chan struct{}, workers)
	for w := 0; w < workers; w++ {
		go func() {
			defer func() { done <- struct{}{} }()
			for idx := range jobs {
				sub := subs[idx]
				for sub.b.Current < sub.size {
					chunk := int64(rand.IntN(140_000) + 30_000)
					sub.b.Incr(chunk, time.Now())
					totalBar.Incr(chunk, time.Now())
					localSpeed := speed * (0.6 + rand.Float64()*0.8)
					time.Sleep(time.Duration(float64(70*time.Millisecond) / max(localSpeed, 0.1)))
				}
				sub.b.Complete(time.Now())
			}
		}()
	}
	for w := 0; w < workers; w++ {
		<-done
	}
	totalBar.Complete(time.Now())
	time.Sleep(200 * time.Millisecond)
	p.Wait()

	fmt.Fprintln(os.Stderr, "\n歌单下载完成:我喜欢的音乐")
	fmt.Fprintln(os.Stderr, "  成功   9")
	fmt.Fprintln(os.Stderr, "  跳过   0")
	fmt.Fprintln(os.Stderr, "  失败   0")
}

func runSnapshot() {
	width := 40
	progresses := []float64{0.12, 0.38, 0.66, 1.0}
	fmt.Println("=== 纯文本降级 ===")
	fmt.Println("(每行 4 档:12%  38%  66%  100%)")
	fmt.Print("  braille  ")
	for _, pct := range progresses {
		fmt.Print(kit.RenderBar(int64(pct*1000), 1000, width, false))
		fmt.Print("  ")
	}
	fmt.Println()
	fmt.Println("\n=== true color 渐变(青绿→暖橙) ===")
	fmt.Print("  braille  ")
	for _, pct := range progresses {
		fmt.Print(kit.RenderBar(int64(pct*1000), 1000, width, true))
		fmt.Print("  ")
	}
	fmt.Println()
}
