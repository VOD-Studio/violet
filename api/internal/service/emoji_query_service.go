package service

import (
	"context"
	"fmt"

	"github.com/rs/zerolog/log"
)

// RefreshCache 刷新表情缓存
func (s *EmojiService) RefreshCache(ctx context.Context) error {
	log.Info().Str("service", "EmojiService").Str("operation", "RefreshCache").Msg("开始刷新表情缓存")

	log.Debug().Str("query", "ListAllEmojisWithGroup").Msg("查询所有表情")
	emojis, err := s.queries.ListAllEmojisWithGroup(ctx)
	if err != nil {
		log.Error().Err(err).Msg("获取表情列表失败")
		return fmt.Errorf("获取表情列表失败: %w", err)
	}
	s.rendererCache = NewSimpleEmojiCache(emojis)
	log.Info().Int("count", len(emojis)).Msg("表情缓存刷新成功")
	return nil
}

// GetCache 获取渲染器缓存
func (s *EmojiService) GetCache() EmojiCache {
	return s.rendererCache
}

// GetAllEmojisForPublic 获取所有公开表情分组和表情
func (s *EmojiService) GetAllEmojisForPublic(ctx context.Context) ([]*EmojiGroupResponse, error) {
	log.Info().Str("service", "EmojiService").Str("operation", "GetAllEmojisForPublic").Msg("获取公开表情")

	// 获取所有启用的分组
	log.Debug().Str("query", "ListEmojiGroups").Msg("查询表情分组")
	groups, err := s.queries.ListEmojiGroups(ctx)
	if err != nil {
		log.Error().Err(err).Msg("获取表情分组列表失败")
		return nil, fmt.Errorf("获取表情分组列表失败: %w", err)
	}

	responses := make([]*EmojiGroupResponse, 0, len(groups))
	for _, g := range groups {
		resp := emojiGroupToResponse(g)
		// 获取分组内的表情
		emojis, err := s.queries.ListEmojisByGroup(ctx, g.ID)
		if err == nil {
			resp.Emojis = make([]*EmojiResponse, 0, len(emojis))
			for _, e := range emojis {
				resp.Emojis = append(resp.Emojis, emojiToResponse(e))
			}
		}
		responses = append(responses, resp)
	}

	log.Info().Int("groups", len(responses)).Msg("公开表情获取成功")
	return responses, nil
}

// ListEmojiGroups 获取所有启用的表情分组
func (s *EmojiService) ListEmojiGroups(ctx context.Context) ([]*EmojiGroupResponse, error) {
	groups, err := s.queries.ListEmojiGroups(ctx)
	if err != nil {
		return nil, fmt.Errorf("获取表情分组列表失败: %w", err)
	}

	responses := make([]*EmojiGroupResponse, 0, len(groups))
	for _, g := range groups {
		responses = append(responses, emojiGroupToResponse(g))
	}
	return responses, nil
}

// GetEmojiGroupByName 根据名称获取表情分组
func (s *EmojiService) GetEmojiGroupByName(ctx context.Context, name string) (*EmojiGroupResponse, error) {
	group, err := s.queries.GetEmojiGroupByName(ctx, name)
	if err != nil {
		return nil, ErrEmojiGroupNotFound
	}

	resp := emojiGroupToResponse(group)

	// 获取分组内的表情
	emojis, err := s.queries.ListEmojisByGroup(ctx, group.ID)
	if err == nil {
		resp.Emojis = make([]*EmojiResponse, 0, len(emojis))
		for _, e := range emojis {
			resp.Emojis = append(resp.Emojis, emojiToResponse(e))
		}
	}

	return resp, nil
}

// ListAllEmojiGroups 获取所有表情分组（包括禁用的）
func (s *EmojiService) ListAllEmojiGroups(ctx context.Context) ([]*EmojiGroupResponse, error) {
	groups, err := s.queries.ListAllEmojiGroups(ctx)
	if err != nil {
		return nil, fmt.Errorf("获取表情分组列表失败: %w", err)
	}

	responses := make([]*EmojiGroupResponse, 0, len(groups))
	for _, g := range groups {
		responses = append(responses, emojiGroupToResponse(g))
	}
	return responses, nil
}

// ListEmojisByGroup 获取分组内的所有表情
func (s *EmojiService) ListEmojisByGroup(ctx context.Context, groupID int32) ([]*EmojiResponse, error) {
	emojis, err := s.queries.ListEmojisByGroup(ctx, groupID)
	if err != nil {
		return nil, fmt.Errorf("获取表情列表失败: %w", err)
	}

	responses := make([]*EmojiResponse, 0, len(emojis))
	for _, e := range emojis {
		responses = append(responses, emojiToResponse(e))
	}
	return responses, nil
}
