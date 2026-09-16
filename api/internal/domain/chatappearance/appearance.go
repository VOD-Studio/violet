// Package chatappearance 定义用户的公开聊天装饰,不依赖 HTTP 或存储实现。
package chatappearance

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"time"
)

// MaxBatch 限制单次公开批量查询的上限,约束 SQL 与响应体积。
const MaxBatch = 50

// MaxRevision 自增一后仍不超出 JavaScript Number 的精确整数范围。
const MaxRevision int64 = 9007199254740990

// MaxEquippedBadges 限制同时佩戴的徽章数量。
const MaxEquippedBadges = 3

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
	// BadgeIDs 佩戴的徽章 ID,按展示顺序排列;不含未持有项。
	BadgeIDs []string `json:"badge_ids"`
}

// Equal 比较两份选择的持久化字段是否完全一致(供 CAS 与幂等重放判定)。
func (s Selection) Equal(other Selection) bool {
	if s.AvatarFrameID != other.AvatarFrameID ||
		s.AvatarCharmID != other.AvatarCharmID ||
		s.BubbleThemeID != other.BubbleThemeID ||
		len(s.BadgeIDs) != len(other.BadgeIDs) {
		return false
	}
	for i := range s.BadgeIDs {
		if s.BadgeIDs[i] != other.BadgeIDs[i] {
			return false
		}
	}
	return true
}

// State 附带 CAS 乐观锁版本号;未保存过外观时版本号为零。
type State struct {
	Selection
	Revision int64 `json:"revision"`
}

// Validate 只接受目录 ID,拒绝 URL、CSS、路径等一切未登记值,不落库不安全内容。
// 徽章只校验形态(数量/重复/目录存在);「是否持有」由应用层判定。
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
	if len(s.BadgeIDs) > MaxEquippedBadges {
		return fmt.Errorf("%w: badge_ids 超过 %d 枚上限", ErrInvalid, MaxEquippedBadges)
	}
	seen := make(map[string]struct{}, len(s.BadgeIDs))
	for _, id := range s.BadgeIDs {
		if _, ok := badges[id]; !ok {
			return fmt.Errorf("%w: badge_ids", ErrInvalid)
		}
		if _, dup := seen[id]; dup {
			return fmt.Errorf("%w: badge_ids 重复", ErrInvalid)
		}
		seen[id] = struct{}{}
	}
	return nil
}

// ValidateBadgeIDs 校验徽章 ID 列表:目录内且无重复;不限数量——持有无上限,佩戴才限 MaxEquippedBadges。
func ValidateBadgeIDs(ids []string) error {
	seen := make(map[string]struct{}, len(ids))
	for _, id := range ids {
		if _, ok := badges[id]; !ok {
			return fmt.Errorf("%w: badge_ids", ErrInvalid)
		}
		if _, dup := seen[id]; dup {
			return fmt.Errorf("%w: badge_ids 重复", ErrInvalid)
		}
		seen[id] = struct{}{}
	}
	return nil
}

// ValidUserID 只接受小写规范 UUID 并排除零 UUID;仅做格式校验,不代表授权判定。
func ValidUserID(id string) bool {
	return uuidPattern.MatchString(id) && id != "00000000-0000-0000-0000-000000000000"
}

// BadgeGrant 一条徽章持有记录;授予幂等,重复授予不产生新记录。
type BadgeGrant struct {
	// BadgeID 徽章目录 ID。
	BadgeID string
	// AwardedAt 授予时间。
	AwardedAt time.Time
	// AwardedBy 授予操作者 ID;空串表示系统授予。
	AwardedBy string
}

// Store 持久化边界;CompareAndSwap 必须原子完成,含首次插入。
type Store interface {
	Get(context.Context, string) (State, error)
	GetMany(context.Context, []string) (map[string]Selection, error)
	CompareAndSwap(context.Context, string, Selection, int64) (State, error)
}

// BadgeStore 徽章持有台账的持久化边界;Grant 必须幂等。
type BadgeStore interface {
	// Grants 返回用户全部持有记录,按授予时间升序。
	Grants(context.Context, string) ([]BadgeGrant, error)
	// GrantsForUsers 一次取回多个用户的持有徽章 ID,缺失用户映射为空切片。
	GrantsForUsers(context.Context, []string) (map[string][]string, error)
	// Grant 批量授予;已持有的 ID 静默跳过。
	Grant(ctx context.Context, operatorID, userID string, badgeIDs []string) error
	// Revoke 撤销一枚;未持有返回 ErrInvalid。
	Revoke(ctx context.Context, userID, badgeID string) error
}
