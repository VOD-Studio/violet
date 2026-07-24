package kit

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// writeLegacySession 在 ~/.musicctl/(用 os.UserHomeDir 注入到临时目录)写一个旧 session。
// 返回创建的 legacy 目录路径,供测试断言迁移行为。
func writeLegacySession(t *testing.T, cookie string) {
	t.Helper()
	home := t.TempDir()
	t.Setenv("HOME", home) // legacySessionPath 用 os.UserHomeDir()
	legacyDir := filepath.Join(home, ".musicctl")
	if err := os.MkdirAll(legacyDir, 0o700); err != nil {
		t.Fatal(err)
	}
	legacyFile := filepath.Join(legacyDir, "session.json")
	if err := os.WriteFile(legacyFile, []byte(`{"cookie":"`+cookie+`","saved_at":"2026-01-01T00:00:00Z"}`), 0o600); err != nil {
		t.Fatal(err)
	}
}

// statPerm 返回文件的权限位(低 12 位)。
func statPerm(t *testing.T, path string) os.FileMode {
	t.Helper()
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("stat %s: %v", path, err)
	}
	return info.Mode().Perm()
}

// TestMigrate_NewUser_BothPathsAbsent 两路径都不存在 → 无迁移、无输出、无错误。
func TestMigrate_NewUser_BothPathsAbsent(t *testing.T) {
	withTestConfigDir(t)              // 新路径在临时目录
	t.Setenv("HOME", t.TempDir())     // 旧路径在另一个临时目录(不存在)
	var out capturingWriter
	if err := migrateLegacySession(&out); err != nil {
		t.Fatalf("migrateLegacySession error: %v", err)
	}
	if out.String() != "" {
		t.Errorf("新用户不应有迁移输出,got %q", out.String())
	}
}

// TestMigrate_AlreadyMigrated_NewPathExists 新路径已有文件 → 不查旧路径、无输出。
func TestMigrate_AlreadyMigrated_NewPathExists(t *testing.T) {
	newDir := withTestConfigDir(t)
	// 新路径预置一个 session。
	newPath := filepath.Join(newDir, "session.json")
	if err := os.WriteFile(newPath, []byte(`{"cookie":"new","saved_at":"x"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	// 旧路径也存在(模拟「用户曾用旧版,已迁过」)。
	writeLegacySession(t, "legacy")
	var out capturingWriter
	if err := migrateLegacySession(&out); err != nil {
		t.Fatalf("migrateLegacySession error: %v", err)
	}
	if out.String() != "" {
		t.Errorf("已迁移不应重复迁移/输出,got %q", out.String())
	}
	// 新路径内容不变(没被旧路径覆盖)。
	b, _ := os.ReadFile(newPath)
	if !strings.Contains(string(b), "new") {
		t.Errorf("已迁移用户新文件被覆盖: %s", b)
	}
}

// TestMigrate_LegacyExists_NewPathAbsent 旧路径存在 + 新路径无 → 迁移 + 提示 + 旧文件消失 + 权限 0600。
func TestMigrate_LegacyExists_NewPathAbsent(t *testing.T) {
	newDir := withTestConfigDir(t)
	writeLegacySession(t, "secret-cookie")

	var out capturingWriter
	if err := migrateLegacySession(&out); err != nil {
		t.Fatalf("migrateLegacySession error: %v", err)
	}
	// 提示输出。
	if out.String() == "" {
		t.Error("迁移应有 stderr 提示")
	}
	// 新路径拿到内容。
	newPath := filepath.Join(newDir, "session.json")
	b, err := os.ReadFile(newPath)
	if err != nil {
		t.Fatalf("读迁移后文件: %v", err)
	}
	if !strings.Contains(string(b), "secret-cookie") {
		t.Errorf("迁移后内容不符: %s", b)
	}
	// 权限 0600。
	if got := statPerm(t, newPath); got != 0o600 {
		t.Errorf("迁移后权限 = %o, want 0600", got)
	}
	// 旧文件已移走。
	home, _ := os.UserHomeDir()
	legacyFile := filepath.Join(home, ".musicctl", "session.json")
	if _, err := os.Stat(legacyFile); !os.IsNotExist(err) {
		t.Errorf("旧文件应已移走,stat err = %v", err)
	}
}

// TestMigrate_Failure_MkdirAllBlocked 迁移失败 → 明确 error,不丢旧文件。
func TestMigrate_Failure_MkdirAllBlocked(t *testing.T) {
	// 新路径的父目录设为只读文件(让 MkdirAll 失败)。
	// 用 withTestConfigDir 拿到新基目录,把它改成不可写的形态:在基目录的同级放一个同名文件
	// 使 MkdirAll 因「路径被文件占用」失败。
	tmp := t.TempDir()
	// 让 ConfigDir 指向 tmp/musicctl,但 tmp/musicctl 先创建为一个文件,阻塞 MkdirAll。
	blockingFile := filepath.Join(tmp, "musicctl")
	if err := os.WriteFile(blockingFile, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	orig := userConfigDir
	userConfigDir = func() (string, error) { return blockingFile, nil } // 返回被文件占用的路径
	t.Cleanup(func() { userConfigDir = orig })

	writeLegacySession(t, "legacy")
	var out capturingWriter
	err := migrateLegacySession(&out)
	if err == nil {
		t.Fatal("迁移应失败(MkdirAll 阻塞),got nil")
	}
	// 旧文件保留(没被丢)。
	home, _ := os.UserHomeDir()
	legacyFile := filepath.Join(home, ".musicctl", "session.json")
	if _, err := os.Stat(legacyFile); err != nil {
		t.Errorf("迁移失败时旧文件应保留,stat err = %v", err)
	}
}

// --- session 读写行为不变(路径变了,语义不变)---

func TestSaveThenLoadSession_RoundTrip(t *testing.T) {
	withTestConfigDir(t)
	k := &Kit{}
	sess := Session{Cookie: "abc", UserID: 42, SavedAt: "2026-07-24T00:00:00Z"}
	if err := k.SaveSession(sess); err != nil {
		t.Fatalf("SaveSession: %v", err)
	}
	got, err := k.LoadSession()
	if err != nil {
		t.Fatalf("LoadSession: %v", err)
	}
	if got.Cookie != sess.Cookie || got.UserID != sess.UserID {
		t.Errorf("round-trip 失败: got %+v", got)
	}
}

func TestLoadSession_FileMissing(t *testing.T) {
	// 新路径无文件 + 旧路径也无 → 新用户,LoadSession 应返回错误(未登录)。
	withTestConfigDir(t)
	t.Setenv("HOME", t.TempDir()) // 旧路径不存在
	k := &Kit{}
	if _, err := k.LoadSession(); err == nil {
		t.Error("无会话文件时 LoadSession 应返回 error")
	}
}

func TestSaveSession_Permissions(t *testing.T) {
	dir := withTestConfigDir(t)
	k := &Kit{}
	if err := k.SaveSession(Session{Cookie: "x"}); err != nil {
		t.Fatal(err)
	}
	got := statPerm(t, filepath.Join(dir, "session.json"))
	if got != 0o600 {
		t.Errorf("session.json 权限 = %o, want 0600", got)
	}
}

func TestClearSession_Idempotent(t *testing.T) {
	withTestConfigDir(t)
	k := &Kit{}
	// 不存在时不算错。
	if err := k.ClearSession(); err != nil {
		t.Errorf("ClearSession 不存在时应无错: %v", err)
	}
	if err := k.SaveSession(Session{Cookie: "x"}); err != nil {
		t.Fatal(err)
	}
	if err := k.ClearSession(); err != nil {
		t.Fatalf("ClearSession 存在时: %v", err)
	}
}

// --- helpers ---

// capturingWriter 捕获 stderr 输出供断言。
type capturingWriter struct {
	buf []byte
}

func (w *capturingWriter) Write(p []byte) (int, error) {
	w.buf = append(w.buf, p...)
	return len(p), nil
}

func (w *capturingWriter) String() string { return string(w.buf) }
