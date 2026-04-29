package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"

	"blog-api/internal/service"
)

// CommentHandler 评论相关接口处理器
type CommentHandler struct {
	// commentService 评论服务
	commentService *service.CommentService
	// validate 请求验证器
	validate *validator.Validate
}

// NewCommentHandler 创建评论处理器实例
func NewCommentHandler(commentService *service.CommentService) *CommentHandler {
	return &CommentHandler{
		commentService: commentService,
		validate:       validator.New(),
	}
}

// --- 请求结构体 ---

// CreateCommentRequest 提交评论请求
type CreateCommentRequest struct {
	// ParentID 父评论 ID，为空表示顶级评论
	ParentID *string `json:"parent_id"`
	// AuthorName 评论者昵称
	AuthorName string `json:"author_name" validate:"required,min=1,max=100"`
	// AuthorEmail 评论者邮箱（可选）
	AuthorEmail string `json:"author_email" validate:"omitempty,email"`
	// AuthorURL 评论者网站（可选）
	AuthorURL string `json:"author_url" validate:"omitempty,url"`
	// Body 评论内容（Markdown 格式）
	Body string `json:"body" validate:"required,min=1,max=5000"`
}

// UpdateCommentStatusRequest 更新评论状态请求
type UpdateCommentStatusRequest struct {
	// Status 新的评论状态：approved/spam/deleted
	Status string `json:"status" validate:"required,oneof=approved spam deleted"`
}

// --- 响应结构体 ---

// CommentListResponse 评论列表响应
type CommentListResponse struct {
	// Comments 评论列表（树形结构）
	Comments []*service.CommentResponse `json:"comments"`
	// Total 评论总数
	Total int `json:"total"`
}

// PendingCommentsResponse 待审核评论列表响应
type PendingCommentsResponse struct {
	// Comments 待审核评论列表
	Comments []*service.CommentResponse `json:"comments"`
	// Total 待审核总数
	Total int64 `json:"total"`
	// Page 当前页码
	Page int `json:"page"`
	// PageSize 每页数量
	PageSize int `json:"page_size"`
}

// CountResponse 数量统计响应
type CountResponse struct {
	// Count 数量
	Count int64 `json:"count"`
}

// ListApprovedComments 获取文章已审核评论
// GET /api/posts/{id}/comments
// 公开接口，返回已审核评论的树形结构
func (h *CommentHandler) ListApprovedComments(w http.ResponseWriter, r *http.Request) {
	// 从 URL 路径解析文章 ID
	postIDStr := chi.URLParam(r, "id")
	postID, err := uuid.Parse(postIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "无效的文章 ID")
		return
	}

	// 查询已审核评论树
	comments, err := h.commentService.ListApprovedComments(r.Context(), postID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "获取评论失败")
		return
	}

	writeJSON(w, http.StatusOK, CommentListResponse{
		Comments: comments,
		Total:    len(comments),
	})
}

// CreateComment 提交评论
// POST /api/posts/{id}/comments
// 公开接口，需要通过限流中间件保护
func (h *CommentHandler) CreateComment(w http.ResponseWriter, r *http.Request) {
	// 从 URL 路径解析文章 ID
	postIDStr := chi.URLParam(r, "id")
	postID, err := uuid.Parse(postIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "无效的文章 ID")
		return
	}

	// 解析请求体
	var req CreateCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	// 验证请求参数
	if err := h.validate.Struct(req); err != nil {
		writeError(w, http.StatusBadRequest, "validation_error", formatValidationErrors(err))
		return
	}

	// 解析父评论 ID（可选）
	var parentID *uuid.UUID
	if req.ParentID != nil && *req.ParentID != "" {
		pid, err := uuid.Parse(*req.ParentID)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid_parent_id", "无效的父评论 ID")
			return
		}
		parentID = &pid
	}

	// 获取客户端 IP 地址
	ip := r.RemoteAddr
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		// 取第一个 IP（原始客户端）
		ip = forwarded
	} else if realIP := r.Header.Get("X-Real-IP"); realIP != "" {
		ip = realIP
	}

	// 获取 User-Agent
	userAgent := r.Header.Get("User-Agent")

	// 调用服务层创建评论
	comment, err := h.commentService.CreateComment(r.Context(), service.CreateCommentInput{
		PostID:       postID,
		ParentID:     parentID,
		AuthorName:   req.AuthorName,
		AuthorEmail:  req.AuthorEmail,
		AuthorURL:    req.AuthorURL,
		BodyMarkdown: req.Body,
		IP:           ip,
		UserAgent:    userAgent,
	})
	if err != nil {
		handleCommentError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, comment)
}

// ListPendingComments 获取待审核评论列表
// GET /api/admin/comments/pending
// 需要管理员认证
func (h *CommentHandler) ListPendingComments(w http.ResponseWriter, r *http.Request) {
	// 解析分页参数
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	offset := int32((page - 1) * pageSize)

	// 查询待审核评论
	comments, err := h.commentService.ListPendingComments(r.Context(), int32(pageSize), offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "获取待审核评论失败")
		return
	}

	// 查询总数
	total, err := h.commentService.CountPendingComments(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "获取评论统计失败")
		return
	}

	writeJSON(w, http.StatusOK, PendingCommentsResponse{
		Comments: comments,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

// CountPendingComments 统计待审核评论数量
// GET /api/admin/comments/pending/count
// 需要管理员认证，用于后台仪表盘展示待审核数量
func (h *CommentHandler) CountPendingComments(w http.ResponseWriter, r *http.Request) {
	count, err := h.commentService.CountPendingComments(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "获取评论统计失败")
		return
	}

	writeJSON(w, http.StatusOK, CountResponse{Count: count})
}

// UpdateCommentStatus 审核评论
// PATCH /api/comments/{id}/status
// 需要管理员认证
func (h *CommentHandler) UpdateCommentStatus(w http.ResponseWriter, r *http.Request) {
	// 从 URL 路径解析评论 ID
	commentIDStr := chi.URLParam(r, "id")
	commentID, err := uuid.Parse(commentIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "无效的评论 ID")
		return
	}

	// 解析请求体
	var req UpdateCommentStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	// 验证请求参数
	if err := h.validate.Struct(req); err != nil {
		writeError(w, http.StatusBadRequest, "validation_error", formatValidationErrors(err))
		return
	}

	// 调用服务层更新状态
	comment, err := h.commentService.UpdateCommentStatus(r.Context(), commentID, req.Status)
	if err != nil {
		handleCommentError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, comment)
}

// DeleteComment 删除评论
// DELETE /api/comments/{id}
// 需要管理员认证
func (h *CommentHandler) DeleteComment(w http.ResponseWriter, r *http.Request) {
	// 从 URL 路径解析评论 ID
	commentIDStr := chi.URLParam(r, "id")
	commentID, err := uuid.Parse(commentIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "无效的评论 ID")
		return
	}

	// 调用服务层删除评论
	if err := h.commentService.DeleteComment(r.Context(), commentID); err != nil {
		handleCommentError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, MessageResponse{
		Message: "评论已删除",
	})
}

// handleCommentError 根据评论服务错误类型返回对应的 HTTP 响应
func handleCommentError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, service.ErrCommentNotFound):
		writeError(w, http.StatusNotFound, "comment_not_found", err.Error())
	case errors.Is(err, service.ErrPostNotFound):
		writeError(w, http.StatusNotFound, "post_not_found", err.Error())
	case errors.Is(err, service.ErrInvalidParentComment):
		writeError(w, http.StatusBadRequest, "invalid_parent", err.Error())
	case errors.Is(err, service.ErrCommentTooDeep):
		writeError(w, http.StatusBadRequest, "too_deep", err.Error())
	case errors.Is(err, service.ErrInvalidCommentStatus):
		writeError(w, http.StatusBadRequest, "invalid_status", err.Error())
	default:
		writeError(w, http.StatusInternalServerError, "internal_error", "服务器内部错误")
	}
}
