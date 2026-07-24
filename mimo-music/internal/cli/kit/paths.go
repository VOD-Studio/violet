package kit

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// userConfigDir 返回 musicctl 本地状态所在基目录,默认指向 os.UserConfigDir()/musicctl
// (macOS ~/Library/Application Support/musicctl、Linux ~/.config/musicctl、Windows %AppData%\musicctl)。
//
// 它是包级变量(而非直接调 os.UserConfigDir),便于测试覆写把路径树重定向到
// t.TempDir(),不碰用户真实主目录。这是召回池(#G)/补全/doctor(#J)/session 测试
// 共用的唯一路径 seam(PRD-0015)。
var userConfigDir = defaultUserConfigDir

// defaultUserConfigDir 返回 os.UserConfigDir()/musicctl。
// os.UserConfigDir() 已含平台子目录(macOS: ~/Library/Application Support;
// Linux: ~/.config;Windows: %AppData%),只需再拼 musicctl。
func defaultUserConfigDir() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("定位用户配置目录失败: %w", err)
	}
	return filepath.Join(base, "musicctl"), nil
}

// ConfigDir 返回 musicctl 本地状态基目录(所有状态文件派生自此)。
// 目录在首次写盘时由调用方 MkdirAll(0700);本函数只算路径不创建。
func ConfigDir() (string, error) {
	return userConfigDir()
}

// SessionPath 返回会话文件路径 <ConfigDir>/session.json。
func SessionPath() (string, error) {
	d, err := ConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(d, "session.json"), nil
}

// HistoryPath 返回召回池事件流文件路径 <ConfigDir>/history.jsonl。
//
// 召回池(#G,PRD-0014)尚未落地;本函数为它预留 seam,与 session 同源派生,
// 使 #G 落盘路径决策零额外成本。当前无调用者。
func HistoryPath() (string, error) {
	d, err := ConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(d, "history.jsonl"), nil
}

// legacySessionPath 返回迁移前旧路径 ~/.musicctl/session.json。
//
// 仅迁移逻辑使用:当新路径无文件时查此路径,存在则搬移到新路径。不作为长期读路径
// (长期只读新路径,避免双真相)。失败时返回 error,迁移逻辑据此判「旧路径不可用,跳过」。
func legacySessionPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("定位主目录失败: %w", err)
	}
	return filepath.Join(home, ".musicctl", "session.json"), nil
}

// migrateLegacySession 把旧路径 ~/.musicctl/session.json 迁到新路径(若需要)。
//
// 惰性触发:LoadSession 首次发现新路径无文件时调用。一次性、无感:
//   - 新路径已有文件 → 已迁移或新用户已登录,直接返回(不查旧路径)。
//   - 新路径无文件 + 旧路径存在 → MkdirAll 新目录(0700) → os.Rename(原子 move)
//     → 设新文件 0600 → 向 stderr 打一次性提示。
//   - 两路径都不存在 → 新用户,无迁移。
//
// 迁移失败不静默吞错:返回 error 由调用方决定(LoadSession 按新路径无文件继续,
// 即未登录,不阻塞命令)。迁移只 move 文件,不删旧目录(防误删用户其他文件)。
func migrateLegacySession(errOut io.Writer) error {
	newPath, err := SessionPath()
	if err != nil {
		return err
	}
	// 新路径已有文件 → 无需迁移。
	if _, err := os.Stat(newPath); err == nil {
		return nil
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("检查会话文件 %s 失败: %w", newPath, err)
	}

	oldPath, err := legacySessionPath()
	if err != nil {
		// 主目录都拿不到,迁移无从谈起;新路径本就无文件,按未登录处理。
		return nil
	}
	if _, err := os.Stat(oldPath); err != nil {
		if !os.IsNotExist(err) {
			return fmt.Errorf("检查旧会话文件 %s 失败: %w", oldPath, err)
		}
		// 旧路径不存在 → 新用户,无迁移。
		return nil
	}

	// 旧路径存在:搬移到新路径。
	if err := os.MkdirAll(filepath.Dir(newPath), 0o700); err != nil {
		return fmt.Errorf("创建配置目录 %s 失败: %w", filepath.Dir(newPath), err)
	}
	if err := os.Rename(oldPath, newPath); err != nil {
		return fmt.Errorf("迁移会话 %s → %s 失败(可手动复制): %w", oldPath, newPath, err)
	}
	// Rename 不一定保留 0600,显式设回(cookie 敏感)。
	if err := os.Chmod(newPath, 0o600); err != nil {
		return fmt.Errorf("设置会话文件权限失败: %w", err)
	}
	fmt.Fprintf(errOut, "已迁移会话到 %s(旧目录 ~/.musicctl/ 可手动删除)\n", filepath.Dir(newPath))
	return nil
}
