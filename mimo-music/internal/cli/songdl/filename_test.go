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

	path, skipped := ResolveConflictPath(s, "mp3", dir, false)
	require.False(t, skipped, "无冲突不应跳过")
	require.Equal(t, filepath.Join(dir, "周杰伦 - 晴天.mp3"), path)
}

func TestResolveConflictPath_DefaultConflict_FallbackToID(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	s := &mmpb.Song{Id: 347230, Name: "晴天", Artists: []*mmpb.Artist{{Name: "周杰伦"}}}
	// 预置默认名文件 → 应回退到 ({id})。
	touchFile(t, filepath.Join(dir, "周杰伦 - 晴天.mp3"))

	path, skipped := ResolveConflictPath(s, "mp3", dir, false)
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

	path, skipped := ResolveConflictPath(s, "mp3", dir, false)
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
	path, skipped := ResolveConflictPath(s, "mp3", dir, true)
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

	_, skipped := ResolveConflictPath(s, "mp3", dir, false)
	require.True(t, skipped, "重跑已落盘的回退名应跳过(幂等)")
}
