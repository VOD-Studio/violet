package kit

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// Session 是落盘的登录会话。cookie 属于敏感信息:
// 目录 0700、文件 0600,且不把完整 cookie 打印到终端。
type Session struct {
	Cookie  string `json:"cookie"`
	UserID  int64  `json:"user_id,omitempty"`
	SavedAt string `json:"saved_at"`
}

// CurrentCookie 返回当前生效的 cookie: 环境变量 NETEASE_COOKIE 优先,其次本地会话文件。
func (k *Kit) CurrentCookie() string {
	if c := os.Getenv("NETEASE_COOKIE"); c != "" {
		return c
	}
	sess, err := k.LoadSession()
	if err != nil {
		return ""
	}
	return sess.Cookie
}

// SessionPath 在 paths.go 定义(<ConfigDir>/session.json),为避免分散,所有
// 状态文件路径(SessionPath/ConfigDir/HistoryPath)统一由 paths.go 提供。

// SaveSession 把会话写盘(目录 0700 / 文件 0600)。
func (k *Kit) SaveSession(sess Session) error {
	p, err := SessionPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o700); err != nil {
		return err
	}
	b, err := json.Marshal(sess)
	if err != nil {
		return err
	}
	// 先写临时文件再 rename,避免中断留下半个 JSON。
	tmp := p + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, p)
}

// SessionPath/ConfigDir/HistoryPath 见 paths.go(同包,唯一路径 seam)。
//
// LoadSession 读本地会话。文件不存在或损坏时返回 error。
func (k *Kit) LoadSession() (Session, error) {
	var sess Session
	p, err := SessionPath()
	if err != nil {
		return sess, err
	}
	b, err := os.ReadFile(p)
	if err != nil {
		return sess, err
	}
	if err := json.Unmarshal(b, &sess); err != nil {
		return sess, err
	}
	if sess.Cookie == "" {
		return sess, fmt.Errorf("会话文件 %s 中没有 cookie", p)
	}
	return sess, nil
}

// ClearSession 删除本地会话文件,不存在时不算错误。
func (k *Kit) ClearSession() error {
	p, err := SessionPath()
	if err != nil {
		return err
	}
	if err := os.Remove(p); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
