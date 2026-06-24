package storage

import (
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSafePath_RejectsTraversal(t *testing.T) {
	base, _ := filepath.Abs("/tmp/uploads_test")
	ls := &LocalStorage{uploadDir: base}

	// 正常子路径放行
	_, err := ls.safePath(filepath.Join(base, "emoji", "x.png"))
	assert.NoError(t, err)

	// 穿越 base 应拒绝
	_, err = ls.safePath(filepath.Join(base, "..", "..", "etc", "passwd"))
	assert.Error(t, err)

	// 绝对路径逃逸应拒绝
	_, err = ls.safePath("/etc/passwd")
	require.Error(t, err)
}

func TestSaveChunk_RejectsTraversalDir(t *testing.T) {
	tmp := t.TempDir()
	ls := &LocalStorage{uploadDir: tmp}
	err := ls.SaveChunk(filepath.Join(tmp, "..", "..", "tmp_evil"), 0, []byte("x"))
	assert.Error(t, err)
}

func TestMergeChunks_RejectsTraversalDest(t *testing.T) {
	tmp := t.TempDir()
	ls := &LocalStorage{uploadDir: tmp}
	// destPath 逃逸 base
	err := ls.MergeChunks(tmp, 0, filepath.Join(tmp, "..", "..", "evil_out"))
	assert.Error(t, err)
}

func TestMove_RejectsTraversalDst(t *testing.T) {
	tmp := t.TempDir()
	ls := &LocalStorage{uploadDir: tmp}
	err := ls.Move(filepath.Join(tmp, "src"), filepath.Join(tmp, "..", "..", "evil_dst"))
	assert.Error(t, err)
}

func TestBuildPath_PurposeDateDirectoryFormat(t *testing.T) {
	tmp := t.TempDir()
	ls := &LocalStorage{uploadDir: tmp, urlPrefix: "/uploads/"}
	ts := time.Date(2026, 6, 24, 14, 30, 52, 0, time.UTC)
	path, url, err := ls.BuildPath("avatar", ts, "550e8400", ".webp")
	require.NoError(t, err)

	// 物理路径:uploads/avatar/2026/06/24/143052.550e8400.webp
	assert.Contains(t, path, "avatar/2026/06/24")
	assert.Contains(t, path, "143052.550e8400.webp")

	// URL:/uploads/avatar/2026/06/24/143052.550e8400.webp
	assert.Equal(t, "/uploads/avatar/2026/06/24/143052.550e8400.webp", url)
}

func TestBuildPath_RejectsTraversalPurpose(t *testing.T) {
	tmp := t.TempDir()
	ls := &LocalStorage{uploadDir: tmp, urlPrefix: "/uploads/"}
	ts := time.Now()
	_, _, err := ls.BuildPath("..", ts, "uuid", ".png")
	require.Error(t, err)
}

func TestBuildPath_KeepsInUploadDir(t *testing.T) {
	tmp := t.TempDir()
	ls := &LocalStorage{uploadDir: tmp, urlPrefix: "/uploads/"}
	ts := time.Now()
	path, _, err := ls.BuildPath("material", ts, "uuid", ".png")
	require.NoError(t, err)
	// 路径必须在 uploadDir 之下
	rel, err := filepath.Rel(tmp, path)
	require.NoError(t, err)
	assert.False(t, strings.HasPrefix(rel, ".."), "路径逃逸出 uploadDir")
}
