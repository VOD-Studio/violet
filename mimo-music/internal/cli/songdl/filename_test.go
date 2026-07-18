package songdl

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
)

// SongFilename 测试(从 internal/cli/song/metadata_test.go 迁入,行为不变)。

func TestSongFilename_Normal(t *testing.T) {
	t.Parallel()
	s := &mmpb.Song{
		Id:   347230,
		Name: "海阔天空",
		Artists: []*mmpb.Artist{
			{Name: "Beyond"},
			{Name: "黄家驹"},
		},
	}
	require.Equal(t, "Beyond - 海阔天空.mp3", SongFilename(s, "mp3"))
}

func TestSongFilename_SanitizePathChars(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name   string
		artist string
		song   string
		want   string
	}{
		{"斜杠", "AC/DC", "Back in Black", "AC_DC - Back in Black.mp3"},
		{"反斜杠", "Jay\\Chou", "晴天", "Jay_Chou - 晴天.mp3"},
		{"冒号", "A:B", "C:D", "A_B - C_D.flac"},
		{"星号问号", "X*Y?", "Z", "X_Y_ - Z.mp3"},
		{"引号尖括号", `a"b<c>`, "song", `a_b_c_ - song.mp3`},
		{"竖线", "p|q", "r", "p_q - r.mp3"},
		{"组合", `a/b\c:d*e?f"g<h>i|j`, "t", `a_b_c_d_e_f_g_h_i_j - t.mp3`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			s := &mmpb.Song{Id: 1, Name: tt.song, Artists: []*mmpb.Artist{{Name: tt.artist}}}
			ext := "mp3"
			if tt.want[len(tt.want)-4:] == "flac" {
				ext = "flac"
			}
			require.Equal(t, tt.want, SongFilename(s, ext))
		})
	}
}

func TestSongFilename_EmptyFallback(t *testing.T) {
	t.Parallel()
	t.Run("歌名空_艺人有", func(t *testing.T) {
		t.Parallel()
		s := &mmpb.Song{Id: 347230, Name: "", Artists: []*mmpb.Artist{{Name: "Beyond"}}}
		require.Equal(t, "Beyond - 347230.mp3", SongFilename(s, "mp3"))
	})
	t.Run("艺人空字符串_歌名有", func(t *testing.T) {
		t.Parallel()
		s := &mmpb.Song{Id: 347230, Name: "海阔天空", Artists: []*mmpb.Artist{{Name: ""}}}
		require.Equal(t, "347230 - 海阔天空.mp3", SongFilename(s, "mp3"))
	})
	t.Run("Artists为nil", func(t *testing.T) {
		t.Parallel()
		s := &mmpb.Song{Id: 347230, Name: "海阔天空"}
		require.Equal(t, "347230 - 海阔天空.mp3", SongFilename(s, "mp3"))
	})
	t.Run("全空用id兜底", func(t *testing.T) {
		t.Parallel()
		s := &mmpb.Song{Id: 347230, Name: "", Artists: []*mmpb.Artist{{Name: ""}}}
		require.Equal(t, "347230.mp3", SongFilename(s, "mp3"))
	})
}

// ResolveConflictPath 测试(新增,PRD-0013 文件名冲突处理)。

// touchFile 在 dir 下创建空文件(模拟「已存在」)。
func touchFile(t *testing.T, path string) {
	t.Helper()
	if err := os.WriteFile(path, []byte("x"), 0o644); err != nil {
		t.Fatalf("touch %s: %v", path, err)
	}
}

func TestResolveConflictPath_NoConflict(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	s := &mmpb.Song{Id: 1, Name: "晴天", Artists: []*mmpb.Artist{{Name: "周杰伦"}}}

	path, skipped := ResolveConflictPath(s, "mp3", dir, "", false)
	require.False(t, skipped, "无冲突不应跳过")
	require.Equal(t, filepath.Join(dir, "周杰伦 - 晴天.mp3"), path)
}

func TestResolveConflictPath_DefaultConflict_FallbackToID(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	s := &mmpb.Song{Id: 347230, Name: "晴天", Artists: []*mmpb.Artist{{Name: "周杰伦"}}}
	// 预置默认名文件 → 应回退到 ({id})。
	touchFile(t, filepath.Join(dir, "周杰伦 - 晴天.mp3"))

	path, skipped := ResolveConflictPath(s, "mp3", dir, "", false)
	require.False(t, skipped, "回退名不存在不应跳过")
	require.Equal(t, filepath.Join(dir, "周杰伦 - 晴天 (347230).mp3"), path)
}

func TestResolveConflictPath_BothExist_Skipped(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	s := &mmpb.Song{Id: 347230, Name: "晴天", Artists: []*mmpb.Artist{{Name: "周杰伦"}}}
	// 默认名 + 回退名都存在 → 跳过(不自动 (2),保幂等)。
	touchFile(t, filepath.Join(dir, "周杰伦 - 晴天.mp3"))
	touchFile(t, filepath.Join(dir, "周杰伦 - 晴天 (347230).mp3"))

	path, skipped := ResolveConflictPath(s, "mp3", dir, "", false)
	require.True(t, skipped, "两文件都存在应跳过")
	// path 返回默认名(供调用方提示「已跳过:XX」用)。
	require.Equal(t, filepath.Join(dir, "周杰伦 - 晴天.mp3"), path)
}

func TestResolveConflictPath_ForceOverwrites(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	s := &mmpb.Song{Id: 1, Name: "晴天", Artists: []*mmpb.Artist{{Name: "周杰伦"}}}
	touchFile(t, filepath.Join(dir, "周杰伦 - 晴天.mp3"))

	// force=true:即使默认名存在也用它(覆盖语义,不回退不跳过)。
	path, skipped := ResolveConflictPath(s, "mp3", dir, "", true)
	require.False(t, skipped, "force 应覆盖不跳过")
	require.Equal(t, filepath.Join(dir, "周杰伦 - 晴天.mp3"), path)
}

func TestResolveConflictPath_IdempotentRerun(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	s := &mmpb.Song{Id: 347230, Name: "晴天", Artists: []*mmpb.Artist{{Name: "周杰伦"}}}

	// 模拟第一次下载落盘回退名后,重跑:默认名不存在(因第一次就走了回退),
	// 第二次应回到默认名?不对——默认名第一次就不存在才走默认。
	// 真实续传场景:第一次默认名存在→走回退名(347230)→落盘。重跑时默认名仍存在
	// (没被覆盖)、回退名也存在(第一次落的)→ 跳过。这是续传幂等。
	touchFile(t, filepath.Join(dir, "周杰伦 - 晴天.mp3"))
	touchFile(t, filepath.Join(dir, "周杰伦 - 晴天 (347230).mp3"))

	_, skipped := ResolveConflictPath(s, "mp3", dir, "", false)
	require.True(t, skipped, "重跑已落盘的回退名应跳过(幂等)")
}

// ==================== FormatFilename(--filename 模板,issue #24)====================

func TestFormatFilename_Placeholders(t *testing.T) {
	t.Parallel()
	s := &mmpb.Song{
		Id:      347230,
		Name:    "海阔天空",
		Artists: []*mmpb.Artist{{Name: "Beyond"}},
		Album:   &mmpb.Album{Name: "乐与怒"},
	}
	cases := []struct {
		name string
		tmpl string
		want string
	}{
		// 注意:模板里的 / 会被 sanitize 成 _(路径不安全),用 _ 或 - 做分隔。
		{"全部占位符", "{artist}_{album}_{title}", "Beyond_乐与怒_海阔天空.mp3"},
		{"id 占位符", "{title} - {id}", "海阔天空 - 347230.mp3"},
		{"自定义分隔", "{id}_{title}", "347230_海阔天空.mp3"},
		{"仅 title", "{title}", "海阔天空.mp3"},
		{"未知占位符字面保留", "{title} {foo} {bar}", "海阔天空 {foo} {bar}.mp3"},
		{"混合已知未知", "{artist}_{title}_{xyz}", "Beyond_海阔天空_{xyz}.mp3"},
		{"无占位符纯字面", "my-song", "my-song.mp3"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := FormatFilename(tc.tmpl, s, "mp3"); got != tc.want {
				t.Errorf("FormatFilename(%q) = %q, want %q", tc.tmpl, got, tc.want)
			}
		})
	}
}

// TestFormatFilename_SanitizesPathChars 模板产出的文件名仍过滤路径不安全字符。
func TestFormatFilename_SanitizesPathChars(t *testing.T) {
	t.Parallel()
	s := &mmpb.Song{
		Id: 1, Name: "a/b",
		Artists: []*mmpb.Artist{{Name: "X:Y"}},
	}
	if got := FormatFilename("{artist} - {title}", s, "mp3"); got != "X_Y - a_b.mp3" {
		t.Errorf("应过滤路径字符, got %q", got)
	}
}

// TestFormatFilename_EmptyFieldsLiteral 自定义模板字段缺失保留字面(不 id 兜底)。
// 这是与 SongFilename(默认模板)的关键区别:用户模板按 PRD 保留空串。
func TestFormatFilename_EmptyFieldsLiteral(t *testing.T) {
	t.Parallel()
	s := &mmpb.Song{Id: 5, Name: ""} // 无艺人无歌名
	// 自定义模板:空字段产 " - .mp3"(字面),不做 id 兜底。
	if got := FormatFilename("{artist} - {title}", s, "mp3"); got != " - .mp3" {
		t.Errorf("自定义模板空字段应字面(不兜底), got %q", got)
	}
}

// TestResolveConflictPath_CustomTemplate 自定义模板的冲突回退:主名 → 模板+({id})。
func TestResolveConflictPath_CustomTemplate(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	s := &mmpb.Song{Id: 347230, Name: "晴天", Artists: []*mmpb.Artist{{Name: "周杰伦"}}}
	// 预置自定义主名文件 → 应回退到模板 + ({id})。
	tmpl := "{title} - {id}"
	primary := FormatFilename(tmpl, s, "mp3") // "晴天 - 347230.mp3"
	touchFile(t, filepath.Join(dir, primary))

	path, skipped := ResolveConflictPath(s, "mp3", dir, tmpl, false)
	require.False(t, skipped, "回退名不存在不应跳过")
	want := filepath.Join(dir, FormatFallbackFilename(tmpl, s, "mp3")) // "晴天 - 347230 (347230).mp3"
	require.Equal(t, want, path)
}

// TestSongFilename_DelegatesToDefault SongFilename 等价 FormatFilename(默认模板)。
// 回归保护:重构后默认行为不变。
func TestSongFilename_DelegatesToDefault(t *testing.T) {
	t.Parallel()
	s := &mmpb.Song{Id: 1, Name: "晴天", Artists: []*mmpb.Artist{{Name: "周杰伦"}}}
	// SongFilename 应等于 FormatFilename(默认模板 + 空值兜底)。
	require.Equal(t, SongFilename(s, "mp3"), FormatFilename(applyDefaultEmptyFallback(s), s, "mp3"))
}
