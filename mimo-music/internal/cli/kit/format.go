// Package kit 的进度数值格式化纯函数。
//
// 所有函数无副作用、无 I/O,期望值参照 PRD-0013 的进度显示示例:
//   - 字节:1024 进制(KiB/MiB/GiB),显示用 KB/MB/GB(PRD 行 80:3.4 MB)
//   - 时长:mm:ss,≥1h 用 h:mm:ss(PRD 行 80:0:01)
//   - 速度:字节/秒,同字节单位(PRD 行 80:1.8 MB/s)
//   - 百分比:整数%,分母零时 0%(PRD 行 80:62%)
package kit

import (
	"fmt"
	"time"
)

// formatBytes 字节数 → 人类可读(1024 进制,1 位小数,≥1024 才升级单位)。
//
//	formatBytes(512) = "512 B"
//	formatBytes(3565158) = "3.4 MB"
func formatBytes(n int64) string {
	if n < 0 {
		n = 0
	}
	const unit = 1024
	if n < unit {
		return fmt.Sprintf("%d B", n)
	}
	div, exp := int64(unit), 0
	for x := n / unit; x >= unit; x /= unit {
		div *= unit
		exp++
	}
	units := []string{"KB", "MB", "GB", "TB", "PB"}
	return fmt.Sprintf("%.1f %s", float64(n)/float64(div), units[exp])
}

// formatDuration 时长 → mm:ss(≥1h 用 h:mm:ss)。
//
//	formatDuration(1*time.Second) = "0:01"
//	formatDuration(372*time.Second) = "6:12"
//	formatDuration(3600*time.Second) = "1:00:00"
func formatDuration(d time.Duration) string {
	if d < 0 {
		d = 0
	}
	totalSec := int(d.Seconds())
	h := totalSec / 3600
	rem := totalSec % 3600
	m := rem / 60
	s := rem % 60
	if h > 0 {
		return fmt.Sprintf("%d:%02d:%02d", h, m, s)
	}
	return fmt.Sprintf("%d:%02d", m, s)
}

// formatSpeed 字节/秒 → 人类可读速度(复用 formatBytes 的单位逻辑 + "/s")。
//
//	formatSpeed(1800000) = "1.7 MB/s"
func formatSpeed(bytesPerSec float64) string {
	if bytesPerSec < 0 {
		bytesPerSec = 0
	}
	return formatBytes(int64(bytesPerSec)) + "/s"
}

// formatPercent 当前进度 → 整数百分比(total ≤ 0 时 "0%")。
//
//	formatPercent(62, 100) = "62%"
//	formatPercent(78, 286) = "27%"
func formatPercent(cur, total int64) string {
	if total <= 0 {
		return "0%"
	}
	pct := cur * 100 / total
	if pct > 100 {
		pct = 100
	}
	return fmt.Sprintf("%d%%", pct)
}
