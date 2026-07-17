// cmd/demo 盲文点阵进度条演示。
//
// 用法:
//
//	go run ./cmd/demo <command> [flags]
//
// command:
//
//	snapshot   静态快照(多档进度 + 完成态),无动画,看盲文点阵与渐变长相
//	single     单曲下载动画
//	multi      批量下载(1 总 bar + 3 worker 并发)
//
// 输出走 os.Stderr(mpb 的 cwriter 需 *os.File 类型断言才能正确识别 TTY)。
// TTY 下 mpb 原生多 bar 原地刷新(ANSI 光标上移重绘);非 TTY 自动只输出终态。
package main

import (
	"flag"
	"fmt"
	"math/rand/v2"
	"os"
	"time"

	"github.com/vbauerster/mpb/v8"
	"github.com/vbauerster/mpb/v8/decor"

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
		color := fs.Bool("color", true, "启用 24-bit true color 渐变")
		speed := fs.Float64("speed", 1.0, "下载速度倍率(<1 慢动作)")
		fs.Parse(os.Args[2:])
		runSingle(*color, *speed)
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
	fmt.Fprintln(os.Stderr, `盲文点阵进度条演示

用法:
  go run ./cmd/demo <command> [flags]

command:
  snapshot   静态快照(多档进度 + 完成态),无动画
  single     单曲下载动画(防闪烁同步刷新)
  multi      批量下载(1 总 bar + 3 worker 并发)

flags:
  -color   true color 渐变开关(仅 single;默认 true)
  -speed   速度倍率,默认 1.0;0.3 为慢动作

示例:
  go run ./cmd/demo snapshot
  go run ./cmd/demo single
  go run ./cmd/demo single -speed 0.4 -color=false
  go run ./cmd/demo multi`)
}

// newProgress 构造 mpb.Progress。
//
// 直接用 os.Stderr,让 mpb 的 cwriter 正确识别 TTY(它只认 *os.File 类型断言)。
// TTY 下 mpb 原生多 bar 会原地刷新(ANSI 光标上移重绘),非 TTY 自动只输出终态。
// 不再用 syncWriter 包裹——它与 mpb 的"画帧→移动光标准备下次覆盖"模型冲突,
// 会破坏原地刷新(实测每帧堆叠成新行)。防闪烁留待后续用更高刷新率 + 终端原生能力处理。
func newProgress(width int) *mpb.Progress {
	return mpb.New(
		mpb.WithOutput(os.Stderr),
		mpb.WithRefreshRate(120*time.Millisecond),
		mpb.WithWidth(width),
	)
}

func runSingle(color bool, speed float64) {
	p := newProgress(48)

	total := int64(3_400_000) // 3.4 MB
	bar := p.MustAdd(total,
		kit.BrailleFiller{Color: color},
		mpb.PrependDecorators(
			decor.Name("下载 ", decor.WC{W: 4, C: decor.DSyncWidth}),
			decor.Name("Beyond - 海阔天空.mp3", decor.WC{W: 28, C: decor.DSyncWidth | decor.DindentRight}),
		),
		mpb.AppendDecorators(
			decor.CountersKibiByte(" %6.1f / %6.1f ", decor.WCSyncSpace),
			decor.NewPercentage(" %3d ", decor.WCSyncSpace),
			decor.EwmaSpeed(decor.SizeB1024(0), " %6.1f ", 0.4, decor.WCSyncSpace),
		),
	)

	scale := speed
	if scale < 0.1 {
		scale = 0.1
	}
	deadline := time.Now().Add(time.Duration(float64(4 * time.Second) / scale))
	for !bar.Completed() && time.Now().Before(deadline) {
		chunk := int64(rand.IntN(160_000) + 40_000)
		bar.IncrInt64(chunk)
		time.Sleep(time.Duration(float64(80 * time.Millisecond) / scale))
	}
	bar.SetTotal(total, true)
	p.Wait()
	fmt.Fprintln(os.Stderr, "  ✓ Beyond - 海阔天空              3.4 MB")
}

func runMulti(speed float64) {
	p := newProgress(56)

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

	totalBar := p.MustAdd(totalSize,
		kit.BrailleFiller{Color: true},
		mpb.BarPriority(0),
		mpb.PrependDecorators(
			decor.Name("♪ 我喜欢的音乐", decor.WC{W: 24, C: decor.DSyncWidth | decor.DindentRight}),
		),
		mpb.AppendDecorators(musicAppendDecor()...),
	)

	const workers = 3
	type job struct{ idx int }
	jobs := make(chan job, len(songs))
	for i := range songs {
		jobs <- job{idx: i}
	}
	close(jobs)

	done := make(chan struct{}, workers)
	for w := 0; w < workers; w++ {
		go func() {
			defer func() { done <- struct{}{} }()
			for j := range jobs {
				song := songs[j.idx]
				sub := p.MustAdd(song.size,
					kit.BrailleFiller{Color: true},
					mpb.BarPriority(j.idx+1),
					mpb.BarFillerClearOnComplete(),
					mpb.PrependDecorators(
						decor.Spinner([]string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}, decor.WCSyncSpace),
						decor.Name(song.name, decor.WC{W: 22, C: decor.DSyncWidth | decor.DindentRight}),
					),
					mpb.AppendDecorators(musicAppendDecor()...),
				)
				localSpeed := speed * (0.6 + rand.Float64()*0.8)
				for !sub.Completed() {
					chunk := int64(rand.IntN(140_000) + 30_000)
					sub.IncrInt64(chunk)
					totalBar.IncrInt64(chunk)
					time.Sleep(time.Duration(float64(70 * time.Millisecond) / max(localSpeed, 0.1)))
				}
			}
		}()
	}

	for w := 0; w < workers; w++ {
		<-done
	}
	totalBar.SetTotal(totalSize, true)
	p.Wait()

	fmt.Fprintln(os.Stderr, "\n歌单下载完成:我喜欢的音乐")
	fmt.Fprintln(os.Stderr, "  成功   9")
	fmt.Fprintln(os.Stderr, "  跳过   0")
	fmt.Fprintln(os.Stderr, "  失败   0")
}

func musicAppendDecor() []decor.Decorator {
	return []decor.Decorator{
		decor.CountersKibiByte(" %5.1f/%5.1f ", decor.WCSyncSpace),
		decor.NewPercentage(" %3d ", decor.WCSyncSpace),
		decor.EwmaSpeed(decor.SizeB1024(0), " %6.1f ", 0.4, decor.WCSyncSpace),
	}
}

// runSnapshot 静态快照:展示无色/有色两态,看盲文点阵与 truecolor 渐变。
func runSnapshot() {
	width := 40
	progresses := []float64{0.12, 0.38, 0.66, 1.0}

	fmt.Println("=== 纯文本降级 (-color=false) ===")
	fmt.Println("(每行 4 档进度:12%  38%  66%  100%)")
	for _, label := range []string{"braille"} {
		fmt.Printf("  %-9s ", label)
		for _, pct := range progresses {
			stat := decor.Statistics{
				Total: 1000, Current: int64(pct * 1000),
				Completed: pct >= 1.0, AvailableWidth: width,
			}
			_ = kit.BrailleFiller{Color: false}.Fill(os.Stdout, stat)
			fmt.Print("  ")
		}
		fmt.Println()
	}

	fmt.Println("\n=== true color 渐变 (青绿→天青→暖橙,完成变绿) ===")
	fmt.Println("(若终端支持 truecolor,下面应是平滑渐变,非色块)")
	fmt.Printf("  %-9s ", "braille")
	for _, pct := range progresses {
		stat := decor.Statistics{
			Total: 1000, Current: int64(pct * 1000),
			Completed: pct >= 1.0, AvailableWidth: width,
		}
		_ = kit.BrailleFiller{Color: true}.Fill(os.Stdout, stat)
		fmt.Print("  ")
	}
	fmt.Println()
}
