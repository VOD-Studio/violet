package kit

import (
	"os"
	"path/filepath"
)

// userConfigDir 返回 musicctl 本地状态所在基目录,默认指向用户主目录下的 .musicctl。
//
// 它是包级变量(而非直接调 os.UserHomeDir/os.UserConfigDir),便于测试覆写
// 把路径树重定向到 t.TempDir(),不碰用户真实主目录。这是召回池(#G)/补全/
// doctor(#J)/session 测试共用的唯一路径 seam(PRD-0015)。
var userConfigDir = defaultUserConfigDir

// defaultUserConfigDir 返回 ~/.musicctl(PRD-0015 迁移前的基目录)。
//
// 迁移后改指 os.UserConfigDir()/musicctl;迁移期读旧路径另走 legacySessionDir。
func defaultUserConfigDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".musicctl"), nil
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
