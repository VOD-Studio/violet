// Package model 是网易云领域映射层。
//
// 每个领域实体定义「网易云原始 JSON 的 struct 镜像 + map 到 proto 的函数」，
// 写一次后全局复用。例如 MapSong 被歌曲详情、每日推荐、歌单曲目、专辑曲目、
// 搜索(单曲)等几十个接口复用。
//
// 这是「该复用的复用」的落点，把看似 357 次的映射塌缩为约 30 次领域映射 + 接口级组装。
package model

import (
	"encoding/json"
	"regexp"
	"strconv"
	"strings"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
)

// --- raw struct 镜像（网易云原始 JSON，字段名保留缩写） ---

// rawSong 是网易云歌曲的原始 JSON 结构（字段名保留网易云缩写）。
type rawSong struct {
	ID   int64       `json:"id"`   // 歌曲ID
	Name string      `json:"name"` // 歌曲名
	Ar   []rawArtist `json:"ar"`   // 歌手数组（artists 缩写）
	Al   rawAlbum    `json:"al"`   // 专辑信息（album 缩写）
	Dt   int64       `json:"dt"`   // 时长毫秒（duration 缩写）
	Fee  int         `json:"fee"`  // 付费类型：0免费 1VIP 4数字专辑 8试听
}

// rawSongDetail 是歌曲详情接口的响应。
type rawSongDetail struct {
	Code  int       `json:"code"`  // 业务码，200 成功
	Songs []rawSong `json:"songs"` // 歌曲数组
}

// --- map 函数（返回 proto 类型，全局复用） ---

// MapSong 把网易云原始歌曲结构转成 proto Song。
func MapSong(s rawSong) *mmpb.Song {
	return &mmpb.Song{
		Id:         s.ID,
		Name:       s.Name,
		Artists:    MapArtists(s.Ar),
		Album:      MapAlbum(s.Al),
		DurationMs: s.Dt,
		Fee:        int32(s.Fee),
	}
}

// MapSongs 把网易云原始歌曲数组转成 proto Song 列表。
func MapSongs(in []rawSong) []*mmpb.Song {
	out := make([]*mmpb.Song, 0, len(in))
	for _, s := range in {
		out = append(out, MapSong(s))
	}
	return out
}

// DecodeSongDetail 解析歌曲详情响应的原始 JSON。
func DecodeSongDetail(raw json.RawMessage) ([]*mmpb.Song, error) {
	var r rawSongDetail
	if err := json.Unmarshal(raw, &r); err != nil {
		return nil, err
	}
	return MapSongs(r.Songs), nil
}

// --- 逐字歌词（yrc）解析 ---

// yrcLineHeadRe 匹配行首时间戳 [startMs,durMs]。
var yrcLineHeadRe = regexp.MustCompile(`\[(\d+),(\d+)\]`)

// yrcWordRe 匹配逐字 token (startMs,durMs,0)text。
// 第三个字段是网易云固定标记 0（不使用）。text 是到下一个 '(' 前的全部内容。
var yrcWordRe = regexp.MustCompile(`\((\d+),(\d+),\d+\)([^(\r\n]*)`)

// DecodeWordLyric 把网易云逐字歌词文本（yrc）解析成结构化 WordLyric。
//
// yrc 格式：每行 `[lineStartMs,lineDurMs](wordStartMs,wordDurMs,0)字(...)...`
// - 行头方括号标注行级时间戳
// - 每字圆括号三元组 (startMs,durMs,0)，第三字段为固定标记
// - 字内间隙/标点可能 dur=0
// blob 为空时返回空 WordLyric（无逐字歌词），不报错。
func DecodeWordLyric(blob string) (*mmpb.WordLyric, error) {
	out := &mmpb.WordLyric{}
	if strings.TrimSpace(blob) == "" {
		return out, nil
	}

	// 逐行解析：按行头 [..] 切分。行之间用换行分隔。
	for _, line := range strings.Split(blob, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		headMatch := yrcLineHeadRe.FindStringSubmatch(line)
		if headMatch == nil {
			continue // 非歌词行（如空行、元信息），跳过
		}
		lineStart, _ := strconv.ParseInt(headMatch[1], 10, 64)
		lineDur, _ := strconv.ParseInt(headMatch[2], 10, 64)

		pbLine := &mmpb.WordLyricLine{StartMs: lineStart, DurationMs: lineDur}
		// 行内容文本（拼接所有字）。
		var contentBuilder strings.Builder

		for _, wMatch := range yrcWordRe.FindAllStringSubmatch(line, -1) {
			wordStart, _ := strconv.ParseInt(wMatch[1], 10, 64)
			wordDur, _ := strconv.ParseInt(wMatch[2], 10, 64)
			text := wMatch[3]
			pbLine.Words = append(pbLine.Words, &mmpb.WordLyricWord{
				StartMs:    wordStart,
				DurationMs: wordDur,
				Content:    text,
			})
			contentBuilder.WriteString(text)
		}
		pbLine.Content = contentBuilder.String()
		out.Lines = append(out.Lines, pbLine)
	}

	return out, nil
}
