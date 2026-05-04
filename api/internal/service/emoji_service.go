// Package service 提供业务逻辑层，封装数据访问和业务规则
package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"

	"blog-api/internal/repository/generated"
)

// 表情业务错误定义
var (
	ErrEmojiGroupNotFound = errors.New("表情分组不存在")
	ErrEmojiNotFound      = errors.New("表情不存在")
	ErrEmojiTooLarge      = errors.New("表情文件过大")
	ErrInvalidEmojiType   = errors.New("不支持的表情文件类型")
)

// 支持的表情图片 MIME 类型
var allowedEmojiTypes = map[string]bool{
	"image/jpeg":    true,
	"image/png":     true,
	"image/gif":     true,
	"image/webp":    true,
	"image/svg+xml": true,
}

// 支持的表情图片扩展名
var allowedEmojiExts = map[string]bool{
	".jpg":  true,
	".jpeg": true,
	".png":  true,
	".gif":  true,
	".webp": true,
	".svg":  true,
}

// EmojiService 表情服务
type EmojiService struct {
	queries       *generated.Queries
	rendererCache *SimpleEmojiCache
	emojiDir      string // 表情独立存储目录
}

// NewEmojiService 创建表情服务实例
func NewEmojiService(queries *generated.Queries, emojiDir string) *EmojiService {
	return &EmojiService{
		queries:  queries,
		emojiDir: emojiDir,
	}
}

// --- 表情分组响应类型 ---

// EmojiGroupResponse 表情分组响应
type EmojiGroupResponse struct {
	ID        int32            `json:"id"`
	Name      string           `json:"name"`
	Source    string           `json:"source"`
	SortOrder int32            `json:"sort_order"`
	IsEnabled bool             `json:"is_enabled"`
	CreatedAt string           `json:"created_at"`
	Emojis    []*EmojiResponse `json:"emojis,omitempty"`
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

// --- 表情分组 CRUD ---

// GetEmojiGroupByID 获取单个表情分组
func (s *EmojiService) GetEmojiGroupByID(ctx context.Context, id int32) (*EmojiGroupResponse, error) {
	group, err := s.queries.GetEmojiGroupByID(ctx, id)
	if err != nil {
		return nil, ErrEmojiGroupNotFound
	}
	return emojiGroupToResponse(group), nil
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

// DeleteEmojiGroup 删除表情分组
func (s *EmojiService) DeleteEmojiGroup(ctx context.Context, id int32) error {
	// 先删除分组内的所有表情
	if err := s.queries.DeleteEmojisByGroup(ctx, id); err != nil {
		return fmt.Errorf("删除分组内表情失败: %w", err)
	}

	// 删除分组
	if err := s.queries.DeleteEmojiGroup(ctx, id); err != nil {
		return fmt.Errorf("删除表情分组失败: %w", err)
	}

	return nil
}

// BatchUpdateGroupsStatus 批量更新表情分组状态
func (s *EmojiService) BatchUpdateGroupsStatus(ctx context.Context, ids []int32, isEnabled bool) error {
	err := s.queries.BatchUpdateGroupsStatus(ctx, generated.BatchUpdateGroupsStatusParams{
		Ids:       ids,
		IsEnabled: isEnabled,
	})
	if err != nil {
		return fmt.Errorf("批量更新表情分组状态失败: %w", err)
	}
	return nil
}

// --- 表情 CRUD ---

// GetEmojiByID 获取单个表情
func (s *EmojiService) GetEmojiByID(ctx context.Context, id int32) (*EmojiResponse, error) {
	emoji, err := s.queries.GetEmojiByID(ctx, id)
	if err != nil {
		return nil, ErrEmojiNotFound
	}
	return emojiToResponse(emoji), nil
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
		Url:         toSQLNullString(input.URL),
		TextContent: toSQLNullString(input.TextContent),
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
	SourceURL   string
	TextContent string
	SortOrder   int32
}

// UpdateEmoji 更新表情
func (s *EmojiService) UpdateEmoji(ctx context.Context, input UpdateEmojiInput) (*EmojiResponse, error) {
	params := generated.UpdateEmojiParams{
		ID:          input.ID,
		Name:        input.Name,
		Url:         toSQLNullString(input.URL),
		SourceUrl:   toSQLNullString(input.SourceURL),
		TextContent: toSQLNullString(input.TextContent),
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
	if err := s.queries.DeleteEmoji(ctx, id); err != nil {
		return fmt.Errorf("删除表情失败: %w", err)
	}
	return nil
}

// --- 表情文件上传 ---

// EmojiUploadResponse 表情上传响应
type EmojiUploadResponse struct {
	URL      string `json:"url"`
	Filename string `json:"filename"`
	Size     int64  `json:"size"`
	MimeType string `json:"mime_type"`
}

// UploadEmoji 上传表情图片到独立存储目录
func (s *EmojiService) UploadEmoji(ctx context.Context, filename, mimeType string, size int64, reader io.Reader) (*EmojiUploadResponse, error) {
	// 验证文件类型
	ext := strings.ToLower(filepath.Ext(filename))
	if !allowedEmojiExts[ext] {
		return nil, ErrInvalidEmojiType
	}

	// 从 MIME 类型验证
	if mimeType != "" && !allowedEmojiTypes[mimeType] {
		return nil, ErrInvalidEmojiType
	}

	// 最大文件大小：10MB
	maxSize := int64(10 * 1024 * 1024)
	if size > maxSize {
		return nil, ErrEmojiTooLarge
	}

	// 确保表情目录存在
	if err := os.MkdirAll(s.emojiDir, 0755); err != nil {
		return nil, fmt.Errorf("创建表情目录失败: %w", err)
	}

	// 生成唯一文件名
	newFilename := fmt.Sprintf("%s%s", uuid.New().String(), ext)

	// 创建目标文件
	dstPath := filepath.Join(s.emojiDir, newFilename)
	dst, err := os.Create(dstPath)
	if err != nil {
		return nil, fmt.Errorf("保存表情文件失败: %w", err)
	}
	defer dst.Close()

	// 复制文件内容
	written, err := io.Copy(dst, reader)
	if err != nil {
		os.Remove(dstPath)
		return nil, fmt.Errorf("写入表情文件失败: %w", err)
	}

	// 推断 MIME 类型（如果未提供）
	if mimeType == "" {
		switch ext {
		case ".jpg", ".jpeg":
			mimeType = "image/jpeg"
		case ".png":
			mimeType = "image/png"
		case ".gif":
			mimeType = "image/gif"
		case ".webp":
			mimeType = "image/webp"
		case ".svg":
			mimeType = "image/svg+xml"
		default:
			mimeType = "application/octet-stream"
		}
	}

	// 返回相对路径 URL
	relativeURL := "/uploads/emojis/" + newFilename

	return &EmojiUploadResponse{
		URL:      relativeURL,
		Filename: newFilename,
		Size:     written,
		MimeType: mimeType,
	}, nil
}

// --- 类型转换辅助函数 ---

func emojiGroupToResponse(g *generated.EmojiGroup) *EmojiGroupResponse {
	return &EmojiGroupResponse{
		ID:        g.ID,
		Name:      g.Name,
		Source:    g.Source,
		SortOrder: g.SortOrder,
		IsEnabled: g.IsEnabled,
		CreatedAt: g.CreatedAt.Format("2006-01-02 15:04:05"),
	}
}

func emojiToResponse(e *generated.Emoji) *EmojiResponse {
	resp := &EmojiResponse{
		ID:        e.ID,
		GroupID:   e.GroupID,
		Name:      e.Name,
		SortOrder: e.SortOrder,
		CreatedAt: e.CreatedAt.Format("2006-01-02 15:04:05"),
	}

	if e.Url.Valid {
		resp.URL = e.Url.String
	}
	if e.TextContent.Valid {
		resp.TextContent = e.TextContent.String
	}

	return resp
}
