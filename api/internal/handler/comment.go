// Package handler 提供 HTTP 请求处理器，负责接收请求、验证参数、调用服务层并返回响应
package handler

import (
	"github.com/rs/zerolog/log"

	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"

	"blog-api/internal/model"
	"blog-api/internal/pkg/request"
	"blog-api/internal/pkg/response"
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
	// Pictures 评论图片列表
	Pictures []CommentPictureRequest `json:"pictures" validate:"omitempty,max=9,dive"`
}

// CommentPictureRequest 评论图片请求
type CommentPictureRequest struct {
	// URL 图片地址（支持相对路径和完整 URL）
	URL string `json:"url" validate:"required"`
	// Width 图片宽度（像素）
	Width int `json:"width" validate:"required,min=1"`
	// Height 图片高度（像素）
	Height int `json:"height" validate:"required,min=1"`
	// Size 图片大小（KB）
	Size float64 `json:"size" validate:"required,min=0"`
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
// GET /api/v1/posts/{id}/comments
// 公开接口，返回已审核评论的树形结构
func (h *CommentHandler) ListApprovedComments(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "ListApprovedComments").Msg("处理请求")

	// 从 URL 路径解析文章 ID
	postIDStr := chi.URLParam(r, "id")
	postID, err := uuid.Parse(postIDStr)
	if err != nil {
		log.Warn().Err(err).Str("post_id", postIDStr).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_id", "无效的文章 ID")
		return
	}

	// 提取用户身份（从 JWT 或 IP）
	userID, ipHash := extractUserIdentity(r)

	// 查询已审核评论树（包含反应数据）
	comments, err := h.commentService.ListApprovedComments(r.Context(), postID, userID, ipHash)
	if err != nil {
		log.Error().Err(err).Str("operation", "ListApprovedComments").Str("post_id", postID.String()).Msg("服务调用失败")
		response.InternalServerError(w, "获取评论失败")
		return
	}

	log.Info().Int("status", http.StatusOK).Int("count", len(comments)).Msg("请求处理成功")
	response.Success(w, CommentListResponse{
		Comments: comments,
		Total:    len(comments),
	})
}

// CreateComment 提交评论
// POST /api/v1/posts/{id}/comments
// 公开接口，需要通过限流中间件保护
func (h *CommentHandler) CreateComment(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "CreateComment").Msg("处理请求")

	// 从 URL 路径解析文章 ID
	postIDStr := chi.URLParam(r, "id")
	postID, err := uuid.Parse(postIDStr)
	if err != nil {
		log.Warn().Err(err).Str("post_id", postIDStr).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_id", "无效的文章 ID")
		return
	}

	// 解析请求体
	var req CreateCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		response.BadRequest(w, err.Error())
		return
	}

	// 验证请求参数
	if err := h.validate.Struct(req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		if validationErr, ok := err.(validator.ValidationErrors); ok {
			details := request.FormatValidationError(validationErr)
			response.ValidationError(w, "请求验证失败", details)
		} else {
			response.BadRequest(w, err.Error())
		}
		return
	}

	// 解析父评论 ID（可选）
	var parentID *uuid.UUID
	if req.ParentID != nil && *req.ParentID != "" {
		pid, err := uuid.Parse(*req.ParentID)
		if err != nil {
			log.Warn().Err(err).Str("parent_id", *req.ParentID).Msg("参数验证失败")
			response.Error(w, http.StatusBadRequest, "invalid_parent_id", "无效的父评论 ID")
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

	// 转换图片数据
	var pictures []*model.CommentPicture
	for _, pic := range req.Pictures {
		pictures = append(pictures, &model.CommentPicture{
			URL:    pic.URL,
			Width:  pic.Width,
			Height: pic.Height,
			Size:   pic.Size,
		})
	}

	// 调用服务层创建评论
	comment, err := h.commentService.CreateComment(r.Context(), service.CreateCommentInput{
		PostID:      postID,
		ParentID:    parentID,
		AuthorName:  req.AuthorName,
		AuthorEmail: req.AuthorEmail,
		AuthorURL:   req.AuthorURL,
		Body:        req.Body,
		Pictures:    pictures,
		IP:          ip,
		UserAgent:   userAgent,
	})
	if err != nil {
		log.Error().Err(err).Str("operation", "CreateComment").Str("post_id", postID.String()).Msg("服务调用失败")
		handleCommentError(w, err)
		return
	}

	log.Info().Int("status", http.StatusCreated).Str("comment_id", comment.ID.String()).Msg("请求处理成功")
	response.Created(w, comment)
}

// ListPendingComments 获取待审核评论列表
// GET /api/v1/admin/comments/pending
// 需要管理员认证
func (h *CommentHandler) ListPendingComments(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "ListPendingComments").Msg("处理请求")

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
		log.Error().Err(err).Str("operation", "ListPendingComments").Msg("服务调用失败")
		response.InternalServerError(w, "获取待审核评论失败")
		return
	}

	// 查询总数
	total, err := h.commentService.CountPendingComments(r.Context())
	if err != nil {
		log.Error().Err(err).Str("operation", "CountPendingComments").Msg("服务调用失败")
		response.InternalServerError(w, "获取评论统计失败")
		return
	}

	log.Info().Int("status", http.StatusOK).Int("page", page).Int("count", len(comments)).Msg("请求处理成功")
	response.Success(w, PendingCommentsResponse{
		Comments: comments,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

// CountPendingComments 统计待审核评论数量
// GET /api/v1/admin/comments/pending/count
// 需要管理员认证，用于后台仪表盘展示待审核数量
func (h *CommentHandler) CountPendingComments(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "CountPendingComments").Msg("处理请求")

	count, err := h.commentService.CountPendingComments(r.Context())
	if err != nil {
		log.Error().Err(err).Str("operation", "CountPendingComments").Msg("服务调用失败")
		response.InternalServerError(w, "获取评论统计失败")
		return
	}

	log.Info().Int("status", http.StatusOK).Int64("count", count).Msg("请求处理成功")
	response.Success(w, CountResponse{Count: count})
}

// UpdateCommentStatus 审核评论
// PATCH /api/v1/comments/{id}/status
// 需要管理员认证
func (h *CommentHandler) UpdateCommentStatus(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "UpdateCommentStatus").Msg("处理请求")

	// 从 URL 路径解析评论 ID
	commentIDStr := chi.URLParam(r, "id")
	commentID, err := uuid.Parse(commentIDStr)
	if err != nil {
		log.Warn().Err(err).Str("comment_id", commentIDStr).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_id", "无效的评论 ID")
		return
	}

	// 解析请求体
	var req UpdateCommentStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		response.BadRequest(w, err.Error())
		return
	}

	// 验证请求参数
	if err := h.validate.Struct(req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		if validationErr, ok := err.(validator.ValidationErrors); ok {
			details := request.FormatValidationError(validationErr)
			response.ValidationError(w, "请求验证失败", details)
		} else {
			response.BadRequest(w, err.Error())
		}
		return
	}

	// 调用服务层更新状态
	comment, err := h.commentService.UpdateCommentStatus(r.Context(), commentID, req.Status)
	if err != nil {
		log.Error().Err(err).Str("operation", "UpdateCommentStatus").Str("comment_id", commentID.String()).Msg("服务调用失败")
		handleCommentError(w, err)
		return
	}

	log.Info().Int("status", http.StatusOK).Str("comment_id", commentID.String()).Str("new_status", req.Status).Msg("请求处理成功")
	response.Success(w, comment)
}

// DeleteComment 删除评论
// DELETE /api/v1/comments/{id}
// 需要管理员认证
func (h *CommentHandler) DeleteComment(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "DeleteComment").Msg("处理请求")

	// 从 URL 路径解析评论 ID
	commentIDStr := chi.URLParam(r, "id")
	commentID, err := uuid.Parse(commentIDStr)
	if err != nil {
		log.Warn().Err(err).Str("comment_id", commentIDStr).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_id", "无效的评论 ID")
		return
	}

	// 调用服务层删除评论
	if err := h.commentService.DeleteComment(r.Context(), commentID); err != nil {
		log.Error().Err(err).Str("operation", "DeleteComment").Str("comment_id", commentID.String()).Msg("服务调用失败")
		handleCommentError(w, err)
		return
	}

	log.Info().Int("status", http.StatusOK).Str("comment_id", commentID.String()).Msg("请求处理成功")
	response.Success(w, MessageResponse{
		Message: "评论已删除",
	})
}

// handleCommentError 根据评论服务错误类型返回对应的 HTTP 响应
func handleCommentError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, service.ErrCommentNotFound):
		response.Error(w, http.StatusNotFound, "comment_not_found", err.Error())
	case errors.Is(err, service.ErrPostNotFound):
		response.Error(w, http.StatusNotFound, "post_not_found", err.Error())
	case errors.Is(err, service.ErrInvalidParentComment):
		response.Error(w, http.StatusBadRequest, "invalid_parent", err.Error())
	case errors.Is(err, service.ErrCommentTooDeep):
		response.Error(w, http.StatusBadRequest, "too_deep", err.Error())
	case errors.Is(err, service.ErrInvalidCommentStatus):
		response.Error(w, http.StatusBadRequest, "invalid_status", err.Error())
	default:
		response.InternalServerError(w, "服务器内部错误")
	}
}
