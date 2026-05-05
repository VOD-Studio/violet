// Package handler 提供 HTTP 请求处理器，负责接收请求、验证参数、调用服务层并返回响应
package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"blog-api/internal/pkg/response"
	"blog-api/internal/service"
)

// CommentReactionHandler 评论反应接口处理器
type CommentReactionHandler struct {
	reactionService *service.CommentReactionService
}

// NewCommentReactionHandler 创建评论反应处理器实例
func NewCommentReactionHandler(reactionService *service.CommentReactionService) *CommentReactionHandler {
	return &CommentReactionHandler{
		reactionService: reactionService,
	}
}

// --- 请求结构体 ---

// AddReactionRequest 添加表情反应请求
type AddReactionRequest struct {
	// EmojiID 表情 ID
	EmojiID int32 `json:"emoji_id"`
}

// GetReactionsBatchRequest 批量获取反应请求
type GetReactionsBatchRequest struct {
	// CommentIDs 评论 ID 列表
	CommentIDs []string `json:"comment_ids"`
}

// --- 响应结构体 ---

// ReactionsResponse 反应列表响应
type ReactionsResponse struct {
	// Reactions 反应列表
	Reactions []service.CommentReactionSummary `json:"reactions"`
}

// ReactionsBatchResponse 批量反应响应
type ReactionsBatchResponse struct {
	// Reactions 评论 ID 到反应列表的映射
	Reactions map[string][]service.CommentReactionSummary `json:"reactions"`
}


// GetCommentReactions 获取评论的表情反应
// GET /api/v1/comments/{comment_id}/reactions
// 公开接口，返回评论的所有表情反应统计
func (h *CommentReactionHandler) GetCommentReactions(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "GetCommentReactions").Msg("处理请求")

	// 从 URL 路径解析评论 ID
	commentIDStr := chi.URLParam(r, "comment_id")
	commentID, err := uuid.Parse(commentIDStr)
	if err != nil {
		log.Warn().Err(err).Str("comment_id", commentIDStr).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_id", "无效的评论 ID")
		return
	}

	// 提取用户身份（从 JWT 或 IP）
	userID, ipHash := extractUserIdentity(r)

	// 查询反应统计
	reactions, err := h.reactionService.GetCommentReactions(r.Context(), commentID, userID, ipHash)
	if err != nil {
		log.Error().Err(err).Str("operation", "GetCommentReactions").Str("comment_id", commentID.String()).Msg("服务调用失败")
		response.InternalServerError(w, "获取表情反应失败")
		return
	}

	log.Info().Int("status", http.StatusOK).Int("count", len(reactions)).Msg("请求处理成功")
	response.Success(w, ReactionsResponse{
		Reactions: reactions,
	})
}

// AddReaction 添加表情反应
// POST /api/v1/comments/{comment_id}/reactions
// 公开接口，需要限流保护
func (h *CommentReactionHandler) AddReaction(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "AddReaction").Msg("处理请求")

	// 从 URL 路径解析评论 ID
	commentIDStr := chi.URLParam(r, "comment_id")
	commentID, err := uuid.Parse(commentIDStr)
	if err != nil {
		log.Warn().Err(err).Str("comment_id", commentIDStr).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_id", "无效的评论 ID")
		return
	}

	// 解析请求体
	var req AddReactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		response.BadRequest(w, "请求参数格式错误")
		return
	}

	// 验证表情 ID
	if req.EmojiID <= 0 {
		log.Warn().Int32("emoji_id", req.EmojiID).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_emoji_id", "表情 ID 无效")
		return
	}

	// 提取用户身份（从 JWT 或 IP）
	userID, ipHash := extractUserIdentity(r)

	// 添加反应
	_, err = h.reactionService.AddReaction(r.Context(), commentID, req.EmojiID, userID, ipHash)
	if err != nil {
		log.Error().Err(err).Str("operation", "AddReaction").Str("comment_id", commentID.String()).Msg("服务调用失败")
		handleReactionError(w, err)
		return
	}

	// 获取更新后的反应列表
	reactions, err := h.reactionService.GetCommentReactions(r.Context(), commentID, userID, ipHash)
	if err != nil {
		log.Error().Err(err).Str("operation", "GetCommentReactions").Str("comment_id", commentID.String()).Msg("获取反应列表失败")
		response.InternalServerError(w, "获取表情反应列表失败")
		return
	}

	log.Info().Int("status", http.StatusCreated).Str("comment_id", commentID.String()).Msg("请求处理成功")
	response.Created(w, ReactionsResponse{
		Reactions: reactions,
	})
}

// RemoveReaction 删除表情反应
// DELETE /api/v1/comments/{comment_id}/reactions/{emoji_id}
// 公开接口
func (h *CommentReactionHandler) RemoveReaction(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "RemoveReaction").Msg("处理请求")

	// 从 URL 路径解析评论 ID
	commentIDStr := chi.URLParam(r, "comment_id")
	commentID, err := uuid.Parse(commentIDStr)
	if err != nil {
		log.Warn().Err(err).Str("comment_id", commentIDStr).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_id", "无效的评论 ID")
		return
	}

	// 从 URL 路径解析表情 ID
	emojiIDStr := chi.URLParam(r, "emoji_id")
	emojiID, err := strconv.ParseInt(emojiIDStr, 10, 32)
	if err != nil || emojiID <= 0 {
		log.Warn().Err(err).Str("emoji_id", emojiIDStr).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_emoji_id", "无效的表情 ID")
		return
	}

	// 提取用户身份（从 JWT 或 IP）
	userID, ipHash := extractUserIdentity(r)

	// 删除反应
	err = h.reactionService.RemoveReaction(r.Context(), commentID, int32(emojiID), userID, ipHash)
	if err != nil {
		log.Error().Err(err).Str("operation", "RemoveReaction").Str("comment_id", commentID.String()).Msg("服务调用失败")
		handleReactionError(w, err)
		return
	}

	// 获取更新后的反应列表
	reactions, err := h.reactionService.GetCommentReactions(r.Context(), commentID, userID, ipHash)
	if err != nil {
		log.Error().Err(err).Str("operation", "GetCommentReactions").Str("comment_id", commentID.String()).Msg("获取更新后的反应列表失败")
		response.InternalServerError(w, "获取更新后的反应列表失败")
		return
	}

	log.Info().Int("status", http.StatusOK).Str("comment_id", commentID.String()).Int("reaction_count", len(reactions)).Msg("请求处理成功")
	response.Success(w, ReactionsResponse{
		Reactions: reactions,
	})
}

// GetReactionsBatch 批量获取评论反应
// POST /api/v1/comments/reactions/batch
// 公开接口，用于评论列表页面一次性获取所有评论的反应
func (h *CommentReactionHandler) GetReactionsBatch(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "GetReactionsBatch").Msg("处理请求")

	// 解析请求体
	var req GetReactionsBatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		response.BadRequest(w, "请求参数格式错误")
		return
	}

	// 验证评论 ID 列表
	if len(req.CommentIDs) == 0 {
		log.Warn().Msg("参数验证失败：评论 ID 列表为空")
		response.Error(w, http.StatusBadRequest, "validation_error", "评论 ID 列表不能为空")
		return
	}

	if len(req.CommentIDs) > 100 {
		log.Warn().Int("count", len(req.CommentIDs)).Msg("参数验证失败：评论 ID 列表过长")
		response.Error(w, http.StatusBadRequest, "validation_error", "一次最多查询 100 个评论")
		return
	}

	// 解析 UUID
	commentIDs := make([]uuid.UUID, 0, len(req.CommentIDs))
	for _, idStr := range req.CommentIDs {
		id, err := uuid.Parse(idStr)
		if err != nil {
			log.Warn().Err(err).Str("comment_id", idStr).Msg("参数验证失败")
			response.Error(w, http.StatusBadRequest, "invalid_id", "无效的评论 ID: "+idStr)
			return
		}
		commentIDs = append(commentIDs, id)
	}

	// 提取用户身份（从 JWT 或 IP）
	userID, ipHash := extractUserIdentity(r)

	// 批量查询反应
	reactions, err := h.reactionService.GetReactionsBatch(r.Context(), commentIDs, userID, ipHash)
	if err != nil {
		log.Error().Err(err).Str("operation", "GetReactionsBatch").Msg("服务调用失败")
		response.InternalServerError(w, "批量获取表情反应失败")
		return
	}

	log.Info().Int("status", http.StatusOK).Int("comment_count", len(commentIDs)).Msg("请求处理成功")
	response.Success(w, ReactionsBatchResponse{
		Reactions: reactions,
	})
}

// handleReactionError 根据反应服务错误类型返回对应的 HTTP 响应
func handleReactionError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, service.ErrReactionAlreadyExists):
		response.Conflict(w, err.Error())
	case errors.Is(err, service.ErrReactionNotFound):
		response.NotFound(w, err.Error())
	case errors.Is(err, service.ErrCommentNotFound):
		response.NotFound(w, "评论不存在")
	case errors.Is(err, service.ErrEmojiNotFound):
		response.NotFound(w, "表情不存在")
	default:
		response.InternalServerError(w, "服务器内部错误")
	}
}
