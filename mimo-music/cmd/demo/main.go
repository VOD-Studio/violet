// cmd/demo 盲文点阵进度条演示(自实现 Progress 渲染器)。
//
// 用法:
//
//	go run ./cmd/demo <command> [flags]
//
// command:
//
//	snapshot   静态快照(多档进度),无动画,看 RenderBar 长相
//	single     单曲下载动画(diff 渲染,无闪烁)
//	multi      批量下载(1 总 bar + 3 worker,✓ 完成态)
//
// 输出走 os.Stderr;TTY 下启动 steady tick + 隐藏光标,非 TTY 只输出终态。
package main

import (
	"flag"
	"fmt"
	"math/rand/v2"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
	"golang.org/x/term"
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
		speed := fs.Float64("speed", 1.0, "下载速度倍率(<1 慢动作)")
		fs.Parse(os.Args[2:])
		runSingle(*speed)
	case "multi":
		fs := flag.NewFlagSet("demo multi", flag.ExitOnError)
		speed := fs.Float64("speed", 1.0, "下载速度倍率")
		fs.Parse(os.Args[2:])
		runMulti(*speed)
	default:
		fmt.Fprintf(os.Stderr, "未知命令 %q\n", cmd)
		usage()
		os.Exit(2)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, `盲文点阵进度条演示(自实现渲染器)

用法:
  go run ./cmd/demo <command> [flags]

command:
  snapshot   静态快照(多档进度),无动画
  single     单曲下载动画
  multi      批量下载(1 总 bar + 3 worker,✓ 完成态)

flags:
  -speed   速度倍率,默认 1.0;0.3 为慢动作

示例:
  go run ./cmd/demo snapshot
  go run ./cmd/demo single
  go run ./cmd/demo multi -speed 0.5`)
}

// termWidth 探测终端宽度,失败回退 80。
func termWidth() int {
	if w, _, err := term.GetSize(int(os.Stderr.Fd())); err == nil && w > 0 {
		return w
	}
	return 80
}

func isTTY() bool { return term.IsTerminal(int(os.Stderr.Fd())) }

// watchResize 监听 SIGWINCH:终端拉伸时把新宽度推给 Progress。
// kit 不依赖 signal/fd,监听责任在调用方(这里)。
func watchResize(p *kit.Progress) {
	ch := make(chan os.Signal, 1)
	signal.Notify(ch, syscall.SIGWINCH)
	go func() {
		for range ch {
			if w, _, err := term.GetSize(int(os.Stderr.Fd())); err == nil && w > 0 {
				p.SetWidth(w)
			}
		}
	}()
}

func runSingle(speed float64) {
	width := termWidth()
	p := kit.NewProgress(os.Stderr, width, isTTY(), kit.WithProgressColor(true))
	bar := p.AddBar(3_400_000, "Beyond - 海阔天空.mp3")
	p.Start()
	watchResize(p)

	scale := speed
	if scale < 0.1 {
		scale = 0.1
	}
	now := time.Now()
	deadline := now.Add(time.Duration(float64(4*time.Second) / scale))
	for time.Now().Before(deadline) && bar.Current < bar.Total {
		chunk := int64(rand.IntN(160_000) + 40_000)
		bar.Incr(chunk, time.Now())
		time.Sleep(time.Duration(float64(80*time.Millisecond) / scale))
	}
	bar.Complete(time.Now())
	time.Sleep(200 * time.Millisecond) // 让完成帧渲染
	p.Wait()
}

func runMulti(speed float64) {
	width := termWidth()
	p := kit.NewProgress(os.Stderr, width, isTTY(), kit.WithProgressColor(true))

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
	watchResize(p)

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
