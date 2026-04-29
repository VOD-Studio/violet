package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"strings"

	"github.com/google/uuid"
	"github.com/yuin/goldmark"

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
	// queries sqlc 生成的数据库查询接口
	queries *generated.Queries
	// markdown goldmark Markdown 渲染器
	markdown goldmark.Markdown
}

// NewCommentService 创建评论服务实例
func NewCommentService(queries *generated.Queries) *CommentService {
	return &CommentService{
		queries:  queries,
		markdown: goldmark.New(),
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
	// BodyMarkdown Markdown 格式的评论内容
	BodyMarkdown string
	// IP 评论者 IP 地址，用于哈希存储
	IP string
	// UserAgent 评论者浏览器 UA
	UserAgent string
}

// CommentResponse 评论响应结构，用于 API 返回
type CommentResponse struct {
	// ID 评论唯一标识
	ID uuid.UUID `json:"id"`
	// PostID 所属文章 ID
	PostID uuid.UUID `json:"post_id"`
	// ParentID 父评论 ID
	ParentID *uuid.UUID `json:"parent_id"`
	// Path 评论路径，用于排序和嵌套
	Path string `json:"path"`
	// Depth 评论嵌套层级
	Depth int16 `json:"depth"`
	// AuthorName 评论者昵称
	AuthorName string `json:"author_name"`
	// AuthorEmail 评论者邮箱
	AuthorEmail string `json:"author_email,omitempty"`
	// AuthorURL 评论者网站
	AuthorURL string `json:"author_url,omitempty"`
	// AvatarURL 头像链接
	AvatarURL string `json:"avatar_url,omitempty"`
	// BodyHTML 渲染后的 HTML 内容
	BodyHTML string `json:"body_html"`
	// Status 评论状态
	Status string `json:"status"`
	// CreatedAt 创建时间
	CreatedAt string `json:"created_at"`
	// Children 子评论列表（用于树形展示）
	Children []*CommentResponse `json:"children,omitempty"`
}

// CreateComment 创建评论
// 自动生成基于 UUID 的 materialized path，计算嵌套深度，渲染 Markdown 为 HTML，对 IP 地址进行哈希处理
func (s *CommentService) CreateComment(ctx context.Context, input CreateCommentInput) (*CommentResponse, error) {
	// 验证文章是否存在
	_, err := s.queries.GetPostByID(ctx, input.PostID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrPostNotFound
		}
		return nil, fmt.Errorf("查询文章失败: %w", err)
	}

	// 生成评论 ID
	commentID := uuid.New()

	// 计算 path 和 depth
	var parentID uuid.NullUUID
	var path string
	var depth int16

	if input.ParentID != nil {
		// 回复评论：查询父评论
		parent, err := s.queries.GetCommentByID(ctx, *input.ParentID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, ErrInvalidParentComment
			}
			return nil, fmt.Errorf("查询父评论失败: %w", err)
		}

		// 验证父评论属于同一文章
		if parent.PostID != input.PostID {
			return nil, ErrInvalidParentComment
		}

		// 检查嵌套深度限制（最大 4 层）
		newDepth := parent.Depth + 1
		if newDepth > 4 {
			return nil, ErrCommentTooDeep
		}

		parentID = uuid.NullUUID{UUID: *input.ParentID, Valid: true}
		path = parent.Path + "/" + commentID.String()
		depth = newDepth
	} else {
		// 顶级评论
		parentID = uuid.NullUUID{Valid: false}
		path = commentID.String()
		depth = 0
	}

	// 渲染 Markdown 为 HTML
	bodyHTML, err := s.renderMarkdown(input.BodyMarkdown)
	if err != nil {
		return nil, fmt.Errorf("渲染 Markdown 失败: %w", err)
	}

	// 对 IP 地址进行 SHA256 哈希
	ipHash := hashIP(input.IP)

	// 构建创建参数
	params := generated.CreateCommentParams{
		PostID:      input.PostID,
		ParentID:    parentID,
		Path:        path,
		Depth:       depth,
		AuthorName:  input.AuthorName,
		AuthorEmail: toNullString(input.AuthorEmail),
		AuthorUrl:   toNullString(input.AuthorURL),
		AvatarUrl:   sql.NullString{Valid: false},
		BodyMd:      input.BodyMarkdown,
		BodyHtml:    bodyHTML,
		Status:      "pending",
		IpHash:      toNullString(ipHash),
		UserAgent:   toNullString(input.UserAgent),
	}

	// 写入数据库
	comment, err := s.queries.CreateComment(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("创建评论失败: %w", err)
	}

	return commentToResponse(comment), nil
}

// ListApprovedComments 获取文章已审核评论树
// 查询所有已审核评论，按 path 排序后构建树形结构
func (s *CommentService) ListApprovedComments(ctx context.Context, postID uuid.UUID) ([]*CommentResponse, error) {
	comments, err := s.queries.ListApprovedCommentsByPostID(ctx, postID)
	if err != nil {
		return nil, fmt.Errorf("查询评论列表失败: %w", err)
	}

	// 构建树形结构
	return buildCommentTree(comments), nil
}

// ListPendingComments 获取待审核评论列表
func (s *CommentService) ListPendingComments(ctx context.Context, limit, offset int32) ([]*CommentResponse, error) {
	comments, err := s.queries.ListPendingComments(ctx, generated.ListPendingCommentsParams{
		Limit:  limit,
		Offset: offset,
	})
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
	count, err := s.queries.CountPendingComments(ctx)
	if err != nil {
		return 0, fmt.Errorf("统计待审核评论数量失败: %w", err)
	}
	return count, nil
}

// UpdateCommentStatus 审核评论（approved/spam/deleted）
func (s *CommentService) UpdateCommentStatus(ctx context.Context, commentID uuid.UUID, status string) (*CommentResponse, error) {
	// 验证状态值
	switch status {
	case "approved", "spam", "deleted":
	default:
		return nil, ErrInvalidCommentStatus
	}

	// 检查评论是否存在
	_, err := s.queries.GetCommentByID(ctx, commentID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrCommentNotFound
		}
		return nil, fmt.Errorf("查询评论失败: %w", err)
	}

	// 更新状态
	comment, err := s.queries.UpdateCommentStatus(ctx, generated.UpdateCommentStatusParams{
		ID:     commentID,
		Status: status,
	})
	if err != nil {
		return nil, fmt.Errorf("更新评论状态失败: %w", err)
	}

	return commentToResponse(comment), nil
}

// DeleteComment 删除评论
func (s *CommentService) DeleteComment(ctx context.Context, commentID uuid.UUID) error {
	// 检查评论是否存在
	_, err := s.queries.GetCommentByID(ctx, commentID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrCommentNotFound
		}
		return fmt.Errorf("查询评论失败: %w", err)
	}

	// 执行删除
	if err := s.queries.DeleteComment(ctx, commentID); err != nil {
		return fmt.Errorf("删除评论失败: %w", err)
	}

	return nil
}

// --- 内部辅助函数 ---

// renderMarkdown 使用 goldmark 将 Markdown 渲染为 HTML
func (s *CommentService) renderMarkdown(md string) (string, error) {
	var buf bytes.Buffer
	if err := s.markdown.Convert([]byte(md), &buf); err != nil {
		return "", err
	}
	return buf.String(), nil
}

// hashIP 对 IP 地址进行 SHA256 哈希，保护用户隐私
func hashIP(ip string) string {
	if ip == "" {
		return ""
	}
	// 去除端口号（如有）
	host, _, err := net.SplitHostPort(ip)
	if err != nil {
		host = ip
	}
	h := sha256.Sum256([]byte(host))
	return hex.EncodeToString(h[:])
}

// toNullString 将普通字符串转换为 sql.NullString
// 空字符串视为 NULL
func toNullString(s string) sql.NullString {
	s = strings.TrimSpace(s)
	if s == "" {
		return sql.NullString{Valid: false}
	}
	return sql.NullString{String: s, Valid: true}
}

// commentToResponse 将数据库模型转换为 API 响应结构
func commentToResponse(c *generated.Comment) *CommentResponse {
	r := &CommentResponse{
		ID:         c.ID,
		PostID:     c.PostID,
		Path:       c.Path,
		Depth:      c.Depth,
		AuthorName: c.AuthorName,
		BodyHTML:   c.BodyHtml,
		Status:     c.Status,
		CreatedAt:  c.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	if c.ParentID.Valid {
		r.ParentID = &c.ParentID.UUID
	}
	if c.AuthorEmail.Valid {
		r.AuthorEmail = c.AuthorEmail.String
	}
	if c.AuthorUrl.Valid {
		r.AuthorURL = c.AuthorUrl.String
	}
	if c.AvatarUrl.Valid {
		r.AvatarURL = c.AvatarUrl.String
	}

	return r
}

// buildCommentTree 从按 path 排序的扁平评论列表构建树形结构
// 利用 materialized path 的前缀特性，通过 map 快速定位父节点
func buildCommentTree(comments []*generated.Comment) []*CommentResponse {
	if len(comments) == 0 {
		return []*CommentResponse{}
	}

	// 将所有评论转为响应结构并建立 ID 到节点的映射
	nodeMap := make(map[string]*CommentResponse, len(comments))
	var roots []*CommentResponse

	for _, c := range comments {
		node := commentToResponse(c)
		node.Children = nil
		nodeMap[c.ID.String()] = node
	}

	// 遍历所有节点，挂载到父节点下
	for _, c := range comments {
		node := nodeMap[c.ID.String()]
		if c.ParentID.Valid {
			parentNode, ok := nodeMap[c.ParentID.UUID.String()]
			if ok {
				parentNode.Children = append(parentNode.Children, node)
				continue
			}
		}
		// 没有有效父节点或父节点不在结果集中，作为顶级评论
		roots = append(roots, node)
	}

	return roots
}
