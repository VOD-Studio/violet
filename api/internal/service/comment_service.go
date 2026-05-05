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
	"blog-api/internal/repository/generated"
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
	repo            repository.CommentRepository
	queries         *generated.Queries
	reactionService *CommentReactionService
}

// NewCommentService 创建评论服务实例
func NewCommentService(repo repository.CommentRepository, queries *generated.Queries, reactionService *CommentReactionService) *CommentService {
	return &CommentService{
		repo:            repo,
		queries:         queries,
		reactionService: reactionService,
	}
}

// CreateCommentInput 创建评论的输入参数
type CreateCommentInput struct {
	// PostID 所属文章 ID
	PostID uuid.UUID
	// ParentID 父评论 ID，为空表示顶级评论
	ParentID *uuid.UUID
	// AuthorName 评论者昵称
	AuthorName string
	// AuthorEmail 评论者邮箱（可选）
	AuthorEmail string
	// AuthorURL 评论者网站（可选）
	AuthorURL string
	// Body 评论内容（纯文本 + 表情语法，如 "测试[smile]"）
	Body string
	// Pictures 评论图片列表
	Pictures []*model.CommentPicture
	// IP 评论者 IP 地址
	IP string
	// UserAgent 评论者浏览器 UA
	UserAgent string
}

// CommentPicture 评论图片信息
type CommentPicture struct {
	// URL 图片地址
	URL string `json:"url"`
	// Width 图片宽度（像素）
	Width int `json:"width"`
	// Height 图片高度（像素）
	Height int `json:"height"`
	// Size 图片大小（KB）
	Size float64 `json:"size"`
}

// CommentEmote 评论中使用的表情信息
type CommentEmote struct {
	// ID 表情 ID
	ID int32 `json:"id"`
	// Text 表情文本标记（如 "[smile]"）
	Text string `json:"text"`
	// URL 表情图片地址
	URL string `json:"url"`
	// TextContent 纯文本表情内容（颜文字），如 "(╯°□°）╯︵ ┻━┻"
	TextContent string `json:"text_content,omitempty"`
}

// CommentContent 评论内容结构（参考 Bilibili API 设计）
type CommentContent struct {
	// Message 评论文本内容（包含表情语法，如 "测试[smile]"）
	Message string `json:"message"`
	// Emote 评论中使用的表情映射表，key 为表情标记（如 "[smile]"），value 为表情信息
	Emote map[string]*CommentEmote `json:"emote"`
	// Pictures 评论图片列表
	Pictures []*model.CommentPicture `json:"pictures,omitempty"`
}

// CommentResponse 评论响应结构（参考 Bilibili API 设计）
type CommentResponse struct {
	// ID 评论唯一标识
	ID uuid.UUID `json:"id"`
	// PostID 所属文章 ID
	PostID uuid.UUID `json:"post_id"`
	// ParentID 父评论 ID，为空表示顶级评论
	ParentID *uuid.UUID `json:"parent_id"`
	// Path 评论路径，用于树形结构排序（如 "uuid1.uuid2.uuid3"）
	Path string `json:"path"`
	// Depth 评论嵌套深度（0 表示顶级评论，最大 4 层）
	Depth int16 `json:"depth"`
	// AuthorName 评论者昵称
	AuthorName string `json:"author_name"`
	// AuthorEmail 评论者邮箱（可选）
	AuthorEmail string `json:"author_email,omitempty"`
	// AuthorURL 评论者网站（可选）
	AuthorURL string `json:"author_url,omitempty"`
	// AvatarURL 评论者头像地址（可选）
	AvatarURL string `json:"avatar_url,omitempty"`
	// Content 评论内容（包含文本、表情映射、图片）
	Content *CommentContent `json:"content"`
	// Status 评论状态：pending 待审核，approved 已通过，spam 垃圾评论，deleted 已删除
	Status string `json:"status"`
	// CreatedAt 创建时间（ISO 8601 格式）
	CreatedAt string `json:"created_at"`
	// Reactions 表情反应列表
	Reactions []CommentReactionSummary `json:"reactions,omitempty"`
	// Children 子评论列表（树形结构）
	Children []*CommentResponse `json:"children,omitempty"`
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
	return s.commentToResponse(ctx, comment), nil
}

// ListCommentsByPostID 查询文章的评论列表
func (s *CommentService) ListCommentsByPostID(ctx context.Context, postID uuid.UUID, userID *uuid.UUID, ipHash string) ([]*CommentResponse, error) {
	comments, err := s.repo.ListByPostID(ctx, postID, "approved")
	if err != nil {
		return nil, fmt.Errorf("查询评论列表失败: %w", err)
	}

	// 收集所有评论 ID
	commentIDs := make([]uuid.UUID, 0, len(comments))
	for _, c := range comments {
		commentIDs = append(commentIDs, c.ID)
	}

	// 批量获取所有评论的反应数据
	var reactionsMap map[string][]CommentReactionSummary
	if len(commentIDs) > 0 && s.reactionService != nil {
		reactionsMap, err = s.reactionService.GetReactionsBatch(ctx, commentIDs, userID, ipHash)
		if err != nil {
			log.Error().Err(err).Msg("批量获取反应数据失败，继续返回评论")
			reactionsMap = make(map[string][]CommentReactionSummary)
		}
	} else {
		reactionsMap = make(map[string][]CommentReactionSummary)
	}

	responses := make([]*CommentResponse, 0, len(comments))
	for _, c := range comments {
		response := s.commentToResponse(ctx, c)
		// 添加反应数据
		if reactions, ok := reactionsMap[c.ID.String()]; ok {
			response.Reactions = reactions
		} else {
			response.Reactions = []CommentReactionSummary{}
		}
		responses = append(responses, response)
	}

	return responses, nil
}

// ListApprovedComments 查询文章已审核评论（树形结构）
func (s *CommentService) ListApprovedComments(ctx context.Context, postID uuid.UUID, userID *uuid.UUID, ipHash string) ([]*CommentResponse, error) {
	return s.ListCommentsByPostID(ctx, postID, userID, ipHash)
}

// ListPendingComments 查询待审核评论列表
func (s *CommentService) ListPendingComments(ctx context.Context, limit, offset int32) ([]*CommentResponse, error) {
	comments, err := s.repo.ListPending(ctx, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("查询待审核评论失败: %w", err)
	}

	responses := make([]*CommentResponse, 0, len(comments))
	for _, c := range comments {
		responses = append(responses, s.commentToResponse(ctx, c))
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

	return s.commentToResponse(ctx, comment), nil
}

// DeleteComment 删除评论
func (s *CommentService) DeleteComment(ctx context.Context, commentID uuid.UUID) error {
	return s.repo.Delete(ctx, commentID)
}

// commentToResponse 将数据库模型转换为 API 响应结构
func (s *CommentService) commentToResponse(ctx context.Context, c *model.Comment) *CommentResponse {
	// 解析图片
	var pictures []*model.CommentPicture
	if len(c.Pictures) > 0 {
		_ = json.Unmarshal(c.Pictures, &pictures)
	}

	// 解析表情
	emoteMap := s.parseEmotesFromContent(ctx, c.Body)

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

// parseEmotesFromContent 从评论内容中解析表情标记并查询表情信息
func (s *CommentService) parseEmotesFromContent(ctx context.Context, content string) map[string]*CommentEmote {
	emoteMap := make(map[string]*CommentEmote)

	// 匹配 [emoji_name] 格式
	re := regexp.MustCompile(`\[([^\]]+)\]`)
	matches := re.FindAllStringSubmatch(content, -1)

	if len(matches) == 0 {
		return emoteMap
	}

	// 提取所有表情名称（完整的 [name] 格式）
	emoteNames := make(map[string]bool)
	for _, match := range matches {
		if len(match) > 0 {
			emoteText := match[0] // 完整的表情标记，如 "[抠鼻]"
			emoteNames[emoteText] = true
		}
	}

	log.Debug().
		Str("content", content).
		Interface("emoteNames", emoteNames).
		Msg("解析评论中的表情标记")

	// 从数据库查询所有启用的表情
	emojis, err := s.queries.ListAllEmojisWithGroup(ctx)
	if err != nil {
		log.Error().Err(err).Msg("查询表情信息失败")
		return emoteMap
	}

	log.Debug().Int("emoji_count", len(emojis)).Msg("查询到的表情数量")

	// 构建名称到表情的映射
	for _, emoji := range emojis {
		// 数据库中的 name 字段已经包含方括号，如 "[抠鼻]"
		if emoteNames[emoji.Name] {
			log.Debug().
				Str("emoji_name", emoji.Name).
				Str("emoji_url", emoji.Url.String).
				Msg("匹配到表情")

			// 构建 CommentEmote 对象
			commentEmote := &CommentEmote{
				ID:   emoji.ID,
				Text: emoji.Name, // 使用数据库中的名称，已包含方括号
			}

			// 优先使用 URL（图片类表情）
			if emoji.Url.Valid && emoji.Url.String != "" {
				commentEmote.URL = emoji.Url.String
			} else if emoji.TextContent.Valid && emoji.TextContent.String != "" {
				// 如果是纯文本表情（颜文字），使用 text_content
				commentEmote.TextContent = emoji.TextContent.String
			}

			emoteMap[emoji.Name] = commentEmote
		}
	}

	log.Debug().Int("emote_map_size", len(emoteMap)).Msg("解析完成的表情映射表大小")

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
