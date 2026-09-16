// Package chatappearance 编排公开聊天外观读取与仅限本人的偏好写入。
package chatappearance

import (
	"context"
	"errors"
	"fmt"

	domain "blog-api/internal/domain/chatappearance"
)

// Service 不持有进程级用户状态;鉴权由 HTTP 边界完成。
type Service struct{ store domain.Store }

// NewService 注入持久化存储。
func NewService(store domain.Store) *Service { return &Service{store: store} }

// Get 返回用户已保存的外观;从未设置时返回零值/默认态。
func (s *Service) Get(ctx context.Context, actorID string) (domain.State, error) {
	if !domain.ValidUserID(actorID) {
		return domain.State{}, domain.ErrInvalid
	}
	return s.store.Get(ctx, actorID)
}

// Update 全量替换选择,带乐观并发保护。
func (s *Service) Update(ctx context.Context, actorID string, selection domain.Selection, revision int64) (domain.State, error) {
	if !domain.ValidUserID(actorID) || revision < 0 || revision > domain.MaxRevision {
		return domain.State{}, domain.ErrInvalid
	}
	if err := selection.Validate(); err != nil {
		return domain.State{}, err
	}
	state, err := s.store.CompareAndSwap(ctx, actorID, selection, revision)
	if !errors.Is(err, domain.ErrConflict) {
		return state, err
	}
	// 传输层重试可能在响应丢失后重放已成功的 PUT:仅当已存内容与本次完全一致
	// 且版本号恰好是下一个时,视为同一次保存,返回成功。
	current, readErr := s.store.Get(ctx, actorID)
	if readErr != nil {
		return domain.State{}, readErr
	}
	if current.Revision == revision+1 && current.Selection == selection {
		return current, nil
	}
	return domain.State{}, domain.ErrConflict
}

// List 只返回公开装饰,不含私有账号数据或他人的版本号。
func (s *Service) List(ctx context.Context, ids []string) (map[string]domain.Selection, error) {
	if len(ids) == 0 || len(ids) > domain.MaxBatch {
		return nil, domain.ErrInvalid
	}
	unique := make([]string, 0, len(ids))
	seen := make(map[string]bool, len(ids))
	for _, id := range ids {
		if !domain.ValidUserID(id) {
			return nil, fmt.Errorf("%w: user_ids", domain.ErrInvalid)
		}
		if !seen[id] {
			unique = append(unique, id)
			seen[id] = true
		}
	}
	return s.store.GetMany(ctx, unique)
}
