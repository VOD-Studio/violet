package system

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"blog-api/config"
	appsystem "blog-api/internal/application/system"
)

func TestBackupImportAcceptsCurrentInstanceSignatureAndRejectsTampering(t *testing.T) {
	root := t.TempDir()
	key := []byte("test-signing-key")
	manager, err := NewBackupManager(config.DatabaseConfig{}, filepath.Join(root, "backups"), filepath.Join(root, "uploads"), key)
	if err != nil {
		t.Fatalf("构造备份管理器失败: %v", err)
	}

	body := []byte("SELECT 1;\n")
	valid := signedBackup(key, body)
	info, err := manager.Import(context.Background(), "source.sql", bytes.NewReader(valid), 1<<20)
	if err != nil {
		t.Fatalf("当前实例签名的备份应可导入: %v", err)
	}
	if info.Origin != appsystem.BackupOriginImport {
		t.Fatalf("导入来源错误: %s", info.Origin)
	}
	if _, err := os.Stat(filepath.Join(root, "backups", info.Filename)); err != nil {
		t.Fatalf("导入文件未落盘: %v", err)
	}

	tampered := append([]byte(nil), valid...)
	tampered[len(tampered)-2] = '2'
	if _, err := manager.Import(context.Background(), "tampered.sql", bytes.NewReader(tampered), 1<<20); err == nil {
		t.Fatal("内容被篡改的备份不得导入")
	}
}

func TestBackupRestoreUsesSingleTransactionAndStopsOnError(t *testing.T) {
	root := t.TempDir()
	binDir := filepath.Join(root, "bin")
	if err := os.Mkdir(binDir, 0o755); err != nil {
		t.Fatalf("创建测试命令目录失败: %v", err)
	}
	argsPath := filepath.Join(root, "psql-args")
	psqlPath := filepath.Join(binDir, "psql")
	script := "#!/bin/sh\nif [ \"$1\" = \"--version\" ]; then echo 'psql (PostgreSQL) 16'; exit 0; fi\nprintf '%s\\n' \"$@\" > \"$ARGS_FILE\"\n"
	if err := os.WriteFile(psqlPath, []byte(script), 0o755); err != nil {
		t.Fatalf("写入测试 psql 失败: %v", err)
	}
	t.Setenv("PATH", binDir+string(os.PathListSeparator)+os.Getenv("PATH"))
	t.Setenv("ARGS_FILE", argsPath)

	key := []byte("test-signing-key")
	manager, err := NewBackupManager(
		config.DatabaseConfig{Host: "db", Port: 5432, User: "user", Name: "violet", SSLMode: "disable"},
		filepath.Join(root, "backups"),
		filepath.Join(root, "uploads"),
		key,
	)
	if err != nil {
		t.Fatalf("构造备份管理器失败: %v", err)
	}
	info, err := manager.Import(
		context.Background(),
		"source.sql",
		bytes.NewReader(signedBackup(key, []byte("SELECT 1;\n"))),
		1<<20,
	)
	if err != nil {
		t.Fatalf("导入测试备份失败: %v", err)
	}

	if err := manager.Restore(context.Background(), info.Filename, nil); err != nil {
		t.Fatalf("恢复签名备份失败: %v", err)
	}
	args, err := os.ReadFile(argsPath)
	if err != nil {
		t.Fatalf("读取 psql 参数失败: %v", err)
	}
	for _, expected := range []string{"--single-transaction", "ON_ERROR_STOP=1", "--file"} {
		if !strings.Contains(string(args), expected) {
			t.Fatalf("psql 参数缺少 %q: %s", expected, args)
		}
	}
}

func TestNewBackupManagerRejectsPublicUploadSubdirectory(t *testing.T) {
	root := t.TempDir()
	uploads := filepath.Join(root, "uploads")
	if _, err := NewBackupManager(config.DatabaseConfig{}, filepath.Join(uploads, "backups"), uploads, []byte("key")); err == nil {
		t.Fatal("备份目录不得位于公开上传目录内")
	}
}

func signedBackup(key, body []byte) []byte {
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write(body)
	header := backupSignaturePrefix + hex.EncodeToString(mac.Sum(nil)) + "\n"
	return append([]byte(header), body...)
}
