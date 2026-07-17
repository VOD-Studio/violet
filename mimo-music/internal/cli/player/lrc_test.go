// Package player 的 LRC 解析测试。
package player

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// TestParseLRC_Empty 空输入返回空切片(非 nil 也接受,只要 len==0)。
func TestParseLRC_Empty(t *testing.T) {
	t.Parallel()

	got := ParseLRC("")
	require.Len(t, got, 0)
}

// TestParseLRC_SingleTimestamp 一行带一个时间戳 → 一条 TimedLine。
// 01:23.45 = 1*60*1000 + 23*1000 + 450 = 83450 ms。
func TestParseLRC_SingleTimestamp(t *testing.T) {
	t.Parallel()

	got := ParseLRC("[01:23.45]海阔天空")
	require.Len(t, got, 1)
	require.Equal(t, int64(83450), got[0].TimeMs)
	require.Equal(t, "海阔天空", got[0].Text)
}

// TestParseLRC_MetadataLinesSkipped 元数据 tag 行([ti:]/[ar:]/[by:]/[al:])
// 无数字时间戳,必须跳过,不出现在结果里。
func TestParseLRC_MetadataLinesSkipped(t *testing.T) {
	t.Parallel()

	input := "[ti:海阔天空]\n[ar:Beyond]\n[by:uploader]\n[al:Biography]\n[00:01.00]第一句"
	got := ParseLRC(input)
	require.Len(t, got, 1, "元数据行必须跳过,只剩 1 条歌词")
	require.Equal(t, "第一句", got[0].Text)
	require.Equal(t, int64(1000), got[0].TimeMs)
}

// TestParseLRC_MultipleTimestampsOneLine 一行多时间戳 → 多条 TimedLine,
// 文本相同、时间不同,顺序按时间戳在行内的出现顺序(源序)。
func TestParseLRC_MultipleTimestampsOneLine(t *testing.T) {
	t.Parallel()

	// [01:23.45] = 83450ms;[02:34.56] = 2*60*1000 + 34*1000 + 560 = 154560ms
	got := ParseLRC("[01:23.45][02:34.56]重复的歌词")
	require.Len(t, got, 2)
	require.Equal(t, int64(83450), got[0].TimeMs)
	require.Equal(t, int64(154560), got[1].TimeMs)
	require.Equal(t, "重复的歌词", got[0].Text)
	require.Equal(t, "重复的歌词", got[1].Text)
}

// TestParseLRC_MillisecondPrecision 毫秒精度:2 位(百分秒)、3 位(毫秒)都正确。
// 实践中 LRC 的 .xx 段:2 位表示百分秒(0-99)、3 位表示毫秒(0-999)。
func TestParseLRC_MillisecondPrecision(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input string
		want  int64
	}{
		{"2位百分秒", "[00:01.50]a", 1500}, // 1s + 50*10ms = 1500ms
		{"3位毫秒", "[00:01.500]a", 1500}, // 1s + 500ms = 1500ms
		{"3位毫秒满精度", "[00:01.123]a", 1123},
		{"无毫秒段", "[00:01]a", 1000},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := ParseLRC(tt.input)
			require.Len(t, got, 1)
			require.Equal(t, tt.want, got[0].TimeMs)
		})
	}
}

// TestParseLRC_SourceOrderPreserved 多行解析保持源序,
// 即便时间戳在源里乱序(不按时间排)。
// ParseLRC 的契约是源序,不是时间序——排序由 SortedLRC 负责。
func TestParseLRC_SourceOrderPreserved(t *testing.T) {
	t.Parallel()

	// 故意乱序:30s 行在前,10s 行在后。
	input := "[00:30.00]后写的\n[00:10.00]先写的"
	got := ParseLRC(input)
	require.Len(t, got, 2)
	require.Equal(t, "后写的", got[0].Text, "保持源序:30s 行先出现就先返回")
	require.Equal(t, int64(30000), got[0].TimeMs)
	require.Equal(t, "先写的", got[1].Text)
	require.Equal(t, int64(10000), got[1].TimeMs)
}

// TestSortedLRC_BasicOrder SortedLRC 按 TimeMs 升序排序。
func TestSortedLRC_BasicOrder(t *testing.T) {
	t.Parallel()

	// 源里 30s 在前、10s 在后,SortedLRC 必须返回 10s 在前。
	input := "[00:30.00]后写的\n[00:10.00]先写的"
	got := SortedLRC(input)
	require.Len(t, got, 2)
	require.Equal(t, int64(10000), got[0].TimeMs, "升序:10s 在前")
	require.Equal(t, "先写的", got[0].Text)
	require.Equal(t, int64(30000), got[1].TimeMs)
	require.Equal(t, "后写的", got[1].Text)
}

// TestSortedLRC_Stable 稳定排序:相等 TimeMs 保持源相对顺序。
// 一行多时间戳场景:同一行展开出的多条若 TimeMs 相同,顺序不乱。
func TestSortedLRC_Stable(t *testing.T) {
	t.Parallel()

	// 两条 10s 的歌词,源里 A 在 B 前。排序后 A 仍在 B 前(稳定)。
	input := "[00:10.00]A\n[00:10.00]B"
	got := SortedLRC(input)
	require.Len(t, got, 2)
	require.Equal(t, int64(10000), got[0].TimeMs)
	require.Equal(t, int64(10000), got[1].TimeMs)
	require.Equal(t, "A", got[0].Text, "相等时间戳保持源序(稳定排序)")
	require.Equal(t, "B", got[1].Text)
}

// TestSortedLRC_Empty 空输入 → 空切片(与 ParseLRC 一致)。
func TestSortedLRC_Empty(t *testing.T) {
	t.Parallel()

	require.Len(t, SortedLRC(""), 0)
}

// TestParseLRC_Golden 真实 LRC 综合样本 golden 测试:header tags + 空白行 +
// 多时间戳行 + 2/3 位毫秒 + 乱序时间戳,一次性覆盖所有场景。
// ParseLRC 必须保持源序;SortedLRC 必须按 TimeMs 升序且稳定。
func TestParseLRC_Golden(t *testing.T) {
	t.Parallel()

	// 综合样本:含元数据 tag、空白行、单时间戳行、多时间戳行、2 位与 3 位毫秒、
	// 以及故意乱序的时间戳(30s 行在 10s 行之前)。
	const input = `[ti:海阔天空]
[ar:Beyond]

[00:30.00]第三句(乱序,源里在前)
[00:10.00]第一句
[01:23.45][02:34.567]重复句(2 位 + 3 位毫秒,一行多时间戳)
[00:10.00]另一句 10s(测稳定排序)
`

	// ParseLRC:保持源序。预期顺序按源里的出现顺序:
	// 行 1-3:tag + 空白 → 跳过
	// 行 4:[00:30.00] → 1 条(30000ms)
	// 行 5:[00:10.00] → 1 条(10000ms)
	// 行 6:多时间戳 → 2 条(83450ms, 154567ms)
	// 行 7:[00:10.00] → 1 条(10000ms)
	t.Run("ParseLRC_保持源序", func(t *testing.T) {
		t.Parallel()
		got := ParseLRC(input)
		require.Len(t, got, 5, "tag + 空白行跳过,5 条有效歌词")

		// 源序断言:按出现顺序
		require.Equal(t, int64(30000), got[0].TimeMs)
		require.Equal(t, "第三句(乱序,源里在前)", got[0].Text)
		require.Equal(t, int64(10000), got[1].TimeMs)
		require.Equal(t, "第一句", got[1].Text)
		// 一行多时间戳:两个时间戳共用同一文本,顺序按时间戳在行内出现顺序
		require.Equal(t, int64(83450), got[2].TimeMs)
		require.Equal(t, int64(154567), got[3].TimeMs)
		require.Equal(t, "重复句(2 位 + 3 位毫秒,一行多时间戳)", got[2].Text)
		require.Equal(t, "重复句(2 位 + 3 位毫秒,一行多时间戳)", got[3].Text)
		require.Equal(t, int64(10000), got[4].TimeMs)
		require.Equal(t, "另一句 10s(测稳定排序)", got[4].Text)
	})

	// SortedLRC:按 TimeMs 升序,稳定(相等保持源相对顺序)。
	// 排序后:10000(第一句) → 10000(另一句) → 30000 → 83450 → 154567
	t.Run("SortedLRC_升序且稳定", func(t *testing.T) {
		t.Parallel()
		got := SortedLRC(input)
		require.Len(t, got, 5)

		require.Equal(t, int64(10000), got[0].TimeMs)
		require.Equal(t, int64(10000), got[1].TimeMs)
		// 稳定性:两个 10000ms 必须保持源里「第一句」在「另一句」之前的相对顺序
		require.Equal(t, "第一句", got[0].Text, "相等时间戳保持源序(稳定排序)")
		require.Equal(t, "另一句 10s(测稳定排序)", got[1].Text)
		require.Equal(t, int64(30000), got[2].TimeMs)
		require.Equal(t, int64(83450), got[3].TimeMs)
		require.Equal(t, int64(154567), got[4].TimeMs)
	})
}

// TestParseLRC_WhitespaceOnly 纯空白输入(无有效时间戳)→ 空切片。
// 覆盖 spec「空白行跳过」+「空输入返回空切片」两个 AC 的边界。
func TestParseLRC_WhitespaceOnly(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input string
	}{
		{"纯空格+换行", "   \n\n"},
		{"制表符+换行", "\t\n\t\n"},
		{"只有元数据tag", "[ti:abc]\n[ar:def]\n"},
		{"无时间戳纯文本", "这是一行没有时间戳的歌词\n这行也没有"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			require.Len(t, ParseLRC(tt.input), 0)
			require.Len(t, SortedLRC(tt.input), 0)
		})
	}
}
