package cli

import (
	"bytes"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// 固定时区:测试用 Asia/Shanghai,避免本地时区影响时段判定。
var testTZ = func() *time.Location {
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		return time.UTC
	}
	return loc
}()

// at 构造指定 时区+日+时 的 time(分钟固定 0;weekday 由 date 自动算)。
func at(year, month, day, hour int) time.Time {
	return time.Date(year, time.Month(month), day, hour, 0, 0, 0, testTZ)
}

func TestBucketOf(t *testing.T) {
	cases := []struct {
		hour int
		want timeBucket
	}{
		{0, bucketNight}, {5, bucketNight}, {23, bucketNight},
		{6, bucketMorning}, {10, bucketMorning},
		{11, bucketNoon}, {17, bucketNoon},
		{18, bucketEvening}, {22, bucketEvening},
	}
	for _, tc := range cases {
		require.Equal(t, tc.want, bucketOf(tc.hour), "hour=%d", tc.hour)
	}
}

func TestBucketOf_Boundaries(t *testing.T) {
	// 边界:11 属午(非晨),18 属晚(非午),23 属夜(非晚),6 属晨(非夜)。
	require.Equal(t, bucketNoon, bucketOf(11))
	require.Equal(t, bucketEvening, bucketOf(18))
	require.Equal(t, bucketNight, bucketOf(23))
	require.Equal(t, bucketMorning, bucketOf(6))
}

func TestIsWeekend(t *testing.T) {
	require.True(t, isWeekend(time.Saturday))
	require.True(t, isWeekend(time.Sunday))
	require.False(t, isWeekend(time.Monday))
	require.False(t, isWeekend(time.Friday))
}

func TestRecommendForTime_WeekdayMorning(t *testing.T) {
	// 工作日(周三)晨 08:00 → daily-songs
	now := at(2026, 7, 22, 8) // 2026-07-22 是周三
	require.Equal(t, time.Wednesday, now.Weekday())
	recs := recommendForTime(now)
	require.Len(t, recs, 1)
	require.Contains(t, recs[0].cmd, "daily-songs")
}

func TestRecommendForTime_WeekdayNoon(t *testing.T) {
	now := at(2026, 7, 22, 14) // 周三午
	recs := recommendForTime(now)
	require.Len(t, recs, 1)
	require.Contains(t, recs[0].cmd, "recommend playlists")
}

func TestRecommendForTime_WeekdayEvening(t *testing.T) {
	now := at(2026, 7, 22, 20) // 周三晚
	recs := recommendForTime(now)
	require.Len(t, recs, 1)
	require.Contains(t, recs[0].cmd, "fm")
}

func TestRecommendForTime_WeekdayNight(t *testing.T) {
	now := at(2026, 7, 22, 23) // 周三夜
	recs := recommendForTime(now)
	require.Len(t, recs, 1)
	require.Contains(t, recs[0].cmd, "song play --id <TAB>")
}

func TestRecommendForTime_WeekendOverridesTime(t *testing.T) {
	// 周六 10:00(晨)→ 周末推荐(playlists + shelf),不推日推。
	now := at(2026, 7, 25, 10) // 2026-07-25 是周六
	require.Equal(t, time.Saturday, now.Weekday())
	recs := recommendForTime(now)
	require.Len(t, recs, 2, "周末应推两条")
	require.Contains(t, recs[0].cmd, "playlists")
	require.Contains(t, recs[1].cmd, "album shelf")
}

func TestRecommendForTime_NightHasTabMarker(t *testing.T) {
	// 夜间复听命令带 <TAB>(从召回池补全)。
	now := at(2026, 7, 22, 2) // 周三凌晨
	recs := recommendForTime(now)
	require.Contains(t, recs[0].cmd, "<TAB>")
}

// --- renderOnboarding 渲染 ---

func TestRenderOnboarding_NotLoggedIn(t *testing.T) {
	var buf bytes.Buffer
	renderOnboarding(&buf, false, at(2026, 7, 22, 8))
	out := buf.String()
	require.Contains(t, out, "musicctl login")
	require.Contains(t, out, "login-cellphone")
	require.NotContains(t, out, "daily-songs", "未登录不应给场景推荐")
}

func TestRenderOnboarding_LoggedInShowsRecommendation(t *testing.T) {
	var buf bytes.Buffer
	renderOnboarding(&buf, true, at(2026, 7, 22, 8)) // 周三晨
	out := buf.String()
	require.Contains(t, out, "daily-songs")
	require.Contains(t, out, "<TAB>", "应教育可补全约定")
}

func TestRenderOnboarding_GoesToGivenWriter(t *testing.T) {
	// 验证写到传入的 writer(生产传 os.Stderr);用 stderr 语义通过 bytes.Buffer 验证。
	var buf bytes.Buffer
	renderOnboarding(&buf, true, at(2026, 7, 25, 10))
	require.True(t, strings.Contains(buf.String(), "playlists"))
}

// 间接验证 stdout 干净:onboarding 写传入 writer,生产传 os.Stderr,
// root RunE 里 renderOnboarding(os.Stderr, ...) —— stdout 不被碰。
func TestRenderOnboarding_DoesNotMentionRecallPool(t *testing.T) {
	// onboarding 不读召回池(CONTEXT.md Avoid),文案不应提「召回池」术语。
	var buf bytes.Buffer
	renderOnboarding(&buf, true, at(2026, 7, 22, 8))
	require.NotContains(t, buf.String(), "召回池")
}
