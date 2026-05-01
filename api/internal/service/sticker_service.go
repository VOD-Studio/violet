package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"blog-api/internal/repository/generated"
)

// 表情包业务错误定义
var (
	ErrStickerGroupNotFound = errors.New("表情包组不存在")
	ErrStickerNotFound      = errors.New("表情包不存在")
	ErrDuplicateSlug        = errors.New("标识符已存在")
)

// StickerService 表情包服务
type StickerService struct {
	queries       *generated.Queries
	rendererCache *SimpleStickerCache
}

// NewStickerService 创建表情包服务实例
func NewStickerService(queries *generated.Queries) *StickerService {
	return &StickerService{
		queries: queries,
	}
}

// RefreshCache 刷新表情包缓存
func (s *StickerService) RefreshCache(ctx context.Context) error {
	stickers, err := s.queries.ListAllStickersWithGroup(ctx)
	if err != nil {
		return fmt.Errorf("获取表情包列表失败: %w", err)
	}
	s.rendererCache = NewSimpleStickerCache(stickers)
	return nil
}

// GetCache 获取渲染器缓存
func (s *StickerService) GetCache() StickerCache {
	return s.rendererCache
}

// --- 表情包组操作 ---

// StickerGroupResponse 表情包组响应
type StickerGroupResponse struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	Type        string    `json:"type"`
	IconURL     string    `json:"icon_url,omitempty"`
	Description string    `json:"description,omitempty"`
	SortOrder   int16     `json:"sort_order"`
	IsHot       bool      `json:"is_hot"`
	IsOfficial  bool      `json:"is_official"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   string    `json:"created_at"`
	UpdatedAt   string    `json:"updated_at"`
	StickerCount int64    `json:"sticker_count,omitempty"`
	Stickers    []*StickerResponse `json:"stickers,omitempty"`
}

// GetStickerGroupByID 获取单个表情包组
func (s *StickerService) GetStickerGroupByID(ctx context.Context, id uuid.UUID) (*StickerGroupResponse, error) {
	group, err := s.queries.GetStickerGroupByID(ctx, id)
	if err != nil {
		return nil, ErrStickerGroupNotFound
	}
	return stickerGroupPtrToResponse(group), nil
}

// CreateStickerGroupInput 创建表情包组输入
type CreateStickerGroupInput struct {
	Name        string
	Slug        string
	Type        string
	IconURL     string
	Description string
	SortOrder   int16
	IsHot       bool
	IsOfficial  bool
	IsActive    bool
}

// CreateStickerGroup 创建表情包组
func (s *StickerService) CreateStickerGroup(ctx context.Context, input CreateStickerGroupInput) (*StickerGroupResponse, error) {
	params := generated.CreateStickerGroupParams{
		Name:        input.Name,
		Slug:        input.Slug,
		Type:        input.Type,
		IconUrl:     toNullString(input.IconURL),
		Description: toNullString(input.Description),
		SortOrder:   input.SortOrder,
		IsHot:       input.IsHot,
		IsOfficial:  input.IsOfficial,
		IsActive:    input.IsActive,
	}

	group, err := s.queries.CreateStickerGroup(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("创建表情包组失败: %w", err)
	}

	return stickerGroupPtrToResponse(group), nil
}

// ListStickerGroups 获取所有表情包组（公开）
func (s *StickerService) ListStickerGroups(ctx context.Context) ([]*StickerGroupResponse, error) {
	groups, err := s.queries.ListStickerGroups(ctx)
	if err != nil {
		return nil, fmt.Errorf("获取表情包组列表失败: %w", err)
	}

	responses := make([]*StickerGroupResponse, 0, len(groups))
	for _, g := range groups {
		responses = append(responses, stickerGroupPtrToResponse(g))
	}
	return responses, nil
}

// ListAllStickerGroups 获取所有表情包组（管理端，含未激活）
func (s *StickerService) ListAllStickerGroups(ctx context.Context) ([]*StickerGroupResponse, error) {
	groups, err := s.queries.ListAllStickerGroups(ctx)
	if err != nil {
		return nil, fmt.Errorf("获取表情包组列表失败: %w", err)
	}

	responses := make([]*StickerGroupResponse, 0, len(groups))
	for _, g := range groups {
		resp := stickerGroupPtrToResponse(g)
		// 获取组内表情包数量
		count, _ := s.queries.CountStickersInGroup(ctx, g.ID)
		resp.StickerCount = int64(count)
		responses = append(responses, resp)
	}
	return responses, nil
}

// UpdateStickerGroupInput 更新表情包组输入
type UpdateStickerGroupInput struct {
	ID          uuid.UUID
	Name        string
	Slug        string
	IconURL     string
	Description string
	SortOrder   int16
	IsHot       bool
	IsOfficial  bool
	IsActive    bool
}

// UpdateStickerGroup 更新表情包组
func (s *StickerService) UpdateStickerGroup(ctx context.Context, input UpdateStickerGroupInput) (*StickerGroupResponse, error) {
	params := generated.UpdateStickerGroupParams{
		ID:          input.ID,
		Name:        input.Name,
		Slug:        input.Slug,
		IconUrl:     toNullString(input.IconURL),
		Description: toNullString(input.Description),
		SortOrder:   input.SortOrder,
		IsHot:       input.IsHot,
		IsOfficial:  input.IsOfficial,
		IsActive:    input.IsActive,
	}

	group, err := s.queries.UpdateStickerGroup(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("更新表情包组失败: %w", err)
	}

	return stickerGroupPtrToResponse(group), nil
}

// DeleteStickerGroup 删除表情包组
func (s *StickerService) DeleteStickerGroup(ctx context.Context, id uuid.UUID) error {
	err := s.queries.DeleteStickerGroup(ctx, id)
	if err != nil {
		return fmt.Errorf("删除表情包组失败: %w", err)
	}
	return nil
}

// --- 表情包操作 ---

// StickerResponse 表情包响应
type StickerResponse struct {
	ID         uuid.UUID `json:"id"`
	GroupID    uuid.UUID `json:"group_id"`
	GroupName  string    `json:"group_name,omitempty"`
	GroupSlug  string    `json:"group_slug,omitempty"`
	Name       string    `json:"name"`
	Slug       string    `json:"slug"`
	ImageURL   string    `json:"image_url"`
	Width      int16     `json:"width"`
	Height     int16     `json:"height"`
	UsageCount int64     `json:"usage_count"`
	SortOrder  int16     `json:"sort_order"`
	IsActive   bool      `json:"is_active"`
	CreatedAt  string    `json:"created_at"`
	UpdatedAt  string    `json:"updated_at"`
	IsFavorited bool     `json:"is_favorited,omitempty"`
}

// CreateStickerInput 创建表情包输入
type CreateStickerInput struct {
	GroupID   uuid.UUID
	Name      string
	Slug      string
	ImageURL  string
	Width     int16
	Height    int16
	SortOrder int16
	IsActive  bool
}

// CreateSticker 创建表情包
func (s *StickerService) CreateSticker(ctx context.Context, input CreateStickerInput) (*StickerResponse, error) {
	params := generated.CreateStickerParams{
		GroupID:   input.GroupID,
		Name:      input.Name,
		Slug:      input.Slug,
		ImageUrl:  input.ImageURL,
		Width:     nullInt16(input.Width),
		Height:    nullInt16(input.Height),
		SortOrder: input.SortOrder,
		IsActive:  input.IsActive,
	}

	sticker, err := s.queries.CreateSticker(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("创建表情包失败: %w", err)
	}

	return stickerPtrToResponse(sticker), nil
}

// ListStickersByGroup 获取组内表情包（公开）
func (s *StickerService) ListStickersByGroup(ctx context.Context, groupID uuid.UUID) ([]*StickerResponse, error) {
	stickers, err := s.queries.ListStickersByGroup(ctx, groupID)
	if err != nil {
		return nil, fmt.Errorf("获取表情包列表失败: %w", err)
	}

	responses := make([]*StickerResponse, 0, len(stickers))
	for _, st := range stickers {
		responses = append(responses, stickerPtrToResponse(st))
	}
	return responses, nil
}

// ListAllStickersByGroup 获取组内表情包（管理端）
func (s *StickerService) ListAllStickersByGroup(ctx context.Context, groupID uuid.UUID) ([]*StickerResponse, error) {
	stickers, err := s.queries.ListAllStickersByGroup(ctx, groupID)
	if err != nil {
		return nil, fmt.Errorf("获取表情包列表失败: %w", err)
	}

	responses := make([]*StickerResponse, 0, len(stickers))
	for _, st := range stickers {
		responses = append(responses, stickerPtrToResponse(st))
	}
	return responses, nil
}

// GetStickerGroupWithStickers 获取表情包组及其表情包
func (s *StickerService) GetStickerGroupWithStickers(ctx context.Context, groupSlug string) (*StickerGroupResponse, error) {
	group, err := s.queries.GetStickerGroupBySlug(ctx, groupSlug)
	if err != nil {
		return nil, ErrStickerGroupNotFound
	}

	stickers, err := s.queries.ListStickersByGroup(ctx, group.ID)
	if err != nil {
		return nil, fmt.Errorf("获取表情包列表失败: %w", err)
	}

	resp := stickerGroupPtrToResponse(group)
	resp.Stickers = make([]*StickerResponse, 0, len(stickers))
	for _, st := range stickers {
		resp.Stickers = append(resp.Stickers, stickerPtrToResponse(st))
	}

	return resp, nil
}

// GetAllStickersForPublic 获取所有公开表情包（供用户使用）
func (s *StickerService) GetAllStickersForPublic(ctx context.Context) ([]*StickerGroupResponse, error) {
	groups, err := s.queries.ListStickerGroups(ctx)
	if err != nil {
		return nil, fmt.Errorf("获取表情包组列表失败: %w", err)
	}

	responses := make([]*StickerGroupResponse, 0, len(groups))
	for _, g := range groups {
		resp := stickerGroupPtrToResponse(g)
		stickers, err := s.queries.ListStickersByGroup(ctx, g.ID)
		if err == nil {
			resp.Stickers = make([]*StickerResponse, 0, len(stickers))
			for _, st := range stickers {
				resp.Stickers = append(resp.Stickers, stickerPtrToResponse(st))
			}
		}
		responses = append(responses, resp)
	}

	return responses, nil
}

// UpdateStickerInput 更新表情包输入
type UpdateStickerInput struct {
	ID        uuid.UUID
	Name      *string
	Slug      *string
	ImageURL  *string
	Width     *int16
	Height    *int16
	SortOrder *int16
	IsActive  *bool
}

// UpdateSticker 更新表情包
func (s *StickerService) UpdateSticker(ctx context.Context, input UpdateStickerInput) (*StickerResponse, error) {
	// 先获取现有数据
	existing, err := s.queries.GetStickerByID(ctx, input.ID)
	if err != nil {
		return nil, fmt.Errorf("获取表情包失败: %w", err)
	}

	// 只更新非nil的字段
	name := existing.Name
	if input.Name != nil {
		name = *input.Name
	}
	slug := existing.Slug
	if input.Slug != nil {
		slug = *input.Slug
	}
	imageUrl := existing.ImageUrl
	if input.ImageURL != nil {
		imageUrl = *input.ImageURL
	}
	width := existing.Width
	if input.Width != nil {
		width = nullInt16(*input.Width)
	}
	height := existing.Height
	if input.Height != nil {
		height = nullInt16(*input.Height)
	}
	sortOrder := existing.SortOrder
	if input.SortOrder != nil {
		sortOrder = *input.SortOrder
	}
	isActive := existing.IsActive
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	params := generated.UpdateStickerParams{
		ID:        input.ID,
		Name:      name,
		Slug:      slug,
		ImageUrl:  imageUrl,
		Width:     width,
		Height:    height,
		SortOrder: sortOrder,
		IsActive:  isActive,
	}

	sticker, err := s.queries.UpdateSticker(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("更新表情包失败: %w", err)
	}

	return stickerPtrToResponse(sticker), nil
}

// DeleteSticker 删除表情包
func (s *StickerService) DeleteSticker(ctx context.Context, id uuid.UUID) error {
	err := s.queries.DeleteSticker(ctx, id)
	if err != nil {
		return fmt.Errorf("删除表情包失败: %w", err)
	}
	return nil
}

// IncrementStickerUsage 增加表情包使用次数
func (s *StickerService) IncrementStickerUsage(ctx context.Context, id uuid.UUID) error {
	err := s.queries.IncrementStickerUsage(ctx, id)
	if err != nil {
		return fmt.Errorf("更新使用次数失败: %w", err)
	}
	return nil
}

// UpdateStickersSortOrderInput 批量更新排序输入
type UpdateStickersSortOrderInput struct {
	Items []struct {
		ID        uuid.UUID
		SortOrder int16
	}
}

// UpdateStickersSortOrder 批量更新表情包排序
func (s *StickerService) UpdateStickersSortOrder(ctx context.Context, input UpdateStickersSortOrderInput) error {
	for _, item := range input.Items {
		err := s.queries.UpdateStickersSortOrder(ctx, generated.UpdateStickersSortOrderParams{
			ID:        item.ID,
			SortOrder: item.SortOrder,
		})
		if err != nil {
			return fmt.Errorf("更新排序失败: %w", err)
		}
	}
	return nil
}

// --- 用户收藏操作 ---

// AddFavoriteSticker 添加收藏
func (s *StickerService) AddFavoriteSticker(ctx context.Context, userID, stickerID uuid.UUID) error {
	err := s.queries.AddFavoriteSticker(ctx, generated.AddFavoriteStickerParams{
		UserID:    userID,
		StickerID: stickerID,
	})
	if err != nil {
		return fmt.Errorf("添加收藏失败: %w", err)
	}
	return nil
}

// RemoveFavoriteSticker 移除收藏
func (s *StickerService) RemoveFavoriteSticker(ctx context.Context, userID, stickerID uuid.UUID) error {
	err := s.queries.RemoveFavoriteSticker(ctx, generated.RemoveFavoriteStickerParams{
		UserID:    userID,
		StickerID: stickerID,
	})
	if err != nil {
		return fmt.Errorf("移除收藏失败: %w", err)
	}
	return nil
}

// ListUserFavoriteStickers 获取用户收藏列表
func (s *StickerService) ListUserFavoriteStickers(ctx context.Context, userID uuid.UUID) ([]*StickerResponse, error) {
	stickers, err := s.queries.ListUserFavoriteStickers(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("获取收藏列表失败: %w", err)
	}

	responses := make([]*StickerResponse, 0, len(stickers))
	for _, row := range stickers {
		resp := favoriteStickerRowToResponse(row)
		resp.IsFavorited = true
		responses = append(responses, resp)
	}
	return responses, nil
}

// --- 辅助函数 ---

func nullInt16(v int16) sql.NullInt16 {
	if v == 0 {
		return sql.NullInt16{Valid: false}
	}
	return sql.NullInt16{Int16: v, Valid: true}
}

func nullInt16Value(ns sql.NullInt16) int16 {
	if ns.Valid {
		return ns.Int16
	}
	return 0
}

func stickerGroupPtrToResponse(g *generated.StickerGroup) *StickerGroupResponse {
	resp := &StickerGroupResponse{
		ID:         g.ID,
		Name:       g.Name,
		Slug:       g.Slug,
		Type:       g.Type,
		SortOrder:  g.SortOrder,
		IsHot:      g.IsHot,
		IsOfficial: g.IsOfficial,
		IsActive:   g.IsActive,
		CreatedAt:  g.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:  g.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	if g.IconUrl.Valid {
		resp.IconURL = g.IconUrl.String
	}
	if g.Description.Valid {
		resp.Description = g.Description.String
	}

	return resp
}

func stickerPtrToResponse(st *generated.Sticker) *StickerResponse {
	return &StickerResponse{
		ID:         st.ID,
		GroupID:    st.GroupID,
		Name:       st.Name,
		Slug:       st.Slug,
		ImageURL:   st.ImageUrl,
		Width:      nullInt16Value(st.Width),
		Height:     nullInt16Value(st.Height),
		UsageCount: int64(st.UsageCount),
		SortOrder:  st.SortOrder,
		IsActive:   st.IsActive,
		CreatedAt:  st.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:  st.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

func favoriteStickerRowToResponse(row *generated.ListUserFavoriteStickersRow) *StickerResponse {
	return &StickerResponse{
		ID:         row.ID,
		GroupID:    row.GroupID,
		GroupSlug:  row.GroupSlug,
		Name:       row.Name,
		Slug:       row.Slug,
		ImageURL:   row.ImageUrl,
		Width:      nullInt16Value(row.Width),
		Height:     nullInt16Value(row.Height),
		UsageCount: int64(row.UsageCount),
		SortOrder:  row.SortOrder,
		IsActive:   row.IsActive,
		CreatedAt:  row.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:  row.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}