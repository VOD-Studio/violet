package service

import (
	"context"
	"errors"
	"fmt"

	"blog-api/internal/repository/generated"
)

// 表情业务错误定义
var (
	ErrEmojiGroupNotFound = errors.New("表情分组不存在")
	ErrEmojiNotFound      = errors.New("表情不存在")
)

// EmojiService 表情服务
type EmojiService struct {
	queries      *generated.Queries
	rendererCache *SimpleEmojiCache
}

// NewEmojiService 创建表情服务实例
func NewEmojiService(queries *generated.Queries) *EmojiService {
	return &EmojiService{
		queries: queries,
	}
}

// RefreshCache 刷新表情缓存
func (s *EmojiService) RefreshCache(ctx context.Context) error {
	emojis, err := s.queries.ListAllEmojisWithGroup(ctx)
	if err != nil {
		return fmt.Errorf("获取表情列表失败: %w", err)
	}
	s.rendererCache = NewSimpleEmojiCache(emojis)
	return nil
}

// GetCache 获取渲染器缓存
func (s *EmojiService) GetCache() EmojiCache {
	return s.rendererCache
}

// --- 表情分组响应类型 ---

// EmojiGroupResponse 表情分组响应
type EmojiGroupResponse struct {
	ID        int32             `json:"id"`
	Name      string            `json:"name"`
	Source    string            `json:"source"`
	SortOrder int32             `json:"sort_order"`
	IsEnabled bool              `json:"is_enabled"`
	CreatedAt string            `json:"created_at"`
	Emojis    []*EmojiResponse  `json:"emojis,omitempty"`
}

// EmojiResponse 表情响应
type EmojiResponse struct {
	ID          int32  `json:"id"`
	GroupID     int32  `json:"group_id"`
	Name        string `json:"name"`
	URL         string `json:"url,omitempty"`
	TextContent string `json:"text_content,omitempty"`
	SortOrder   int32  `json:"sort_order"`
	CreatedAt   string `json:"created_at"`
}

// --- 公开接口 ---

// GetAllEmojisForPublic 获取所有公开表情分组和表情
func (s *EmojiService) GetAllEmojisForPublic(ctx context.Context) ([]*EmojiGroupResponse, error) {
	// 获取所有启用的分组
	groups, err := s.queries.ListEmojiGroups(ctx)
	if err != nil {
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

	return responses, nil
}

// GetEmojiGroupByID 获取单个表情分组
func (s *EmojiService) GetEmojiGroupByID(ctx context.Context, id int32) (*EmojiGroupResponse, error) {
	group, err := s.queries.GetEmojiGroupByID(ctx, id)
	if err != nil {
		return nil, ErrEmojiGroupNotFound
	}
	return emojiGroupToResponse(group), nil
}

// ListEmojiGroups 获取所有启用的表情分组（公开）
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

// GetEmojiGroupByName 获取指定名称的表情分组（含表情）
func (s *EmojiService) GetEmojiGroupByName(ctx context.Context, name string) (*EmojiGroupResponse, error) {
	group, err := s.queries.GetEmojiGroupByName(ctx, name)
	if err != nil {
		return nil, ErrEmojiGroupNotFound
	}

	resp := emojiGroupToResponse(group)
	emojis, err := s.queries.ListEmojisByGroup(ctx, group.ID)
	if err == nil {
		resp.Emojis = make([]*EmojiResponse, 0, len(emojis))
		for _, e := range emojis {
			resp.Emojis = append(resp.Emojis, emojiToResponse(e))
		}
	}

	return resp, nil
}

// --- 管理接口：分组操作 ---

// ListAllEmojiGroups 获取所有表情分组（含未启用）
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

// CreateEmojiGroupInput 创建表情分组输入
type CreateEmojiGroupInput struct {
	Name      string
	Source    string
	SortOrder int32
	IsEnabled bool
}

// CreateEmojiGroup 创建表情分组
func (s *EmojiService) CreateEmojiGroup(ctx context.Context, input CreateEmojiGroupInput) (*EmojiGroupResponse, error) {
	params := generated.CreateEmojiGroupParams{
		Name:      input.Name,
		Source:    input.Source,
		SortOrder: input.SortOrder,
		IsEnabled: input.IsEnabled,
	}

	group, err := s.queries.CreateEmojiGroup(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("创建表情分组失败: %w", err)
	}

	return emojiGroupToResponse(group), nil
}

// UpdateEmojiGroupInput 更新表情分组输入
type UpdateEmojiGroupInput struct {
	ID        int32
	Name      string
	Source    string
	SortOrder int32
	IsEnabled bool
}

// UpdateEmojiGroup 更新表情分组
func (s *EmojiService) UpdateEmojiGroup(ctx context.Context, input UpdateEmojiGroupInput) (*EmojiGroupResponse, error) {
	params := generated.UpdateEmojiGroupParams{
		ID:        input.ID,
		Name:      input.Name,
		Source:    input.Source,
		SortOrder: input.SortOrder,
		IsEnabled: input.IsEnabled,
	}

	group, err := s.queries.UpdateEmojiGroup(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("更新表情分组失败: %w", err)
	}

	return emojiGroupToResponse(group), nil
}

// DeleteEmojiGroup 删除表情分组（会同时删除分组内的所有表情）
func (s *EmojiService) DeleteEmojiGroup(ctx context.Context, id int32) error {
	// 先删除分组内的表情
	err := s.queries.DeleteEmojisByGroup(ctx, id)
	if err != nil {
		return fmt.Errorf("删除分组内表情失败: %w", err)
	}

	// 再删除分组
	err = s.queries.DeleteEmojiGroup(ctx, id)
	if err != nil {
		return fmt.Errorf("删除表情分组失败: %w", err)
	}
	return nil
}

// --- 管理接口：表情操作 ---

// GetEmojiByID 获取单个表情
func (s *EmojiService) GetEmojiByID(ctx context.Context, id int32) (*EmojiResponse, error) {
	emoji, err := s.queries.GetEmojiByID(ctx, id)
	if err != nil {
		return nil, ErrEmojiNotFound
	}
	return emojiToResponse(emoji), nil
}

// ListEmojisByGroup 获取分组内所有表情
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

// CreateEmojiInput 创建表情输入
type CreateEmojiInput struct {
	GroupID     int32
	Name        string
	URL         string
	TextContent string
	SortOrder   int32
}

// CreateEmoji 创建表情
func (s *EmojiService) CreateEmoji(ctx context.Context, input CreateEmojiInput) (*EmojiResponse, error) {
	params := generated.CreateEmojiParams{
		GroupID:     input.GroupID,
		Name:        input.Name,
		Url:         toNullString(input.URL),
		TextContent: toNullString(input.TextContent),
		SortOrder:   input.SortOrder,
	}

	emoji, err := s.queries.CreateEmoji(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("创建表情失败: %w", err)
	}

	return emojiToResponse(emoji), nil
}

// UpdateEmojiInput 更新表情输入
type UpdateEmojiInput struct {
	ID          int32
	Name        string
	URL         string
	TextContent string
	SortOrder   int32
}

// UpdateEmoji 更新表情
func (s *EmojiService) UpdateEmoji(ctx context.Context, input UpdateEmojiInput) (*EmojiResponse, error) {
	params := generated.UpdateEmojiParams{
		ID:          input.ID,
		Name:        input.Name,
		Url:         toNullString(input.URL),
		TextContent: toNullString(input.TextContent),
		SortOrder:   input.SortOrder,
	}

	emoji, err := s.queries.UpdateEmoji(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("更新表情失败: %w", err)
	}

	return emojiToResponse(emoji), nil
}

// DeleteEmoji 删除表情
func (s *EmojiService) DeleteEmoji(ctx context.Context, id int32) error {
	err := s.queries.DeleteEmoji(ctx, id)
	if err != nil {
		return fmt.Errorf("删除表情失败: %w", err)
	}
	return nil
}

// --- 辅助函数 ---

func emojiGroupToResponse(g *generated.EmojiGroup) *EmojiGroupResponse {
	return &EmojiGroupResponse{
		ID:        g.ID,
		Name:      g.Name,
		Source:    g.Source,
		SortOrder: g.SortOrder,
		IsEnabled: g.IsEnabled,
		CreatedAt: g.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

func emojiToResponse(e *generated.Emoji) *EmojiResponse {
	resp := &EmojiResponse{
		ID:        e.ID,
		GroupID:   e.GroupID,
		Name:      e.Name,
		SortOrder: e.SortOrder,
		CreatedAt: e.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	if e.Url.Valid {
		resp.URL = e.Url.String
	}
	if e.TextContent.Valid {
		resp.TextContent = e.TextContent.String
	}

	return resp
}