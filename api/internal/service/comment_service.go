// Package service 提供业务逻辑层，封装数据访问和业务规则
package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"regexp"
	"strings"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"blog-api/internal/model"
	"blog-api/internal/repository"
)

// 评论业务错误定义
var (
	// ErrCommentNotFound 评论不存在
	ErrCommentNotFound = errors.New("评论不存在")
	// ErrInvalidParentComment 父评论不存在或不属于同一文章
	ErrInvalidParentComment = errors.New("父评论无效")
	// ErrCommentTooDeep 评论嵌套层级超过最大限制（4 层）
	ErrCommentTooDeep = errors.New("评论嵌套层级过深")
	// ErrInvalidCommentStatus 无效的评论状态值
	ErrInvalidCommentStatus = errors.New("无效的评论状态")
)

// CommentService 评论服务，处理评论的创建、查询、审核等业务逻辑
type CommentService struct {
	repo repository.CommentRepository
}

// NewCommentService 创建评论服务实例
func NewCommentService(repo repository.CommentRepository) *CommentService {
	return &CommentService{
		repo: repo,
	}
}

// CreateCommentInput 创建评论的输入参数
type CreateCommentInput struct {
	PostID      uuid.UUID
	ParentID    *uuid.UUID
	AuthorName  string
	AuthorEmail string
	AuthorURL   string
	Body        string
	Pictures    []*model.CommentPicture
	IP          string
	UserAgent   string
}

// CommentPicture 评论图片信息
type CommentPicture struct {
	URL    string  `json:"url"`
	Width  int     `json:"width"`
	Height int     `json:"height"`
	Size   float64 `json:"size"`
}

// CommentEmote 评论中使用的表情信息
type CommentEmote struct {
	ID   int32  `json:"id"`
	Text string `json:"text"`
	URL  string `json:"url"`
}

// CommentContent 评论内容结构
type CommentContent struct {
	Message  string                   `json:"message"`
	Emote    map[string]*CommentEmote `json:"emote"`
	Pictures []*model.CommentPicture  `json:"pictures,omitempty"`
}

// CommentResponse 评论响应结构
type CommentResponse struct {
	ID          uuid.UUID       `json:"id"`
	PostID      uuid.UUID       `json:"post_id"`
	ParentID    *uuid.UUID      `json:"parent_id"`
	Path        string          `json:"path"`
	Depth       int16           `json:"depth"`
	AuthorName  string          `json:"author_name"`
	AuthorEmail string          `json:"author_email,omitempty"`
	AuthorURL   string          `json:"author_url,omitempty"`
	AvatarURL   string          `json:"avatar_url,omitempty"`
	Content     *CommentContent `json:"content"`
	Status      string          `json:"status"`
	CreatedAt   string          `json:"created_at"`
	Children    []*CommentResponse `json:"children,omitempty"`
}

// CreateComment 创建评论
func (s *CommentService) CreateComment(ctx context.Context, input CreateCommentInput) (*CommentResponse, error) {
	log.Info().Str("service", "CommentService").Str("operation", "CreateComment").
		Str("post_id", input.PostID.String()).Str("author_name", input.AuthorName).Msg("开始创建评论")

	// 生成评论 ID
	commentID := uuid.New()

	// 计算路径和深度
	var path string
	var depth int16

	if input.ParentID != nil {
		// 回复评论
		parent, err := s.repo.GetByID(ctx, *input.ParentID)
		if err != nil {
			log.Error().Err(err).Str("parent_id", input.ParentID.String()).Msg("查询父评论失败")
			return nil, ErrInvalidParentComment
		}

		if parent.PostID != input.PostID {
			log.Warn().Str("parent_post_id", parent.PostID.String()).
				Str("input_post_id", input.PostID.String()).Msg("父评论不属于同一文章")
			return nil, ErrInvalidParentComment
		}

		depth = parent.Depth + 1
		if depth > 4 {
			log.Warn().Int16("depth", depth).Msg("评论嵌套层级过深")
			return nil, ErrCommentTooDeep
		}

		path = parent.Path + "." + commentID.String()
	} else {
		// 顶级评论
		path = commentID.String()
		depth = 0
	}

	// 序列化图片数据
	var picturesJSON []byte
	if len(input.Pictures) > 0 {
		var err error
		picturesJSON, err = json.Marshal(input.Pictures)
		if err != nil {
			log.Error().Err(err).Msg("序列化图片数据失败")
			return nil, fmt.Errorf("序列化图片数据失败: %w", err)
		}
	} else {
		picturesJSON = []byte("[]")
	}

	// 对 IP 地址进行 SHA256 哈希
	ipHash := hashIP(input.IP)

	// 构建评论模型
	comment := &model.Comment{
		ID:          commentID,
		PostID:      input.PostID,
		ParentID:    input.ParentID,
		Path:        path,
		Depth:       depth,
		AuthorName:  input.AuthorName,
		AuthorEmail: toNullableString(input.AuthorEmail),
		AuthorURL:   toNullableString(input.AuthorURL),
		Body:        input.Body,
		Pictures:    picturesJSON,
		Status:      "pending",
		IPHash:      toNullableString(ipHash),
		UserAgent:   toNullableString(input.UserAgent),
	}

	// 创建评论
	if err := s.repo.Create(ctx, comment); err != nil {
		log.Error().Err(err).Msg("创建评论失败")
		return nil, fmt.Errorf("创建评论失败: %w", err)
	}

	log.Info().Str("comment_id", comment.ID.String()).Msg("评论创建成功")
	return commentToResponse(comment), nil
}

// ListCommentsByPostID 查询文章的评论列表
func (s *CommentService) ListCommentsByPostID(ctx context.Context, postID uuid.UUID) ([]*CommentResponse, error) {
	comments, err := s.repo.ListByPostID(ctx, postID, "approved")
	if err != nil {
		return nil, fmt.Errorf("查询评论列表失败: %w", err)
	}

	responses := make([]*CommentResponse, 0, len(comments))
	for _, c := range comments {
		responses = append(responses, commentToResponse(c))
	}

	return responses, nil
}

// ListApprovedComments 查询文章已审核评论（树形结构）
func (s *CommentService) ListApprovedComments(ctx context.Context, postID uuid.UUID) ([]*CommentResponse, error) {
	return s.ListCommentsByPostID(ctx, postID)
}

// ListPendingComments 查询待审核评论列表
func (s *CommentService) ListPendingComments(ctx context.Context, limit, offset int32) ([]*CommentResponse, error) {
	comments, err := s.repo.ListPending(ctx, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("查询待审核评论失败: %w", err)
	}

	responses := make([]*CommentResponse, 0, len(comments))
	for _, c := range comments {
		responses = append(responses, commentToResponse(c))
	}

	return responses, nil
}

// CountPendingComments 统计待审核评论数量
func (s *CommentService) CountPendingComments(ctx context.Context) (int64, error) {
	return s.repo.CountPending(ctx)
}

// UpdateCommentStatus 更新评论状态
func (s *CommentService) UpdateCommentStatus(ctx context.Context, commentID uuid.UUID, status string) (*CommentResponse, error) {
	// 验证状态值
	if status != "approved" && status != "spam" && status != "deleted" {
		return nil, ErrInvalidCommentStatus
	}

	// 查询评论
	comment, err := s.repo.GetByID(ctx, commentID)
	if err != nil {
		return nil, ErrCommentNotFound
	}

	// 更新状态
	comment.Status = status
	if err := s.repo.UpdateStatus(ctx, commentID, status); err != nil {
		return nil, fmt.Errorf("更新评论状态失败: %w", err)
	}

	return commentToResponse(comment), nil
}

// DeleteComment 删除评论
func (s *CommentService) DeleteComment(ctx context.Context, commentID uuid.UUID) error {
	return s.repo.Delete(ctx, commentID)
}

// commentToResponse 将数据库模型转换为 API 响应结构
func commentToResponse(c *model.Comment) *CommentResponse {
	// 解析图片
	var pictures []*model.CommentPicture
	if len(c.Pictures) > 0 {
		_ = json.Unmarshal(c.Pictures, &pictures)
	}

	// 解析表情
	emoteMap := parseEmotesFromContent(c.Body)

	r := &CommentResponse{
		ID:         c.ID,
		PostID:     c.PostID,
		ParentID:   c.ParentID,
		Path:       c.Path,
		Depth:      c.Depth,
		AuthorName: c.AuthorName,
		Content: &CommentContent{
			Message:  c.Body,
			Emote:    emoteMap,
			Pictures: pictures,
		},
		Status:    c.Status,
		CreatedAt: c.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	if c.AuthorEmail != nil {
		r.AuthorEmail = *c.AuthorEmail
	}
	if c.AuthorURL != nil {
		r.AuthorURL = *c.AuthorURL
	}
	if c.AvatarURL != nil {
		r.AvatarURL = *c.AvatarURL
	}

	return r
}

// parseEmotesFromContent 从评论内容中解析表情语法
func parseEmotesFromContent(content string) map[string]*CommentEmote {
	emoteMap := make(map[string]*CommentEmote)

	// 匹配 [emoji_name] 格式
	re := regexp.MustCompile(`\[([^\]]+)\]`)
	matches := re.FindAllStringSubmatch(content, -1)

	for _, match := range matches {
		if len(match) > 1 {
			emoteText := match[0] // [smile]
			// TODO: 从数据库查询表情信息
			// 暂时返回空映射
			_ = emoteText
		}
	}

	return emoteMap
}

// hashIP 对 IP 地址进行 SHA256 哈希
func hashIP(ip string) string {
	if ip == "" {
		return ""
	}

	parsedIP := net.ParseIP(ip)
	if parsedIP == nil {
		return ""
	}

	hash := sha256.Sum256([]byte(parsedIP.String()))
	return hex.EncodeToString(hash[:])
}

// toNullableString 将字符串转换为可空指针
func toNullableString(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}
