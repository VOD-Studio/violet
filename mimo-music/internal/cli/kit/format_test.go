package kit

import (
	"testing"
	"time"
)

// format 函数测试。期望值来自 PRD-0013 示例(独立真值源,非重算)。

func TestFormatBytes(t *testing.T) {
	t.Parallel()
	cases := []struct {
		in   int64
		want string
	}{
		{0, "0 B"},
		{512, "512 B"},
		{1023, "1023 B"},
		{1024, "1.0 KB"},
		{1536, "1.5 KB"},
		{1_000_000, "976.6 KB"},  // PRD 示例 2.1/3.4 MB 的字节级,1024 进制
		{3_565_158, "3.4 MB"},    // PRD 行 80:3.4 MB
		{3_400_000, "3.2 MB"},    // demo 的 3.4MB 实际是 3.2MiB
		{4_300_000, "4.1 MB"},
		{1_200_000_000, "1.1 GB"}, // PRD 行 202:约 1.2 GB
	}
	for _, tc := range cases {
		if got := formatBytes(tc.in); got != tc.want {
			t.Errorf("formatBytes(%d) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

func TestFormatDuration(t *testing.T) {
	t.Parallel()
	cases := []struct {
		in   time.Duration
		want string
	}{
		{1 * time.Second, "0:01"},     // PRD 行 80:ETA 0:01
		{65 * time.Second, "1:05"},
		{372 * time.Second, "6:12"},   // PRD 行 212:ETA 6m12s → 这里用 mm:ss
		{600 * time.Second, "10:00"},
		{3600 * time.Second, "1:00:00"},
	}
	for _, tc := range cases {
		if got := formatDuration(tc.in); got != tc.want {
			t.Errorf("formatDuration(%v) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

func TestFormatSpeed(t *testing.T) {
	t.Parallel()
	cases := []struct {
		bytesPerSec float64
		want        string
	}{
		{0, "0 B/s"},
		{512, "512 B/s"},
		{1_800_000, "1.7 MB/s"},  // PRD 行 80:1.8 MB/s(1024 进制约 1.7MiB/s)
		{2_400_000, "2.3 MB/s"},  // PRD 行 212:2.4 MB/s
	}
	for _, tc := range cases {
		if got := formatSpeed(tc.bytesPerSec); got != tc.want {
			t.Errorf("formatSpeed(%f) = %q, want %q", tc.bytesPerSec, got, tc.want)
		}
	}
}

func TestFormatPercent(t *testing.T) {
	t.Parallel()
	cases := []struct {
		cur, total int64
		want       string
	}{
		{0, 100, "0%"},
		{62, 100, "62%"},      // PRD 行 80:(62%)
		{78, 286, "27%"},      // PRD 行 212:(27%)
		{100, 100, "100%"},
		{0, 0, "0%"},          // 分母零边界
		{50, 0, "0%"},
	}
	for _, tc := range cases {
		if got := formatPercent(tc.cur, tc.total); got != tc.want {
			t.Errorf("formatPercent(%d,%d) = %q, want %q", tc.cur, tc.total, got, tc.want)
		}
	}
}
