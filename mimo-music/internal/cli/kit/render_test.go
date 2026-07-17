// Package kit 的渲染层测试。
package kit

import (
	"bytes"
	"strings"
	"testing"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/stretchr/testify/require"
)

// TestRenderHuman_Table 单段表格:标量列对齐,嵌套 artists 塌缩为名字 join。
func TestRenderHuman_Table(t *testing.T) {
	t.Parallel()

	resp := &mmpb.HotResponse{
		Keywords: []*mmpb.HotKeyword{
			{SearchWord: "薛之谦", Score: 1},
			{SearchWord: "周杰伦", Score: 2},
		},
	}

	out := RenderHuman(resp)
	require.Contains(t, out, "== keywords (2) ==")
	require.Contains(t, out, "searchWord")
	require.Contains(t, out, "薛之谦")
	require.Contains(t, out, "周杰伦")
}

// TestRenderHuman_MultiSection 多段表格:search 形态的多个 repeated 字段各带小标题。
func TestRenderHuman_MultiSection(t *testing.T) {
	t.Parallel()

	resp := &mmpb.SearchResponse{
		Songs: []*mmpb.Song{
			{Id: 347230, Name: "海阔天空", Artists: []*mmpb.Artist{{Name: "Beyond"}}, Album: &mmpb.Album{Name: "乐与怒"}},
		},
		Albums: []*mmpb.Album{
			{Id: 222, Name: "乐与怒"},
		},
	}

	out := RenderHuman(resp)
	require.Contains(t, out, "== songs (1) ==")
	require.Contains(t, out, "== albums (1) ==")
	require.Contains(t, out, "海阔天空")
	require.Contains(t, out, "Beyond", "嵌套 artists 应塌缩为名字")
	require.Contains(t, out, "乐与怒")
	// 空的 repeated 字段不出段
	require.NotContains(t, out, "== artists ==")
	require.NotContains(t, out, "== users ==")
}

// TestRenderHuman_KeyValues 无 repeated 字段时渲染键值对。
func TestRenderHuman_KeyValues(t *testing.T) {
	t.Parallel()

	resp := &mmpb.DetailByNameResponse{UserId: 32014612}

	out := RenderHuman(resp)
	require.Contains(t, out, "userId: 32014612")
}

// TestRenderHuman_KeyValuesNested 键值对模式单层嵌套 message 缩进展开,更深退化紧凑 JSON。
func TestRenderHuman_KeyValuesNested(t *testing.T) {
	t.Parallel()

	resp := &mmpb.GetSongDetailResponse{
		Song: &mmpb.Song{Id: 347230, Name: "海阔天空", Album: &mmpb.Album{Id: 222, Name: "乐与怒"}},
	}

	out := RenderHuman(resp)
	require.Contains(t, out, "song:\n", "单层嵌套应展开为小节")
	require.Contains(t, out, "  id: 347230")
	require.Contains(t, out, "  name: 海阔天空")
	require.Contains(t, out, `  album: {"id":"222"`, "更深的嵌套退化紧凑 JSON")
}

// TestRenderHuman_Enum 枚举显示枚举名而非数字。
func TestRenderHuman_Enum(t *testing.T) {
	t.Parallel()

	resp := &mmpb.GetSongURLRequest{SongId: 1, Level: mmpb.SongLevel_SONG_LEVEL_LOSSLESS}

	out := RenderHuman(resp)
	require.Contains(t, out, "SONG_LEVEL_LOSSLESS")
}

// TestRenderHuman_Truncate 超宽单元格按 rune 截断补省略号。
func TestRenderHuman_Truncate(t *testing.T) {
	t.Parallel()

	long := strings.Repeat("长", maxCellLen+10)
	resp := &mmpb.HotResponse{Keywords: []*mmpb.HotKeyword{{SearchWord: long, Score: 1}}}

	out := RenderHuman(resp)
	require.Contains(t, out, "…")
	require.NotContains(t, out, long)
}

// TestRenderHuman_Empty 空响应不渲染表格段。
func TestRenderHuman_Empty(t *testing.T) {
	t.Parallel()

	out := RenderHuman(&mmpb.SearchResponse{})
	require.NotContains(t, out, "== songs ==")
}

// TestMaskCookie cookie 分段脱敏:长值保留首尾 8 位,短值整体打码,键名保留。
func TestMaskCookie(t *testing.T) {
	t.Parallel()

	in := "MUSIC_U=00C4F6AB3ACDE59567E13EEAFEEF32EC73D0761BF8031C52; __csrf=58cebdfc3b4325ba754c; NMTID=abc"
	out := MaskCookie(in)
	require.Contains(t, out, "MUSIC_U=00C4F6AB...F8031C52")
	require.Contains(t, out, "__csrf=***")
	require.Contains(t, out, "NMTID=***")
	require.NotContains(t, out, "3ACDE59567E13EEAFEEF32")
}

// TestRender_Dispatch 三态分派:JSON 模式恒 protojson;TTY 人类可读;非 TTY 自动 JSON。
func TestRender_Dispatch(t *testing.T) {
	defer func(orig func(int) bool) { isTerminal = orig }(isTerminal)

	msg := &mmpb.HotResponse{Keywords: []*mmpb.HotKeyword{{SearchWord: "薛之谦", Score: 1}}}

	cases := []struct {
		name     string
		jsonMode bool
		tty      bool
		wantJSON bool
	}{
		{"TTY 人类可读", false, true, false},
		{"--json 强制 JSON", true, true, true},
		{"管道自动 JSON", false, false, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			isTerminal = func(int) bool { return tc.tty }
			var buf bytes.Buffer
			k := &Kit{JSON: tc.jsonMode, Out: &buf}
			require.NoError(t, k.Render(msg))
			got := buf.String()
			if tc.wantJSON {
				require.Contains(t, got, `"keywords"`, "应为 protojson 形态")
			} else {
				require.Contains(t, got, "== keywords (1) ==", "应为表格形态")
			}
		})
	}
}
