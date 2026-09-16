// Package chatappearance 定义用户的公开聊天装饰,不依赖 HTTP 或存储实现。
package chatappearance

import (
	"context"
	"errors"
	"fmt"
	"regexp"
)

// MaxBatch 限制单次公开批量查询的上限,约束 SQL 与响应体积。
const MaxBatch = 50

// MaxRevision 自增一后仍不超出 JavaScript Number 的精确整数范围。
const MaxRevision int64 = 9007199254740990

var (
	// ErrInvalid 表示目录项不存在或输入格式非法。
	ErrInvalid = errors.New("invalid chat appearance")
	// ErrConflict 表示调用方读取后有并发写入抢先,需重读后再试。
	ErrConflict = errors.New("chat appearance revision conflict")
	uuidPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
)

// Selection 只保存目录 ID,零值即恢复原始聊天样式。
type Selection struct {
	AvatarFrameID string `json:"avatar_frame_id"`
	AvatarCharmID string `json:"avatar_charm_id"`
	BubbleThemeID string `json:"bubble_theme_id"`
}

// State 附带 CAS 乐观锁版本号;未保存过外观时版本号为零。
type State struct {
	Selection
	Revision int64 `json:"revision"`
}

// Validate 只接受目录 ID,拒绝 URL、CSS、路径等一切未登记值,不落库不安全内容。
func (s Selection) Validate() error {
	for _, item := range []struct {
		name, value string
		allowed     map[string]struct{}
	}{
		{"avatar_frame_id", s.AvatarFrameID, frames},
		{"avatar_charm_id", s.AvatarCharmID, charms},
		{"bubble_theme_id", s.BubbleThemeID, bubbles},
	} {
		if item.value == "" {
			continue
		}
		if _, ok := item.allowed[item.value]; !ok {
			return fmt.Errorf("%w: %s", ErrInvalid, item.name)
		}
	}
	return nil
}

// ValidUserID 只接受小写规范 UUID 并排除零 UUID;仅做格式校验,不代表授权判定。
func ValidUserID(id string) bool {
	return uuidPattern.MatchString(id) && id != "00000000-0000-0000-0000-000000000000"
}

// Store 持久化边界;CompareAndSwap 必须原子完成,含首次插入。
type Store interface {
	Get(context.Context, string) (State, error)
	GetMany(context.Context, []string) (map[string]Selection, error)
	CompareAndSwap(context.Context, string, Selection, int64) (State, error)
}
