package storage

import (
	"path/filepath"
	"testing"

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

func TestBuildPath_RejectsTraversalPurpose(t *testing.T) {
	tmp := t.TempDir()
	ls := &LocalStorage{uploadDir: tmp}
	_, _, err := ls.BuildPath("..", "image/png", "uuid", ".png")
	require.Error(t, err)
}

func TestBuildPath_AllowsValidPurpose(t *testing.T) {
	tmp := t.TempDir()
	ls := &LocalStorage{uploadDir: tmp}
	path, url, err := ls.BuildPath("material", "image/png", "uuid", ".png")
	require.NoError(t, err)
	require.Contains(t, path, "material")
	assert.Contains(t, url, "material")
}
