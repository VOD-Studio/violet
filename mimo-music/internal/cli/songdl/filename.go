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

// DefaultFilenameTemplate 默认文件名模板:{首艺人} - {歌名}。
// SongFilename(无 --filename 时)用此模板。冲突回退在此基础追加 ({id})。
const DefaultFilenameTemplate = "{artist} - {title}"

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

// songFields 抽取 Song 的艺人/歌名/专辑字段(空值保留为空串,不做 id 兜底——
// 兜底是 SongFilename 默认模板的专属行为,自定义模板按 PRD 保留字面)。
func songFields(s *mmpb.Song) (artist, title, album string) {
	if len(s.Artists) > 0 {
		artist = s.Artists[0].Name
	}
	title = s.Name
	if s.Album != nil {
		album = s.Album.Name
	}
	return artist, title, album
}

// FormatFilename 应用 {artist}/{title}/{album}/{id} 占位符模板,过滤路径不安全字符,
// 附加 .{ext} 扩展名。未知占位符(如 {foo})字面保留(PRD:非法占位符 → 字面字符串)。
//
// 用 strings.ReplaceAll 而非 text/template:① 仅 4 个固定占位符,无需通用引擎;
// ② 避免 template 注入(用户输入 {{printf}} 会被 text/template 执行);
// ③ 「未知保留字面」是 ReplaceAll 的自然行为(ReplaceAll 找不到的串原样留下)。
//
// 注意:本函数不处理空值兜底。默认模板的「艺人/歌名空 → id 替代」是 SongFilename
// 的专属行为(见 applyDefaultEmptyFallback),自定义模板按 PRD 保留空串字面。
func FormatFilename(tmpl string, s *mmpb.Song, ext string) string {
	artist, title, album := songFields(s)
	idStr := strconv.FormatInt(s.Id, 10)
	out := tmpl
	out = strings.ReplaceAll(out, "{artist}", artist)
	out = strings.ReplaceAll(out, "{title}", title)
	out = strings.ReplaceAll(out, "{album}", album)
	out = strings.ReplaceAll(out, "{id}", idStr)
	return sanitizeFilename(out) + "." + ext
}

// applyDefaultEmptyFallback 默认模板的空值兜底:艺人/歌名为空时用 id 替代缺失部分,
// 两者都空用 id 单独兜底(避免 " - .ext")。仅 SongFilename/FallbackFilename 用,
// 自定义模板不享受此兜底(PRD:用户模板的字段缺失保留字面)。
//
// 返回值是「填好 id 兜底的模板」(供 FormatFilename 再做占位符替换);全空时返回
// 纯 id 模板 "{id}"(FormatFilename 会替换为 id + 扩展名,产出 "123.mp3")。
func applyDefaultEmptyFallback(s *mmpb.Song) string {
	artist, title, _ := songFields(s)
	switch {
	case artist == "" && title == "":
		return "{id}" // 全空:纯 id,FormatFilename 产出 "123.mp3"
	case artist == "":
		// artist 位用 id 占:{id} - {title}(FormatFilename 再替换 {id} 和 {title})
		return strings.ReplaceAll(DefaultFilenameTemplate, "{artist}", "{id}")
	case title == "":
		return strings.ReplaceAll(DefaultFilenameTemplate, "{title}", "{id}")
	}
	return DefaultFilenameTemplate
}

// SongFilename 构造单曲下载的默认文件名:{首艺人} - {歌名}.{ext}。
// 多艺人取首个;过滤路径不安全字符;艺人/歌名空时用 id 兜底。
// 不处理冲突回退(那是命令层策略,见 ResolveConflictPath)。
func SongFilename(s *mmpb.Song, ext string) string {
	return FormatFilename(applyDefaultEmptyFallback(s), s, ext)
}

// FallbackFilename 构造冲突回退文件名:默认模板 + ({id}) 后缀。
// 用稳定的 id 做后缀,可重跑幂等(不自动加 (2)/(3),避免破坏断点续传语义)。
// 导出供批量下载做 size 预检时遍历候选名(默认名 + 回退名)。
func FallbackFilename(s *mmpb.Song, ext string) string {
	return FormatFilename(applyDefaultEmptyFallback(s)+" ({id})", s, ext)
}

// FormatFallbackFilename 给定自定义模板,构造冲突回退文件名:模板 + ({id})。
// 用于 --filename 自定义模板时的冲突回退(同 FallbackFilename 的自定义版)。
func FormatFallbackFilename(tmpl string, s *mmpb.Song, ext string) string {
	return FormatFilename(tmpl+" ({id})", s, ext)
}

// ResolveConflictPath 决定单曲落盘的最终路径,实现 PRD-0013 文件名冲突处理:
//  1. 默认/自定义名;不存在 → 用它(返回 skipped=false)
//  2. 存在但 force=true → 用它覆盖(返回 skipped=false)
//  3. 存在且非 force → 尝试名 + ({id}) 回退;不存在 → 用它
//  4. 两个都存在且非 force → 跳过(返回 skipped=true,path 指向首名供提示)
//
// filenameTmpl 空串时用默认模板(SongFilename/FallbackFilename);非空时按自定义模板。
// 不自动加 (2)/(3):不可重跑,破坏「重跑即续传」的幂等语义。
func ResolveConflictPath(s *mmpb.Song, ext, dir, filenameTmpl string, force bool) (path string, skipped bool) {
	primary, fallback := candidateNames(s, ext, filenameTmpl)
	primaryPath := filepath.Join(dir, primary)
	if !fileExists(primaryPath) || force {
		return primaryPath, false
	}
	// 主名冲突且非 force:尝试 id 回退。
	fallbackPath := filepath.Join(dir, fallback)
	if !fileExists(fallbackPath) {
		return fallbackPath, false
	}
	// 两个都存在且非 force → 跳过。path 返回主名(供调用方提示「已跳过:XX」用)。
	return primaryPath, true
}

// candidateNames 返回 (主名, 回退名),按模板决定用默认还是自定义。
func candidateNames(s *mmpb.Song, ext, filenameTmpl string) (primary, fallback string) {
	if filenameTmpl == "" {
		return SongFilename(s, ext), FallbackFilename(s, ext)
	}
	return FormatFilename(filenameTmpl, s, ext), FormatFallbackFilename(filenameTmpl, s, ext)
}

// fileExists 文件是否存在。
func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
