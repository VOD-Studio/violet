package cli

import (
	"fmt"
	"io"
	"time"
)

// onboarding 裸跑引导(PRD-0014 #D,CONTEXT.md 场景化 onboarding 段)。
//
// 裸跑(无参直接敲 musicctl)时:未登录给登录引导;已登录按粗粒度时段 + 周末推荐
// 下一步该跑的命令。输出走 stderr(不污染 stdout 管道),本地读 + 无网络,秒出。
// **不读召回池**(CONTEXT.md 既定 Avoid:不做个性化推荐)。

// timeBucket 粗粒度时段(CONTEXT.md 既定边界)。返回值用于选推荐命令。
// 边界用区间避免精确小时切换抖动(10:59 与 11:01 同推一组)。
type timeBucket int

const (
	bucketMorning timeBucket = iota // 06-11 晨
	bucketNoon                      // 11-18 午
	bucketEvening                   // 18-23 晚
	bucketNight                     // 23-06 夜
)

// bucketOf 按小时(本地)归入时段桶。hour 是 0-23。
func bucketOf(hour int) timeBucket {
	switch {
	case hour >= 6 && hour < 11:
		return bucketMorning
	case hour >= 11 && hour < 18:
		return bucketNoon
	case hour >= 18 && hour < 23:
		return bucketEvening
	default: // 23-24, 0-6
		return bucketNight
	}
}

// isWeekend 周六/周日为周末(周末推荐优先于时段)。
func isWeekend(weekday time.Weekday) bool {
	return weekday == time.Saturday || weekday == time.Sunday
}

// recommendation 是一条场景化推荐命令。
type recommendation struct {
	cmd  string // 命令(含参数占位)
	desc string // 一句话说明为什么推它
}

// recommendForTime 按时段 + 周末选推荐命令(已登录场景)。
//
// 规则(CONTEXT.md 第 224 行):
//   - 周末(优先):recommend playlists + album shelf
//   - 工作日晨(06-11):recommend daily-songs
//   - 工作日午(11-18):recommend playlists
//   - 工作日晚(18-23):fm
//   - 工作日夜(23-06):song play --id <TAB>(从召回池复听)
//
// 纯函数(now 注入保证确定性),硬编码零新依赖。
func recommendForTime(now time.Time) []recommendation {
	t := now.Local()
	if isWeekend(t.Weekday()) {
		return []recommendation{
			{cmd: "musicctl recommend playlists", desc: "周末了,挑个歌单慢慢听"},
			{cmd: "musicctl album shelf", desc: "或翻翻新碟上架"},
		}
	}
	switch bucketOf(t.Hour()) {
	case bucketMorning:
		return []recommendation{{cmd: "musicctl recommend daily-songs", desc: "早安,今日日推已更新"}}
	case bucketNoon:
		return []recommendation{{cmd: "musicctl recommend playlists", desc: "午休,挑个歌单"}}
	case bucketEvening:
		return []recommendation{{cmd: "musicctl fm", desc: "晚间,开个私人 FM"}}
	default: // 夜
		return []recommendation{{cmd: "musicctl song play --id <TAB>", desc: "夜了,从最近听过的歌复听"}}
	}
}

// renderOnboarding 渲染裸跑引导到 w(应是 stderr)。
//
// loggedIn=false → 固定登录引导;true → 场景化推荐(now 决定时段/周末)。
// 可补全命令在文案里带 <TAB> 标注(Unix 文化约定,教育可发现性)。
func renderOnboarding(w io.Writer, loggedIn bool, now time.Time) {
	if !loggedIn {
		fmt.Fprintln(w, "欢迎使用 musicctl——网易云接口调试与实用工具。")
		fmt.Fprintln(w)
		fmt.Fprintln(w, "下一步:")
		fmt.Fprintln(w, "  musicctl login           扫码登录(推荐)")
		fmt.Fprintln(w, "  musicctl login-cellphone 手机号验证码登录")
		fmt.Fprintln(w)
		fmt.Fprintln(w, "登录后可播放/下载/红心等;先试试 musicctl search <关键词>。")
		fmt.Fprintln(w, "(环境变量 NETEASE_COOKIE 可临时指定 cookie,优先级高于会话文件)")
		return
	}
	fmt.Fprintln(w, "musicctl 已就绪。现在可以:")
	for _, r := range recommendForTime(now) {
		fmt.Fprintf(w, "  %s   %s\n", r.cmd, r.desc)
	}
	fmt.Fprintln(w)
	fmt.Fprintln(w, "<TAB> 表示该位置可按 Tab 从最近搜索/播放补全候选。")
	fmt.Fprintln(w, "音乐命令带 --id 也接受位置参数(如 musicctl song play 347230)。")
}
