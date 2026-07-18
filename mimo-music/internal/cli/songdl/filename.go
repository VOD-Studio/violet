// Package songdl 是单曲下载的核心逻辑(文件名构造 / 元数据写入 / 下载 / 冲突处理),
// 供 song 与 playlist 命令共享。它是叶子包:不依赖任何 cli feature 包,
// 只依赖 kit(渲染/进度)、endpoint 协议类型、外部音频库。
//
// 设计动机(issue #23 / PRD-0013):song download 与 playlist download 都要消费
// 同一套「拿直链 → 文件名 → mkdir → 冲突 → 流式下载 → 元数据」链路。把它下沉到
// 独立包避免 feature 包互相导出(参考 cobra enterprise guide + DoltHub 循环依赖策略:
// 共享逻辑放叶子包,feature 包保持薄)。命令层只做 flag 编排 + 结果渲染。
package songdl

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
)

// unsafeFilenameChars 是 Windows/macOS/Linux 文件系统都禁用的路径字符。
// 出现在艺人/歌名里会破坏落盘,必须过滤。
const unsafeFilenameChars = `/\:*?"<>|`

// sanitizeFilename 把路径不安全字符替换为下划线(保留可读,不删除避免名字粘连)。
func sanitizeFilename(s string) string {
	return strings.Map(func(r rune) rune {
		if strings.ContainsRune(unsafeFilenameChars, r) {
			return '_'
		}
		return r
	}, s)
}

// SongFilename 构造单曲下载的默认文件名:{首艺人} - {歌名}.{ext}。
// 多艺人取首个(Artists[0]);过滤路径不安全字符。
// 艺人/歌名为空时用 id 替代缺失部分;两者都空用 id 兜底(避免 " - .ext")。
// 不处理冲突回退(那是命令层策略,见 ResolveConflictPath)。
func SongFilename(s *mmpb.Song, ext string) string {
	artist := ""
	if len(s.Artists) > 0 {
		artist = s.Artists[0].Name
	}
	title := s.Name
	idStr := strconv.FormatInt(s.Id, 10)

	// 缺失部分用 id 替代;两者都缺用 id 兜底。
	switch {
	case artist == "" && title == "":
		return idStr + "." + ext
	case artist == "":
		artist = idStr
	case title == "":
		title = idStr
	}
	return sanitizeFilename(artist) + " - " + sanitizeFilename(title) + "." + ext
}

// FallbackFilename 构造冲突回退文件名:{首艺人} - {歌名} ({id}).{ext}。
// 用稳定的 id 做后缀,可重跑幂等(不自动加 (2)/(3),避免破坏断点续传语义)。
// 导出供批量下载做 size 预检时遍历两个候选名(默认名 + 回退名)。
func FallbackFilename(s *mmpb.Song, ext string) string {
	artist := ""
	if len(s.Artists) > 0 {
		artist = s.Artists[0].Name
	}
	title := s.Name
	idStr := strconv.FormatInt(s.Id, 10)
	switch {
	case artist == "" && title == "":
		return idStr + "." + ext // 无名时 fallback 与默认一致,无需再回退
	case artist == "":
		artist = idStr
	case title == "":
		title = idStr
	}
	return sanitizeFilename(artist) + " - " + sanitizeFilename(title) + " (" + idStr + ")." + ext
}

// ResolveConflictPath 决定单曲落盘的最终路径,实现 PRD-0013 文件名冲突处理:
//  1. 默认 {artist} - {title}.{ext};不存在 → 用它(返回 skipped=false)
//  2. 存在但 force=true → 用它覆盖(返回 skipped=false)
//  3. 存在且非 force → 尝试 {artist} - {title} ({id}).{ext};不存在 → 用它
//  4. 两个都存在且非 force → 跳过(返回 skipped=true,path 指向默认名供提示)
//
// 不自动加 (2)/(3):不可重跑,破坏「重跑即续传」的幂等语义。
func ResolveConflictPath(s *mmpb.Song, ext, dir string, force bool) (path string, skipped bool) {
	name := SongFilename(s, ext)
	defaultPath := filepath.Join(dir, name)
	if !fileExists(defaultPath) || force {
		return defaultPath, false
	}
	// 默认名冲突且非 force:尝试 id 回退。
	fallbackPath := filepath.Join(dir, FallbackFilename(s, ext))
	if !fileExists(fallbackPath) {
		return fallbackPath, false
	}
	// 两个都存在且非 force → 跳过。path 返回默认名(调用方提示用)。
	return defaultPath, true
}

// fileExists 文件是否存在。
func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
