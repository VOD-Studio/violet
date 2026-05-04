// Package service 提供业务逻辑层，封装数据访问和业务规则
package service

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"net"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/rs/zerolog/log"

	"blog-api/internal/repository/generated"
)

// 评论反应业务错误定义
var (
	// ErrReactionAlreadyExists 用户已对该评论添加过此表情
	ErrReactionAlreadyExists = errors.New("您已经添加过这个表情了")
	// ErrReactionNotFound 表情反应不存在
	ErrReactionNotFound = errors.New("表情反应不存在")
)

// CommentReactionService 评论反应服务，处理评论表情反应的业务逻辑
type CommentReactionService struct {
	// queries sqlc 生成的数据库查询接口
	queries *generated.Queries
}

// NewCommentReactionService 创建评论反应服务实例
func NewCommentReactionService(queries *generated.Queries) *CommentReactionService {
	return &CommentReactionService{
		queries: queries,
	}
}

// CommentReactionSummary 评论的表情反应汇总
type CommentReactionSummary struct {
	// EmojiID 表情 ID
	EmojiID int32 `json:"emoji_id"`
	// EmojiName 表情名称
	EmojiName string `json:"emoji_name"`
	// EmojiURL 表情图片 URL（可选）
	EmojiURL string `json:"emoji_url,omitempty"`
	// TextContent 文本内容（可选，如 emoji 字符）
	TextContent string `json:"text_content,omitempty"`
	// Count 反应数量
	Count int64 `json:"count"`
	// UserReacted 当前用户是否已反应
	UserReacted bool `json:"user_reacted"`
}

// GetCommentReactions 获取评论的表情反应统计
func (s *CommentReactionService) GetCommentReactions(
	ctx context.Context,
	commentID uuid.UUID,
	userID *uuid.UUID,
	ipHash string,
) ([]CommentReactionSummary, error) {
	log.Info().Str("service", "CommentReactionService").Str("operation", "GetCommentReactions").
		Str("comment_id", commentID.String()).Msg("开始获取评论反应")

	// 1. 获取反应统计
	log.Debug().Str("query", "GetReactionsByComment").Str("comment_id", commentID.String()).Msg("查询反应统计")
	reactions, err := s.queries.GetReactionsByComment(ctx, commentID)
	if err != nil {
		log.Error().Err(err).Str("comment_id", commentID.String()).Msg("查询反应统计失败")
		return nil, fmt.Errorf("查询反应统计失败: %w", err)
	}

	if len(reactions) == 0 {
		log.Info().Str("comment_id", commentID.String()).Msg("该评论暂无反应")
		return []CommentReactionSummary{}, nil
	}

	// 2. 检查用户已反应的表情
	userReactions := make(map[int32]bool)
	for _, r := range reactions {
		var userIDParam uuid.NullUUID
		var ipHashParam sql.NullString

		if userID != nil {
			userIDParam = uuid.NullUUID{UUID: *userID, Valid: true}
		} else {
			ipHashParam = sql.NullString{String: ipHash, Valid: true}
		}

		exists, err := s.queries.CheckUserReaction(ctx, generated.CheckUserReactionParams{
			CommentID: commentID,
			EmojiID:   r.EmojiID,
			UserID:    userIDParam,
			IpHash:    ipHashParam,
		})
		if err != nil {
			log.Error().Err(err).Int32("emoji_id", r.EmojiID).Msg("检查用户反应失败")
			continue
		}
		userReactions[r.EmojiID] = exists
	}

	// 3. 组装响应
	result := make([]CommentReactionSummary, 0, len(reactions))
	for _, r := range reactions {
		summary := CommentReactionSummary{
			EmojiID:     r.EmojiID,
			EmojiName:   r.EmojiName,
			Count:       r.Count,
			UserReacted: userReactions[r.EmojiID],
		}
		if r.EmojiUrl.Valid {
			summary.EmojiURL = r.EmojiUrl.String
		}
		if r.TextContent.Valid {
			summary.TextContent = r.TextContent.String
		}
		result = append(result, summary)
	}

	log.Info().Str("comment_id", commentID.String()).Int("count", len(result)).Msg("反应统计查询成功")
	return result, nil
}

// AddReaction 添加表情反应
func (s *CommentReactionService) AddReaction(
	ctx context.Context,
	commentID uuid.UUID,
	emojiID int32,
	userID *uuid.UUID,
	ipHash string,
) (*generated.CommentReaction, error) {
	log.Info().Str("service", "CommentReactionService").Str("operation", "AddReaction").
		Str("comment_id", commentID.String()).Int32("emoji_id", emojiID).Msg("开始添加表情反应")

	// 1. 验证评论存在
	log.Debug().Str("query", "GetCommentByID").Str("comment_id", commentID.String()).Msg("验证评论是否存在")
	_, err := s.queries.GetCommentByID(ctx, commentID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			log.Warn().Str("comment_id", commentID.String()).Msg("评论不存在")
			return nil, ErrCommentNotFound
		}
		log.Error().Err(err).Str("comment_id", commentID.String()).Msg("查询评论失败")
		return nil, fmt.Errorf("查询评论失败: %w", err)
	}

	// 2. 验证表情存在
	log.Debug().Str("query", "GetEmojiByID").Int32("emoji_id", emojiID).Msg("验证表情是否存在")
	_, err = s.queries.GetEmojiByID(ctx, emojiID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			log.Warn().Int32("emoji_id", emojiID).Msg("表情不存在")
			return nil, ErrEmojiNotFound
		}
		log.Error().Err(err).Int32("emoji_id", emojiID).Msg("查询表情失败")
		return nil, fmt.Errorf("查询表情失败: %w", err)
	}

	// 3. 检查是否已反应
	var userIDParam uuid.NullUUID
	var ipHashParam sql.NullString

	if userID != nil {
		userIDParam = uuid.NullUUID{UUID: *userID, Valid: true}
	} else {
		ipHashParam = sql.NullString{String: ipHash, Valid: true}
	}

	log.Debug().Str("query", "CheckUserReaction").Msg("检查用户是否已反应")
	exists, err := s.queries.CheckUserReaction(ctx, generated.CheckUserReactionParams{
		CommentID: commentID,
		EmojiID:   emojiID,
		UserID:    userIDParam,
		IpHash:    ipHashParam,
	})
	if err != nil {
		log.Error().Err(err).Msg("检查用户反应失败")
		return nil, fmt.Errorf("检查用户反应失败: %w", err)
	}
	if exists {
		log.Warn().Str("comment_id", commentID.String()).Int32("emoji_id", emojiID).Msg("用户已添加过此表情")
		return nil, ErrReactionAlreadyExists
	}

	// 4. 插入反应记录
	log.Debug().Str("query", "CreateReaction").Msg("创建反应记录")
	reaction, err := s.queries.CreateReaction(ctx, generated.CreateReactionParams{
		CommentID: commentID,
		EmojiID:   emojiID,
		UserID:    userIDParam,
		IpHash:    ipHashParam,
	})
	if err != nil {
		// 处理唯一性约束冲突（并发情况）
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			log.Warn().Err(err).Msg("唯一性约束冲突，用户已添加过此表情")
			return nil, ErrReactionAlreadyExists
		}
		log.Error().Err(err).Str("comment_id", commentID.String()).Msg("创建反应记录失败")
		return nil, fmt.Errorf("创建反应记录失败: %w", err)
	}

	log.Info().Str("reaction_id", reaction.ID.String()).Str("comment_id", commentID.String()).
		Int32("emoji_id", emojiID).Msg("表情反应添加成功")
	return reaction, nil
}

// RemoveReaction 删除表情反应
func (s *CommentReactionService) RemoveReaction(
	ctx context.Context,
	commentID uuid.UUID,
	emojiID int32,
	userID *uuid.UUID,
	ipHash string,
) error {
	log.Info().Str("service", "CommentReactionService").Str("operation", "RemoveReaction").
		Str("comment_id", commentID.String()).Int32("emoji_id", emojiID).Msg("开始删除表情反应")

	var userIDParam uuid.NullUUID
	var ipHashParam sql.NullString

	if userID != nil {
		userIDParam = uuid.NullUUID{UUID: *userID, Valid: true}
	} else {
		ipHashParam = sql.NullString{String: ipHash, Valid: true}
	}

	// 检查反应是否存在
	log.Debug().Str("query", "CheckUserReaction").Msg("检查反应是否存在")
	exists, err := s.queries.CheckUserReaction(ctx, generated.CheckUserReactionParams{
		CommentID: commentID,
		EmojiID:   emojiID,
		UserID:    userIDParam,
		IpHash:    ipHashParam,
	})
	if err != nil {
		log.Error().Err(err).Msg("检查反应失败")
		return fmt.Errorf("检查反应失败: %w", err)
	}
	if !exists {
		log.Warn().Str("comment_id", commentID.String()).Int32("emoji_id", emojiID).Msg("反应不存在")
		return ErrReactionNotFound
	}

	// 删除反应记录
	log.Debug().Str("query", "DeleteReaction").Msg("删除反应记录")
	err = s.queries.DeleteReaction(ctx, generated.DeleteReactionParams{
		CommentID: commentID,
		EmojiID:   emojiID,
		UserID:    userIDParam,
		IpHash:    ipHashParam,
	})
	if err != nil {
		log.Error().Err(err).Str("comment_id", commentID.String()).Msg("删除反应记录失败")
		return fmt.Errorf("删除反应记录失败: %w", err)
	}

	log.Info().Str("comment_id", commentID.String()).Int32("emoji_id", emojiID).Msg("表情反应删除成功")
	return nil
}

// GetReactionsBatch 批量获取多个评论的反应统计
func (s *CommentReactionService) GetReactionsBatch(
	ctx context.Context,
	commentIDs []uuid.UUID,
	userID *uuid.UUID,
	ipHash string,
) (map[string][]CommentReactionSummary, error) {
	log.Info().Str("service", "CommentReactionService").Str("operation", "GetReactionsBatch").
		Int("comment_count", len(commentIDs)).Msg("开始批量获取评论反应")

	if len(commentIDs) == 0 {
		return map[string][]CommentReactionSummary{}, nil
	}

	// 1. 批量获取反应统计
	log.Debug().Str("query", "GetReactionsByComments").Msg("批量查询反应统计")
	reactions, err := s.queries.GetReactionsByComments(ctx, commentIDs)
	if err != nil {
		log.Error().Err(err).Msg("批量查询反应统计失败")
		return nil, fmt.Errorf("批量查询反应统计失败: %w", err)
	}

	// 2. 批量检查用户反应
	var userIDParam uuid.NullUUID
	var ipHashParam sql.NullString

	if userID != nil {
		userIDParam = uuid.NullUUID{UUID: *userID, Valid: true}
	} else {
		ipHashParam = sql.NullString{String: ipHash, Valid: true}
	}

	log.Debug().Str("query", "GetUserReactionsByComments").Msg("批量查询用户反应")
	userReactions, err := s.queries.GetUserReactionsByComments(ctx, generated.GetUserReactionsByCommentsParams{
		Column1: commentIDs,
		UserID:  userIDParam,
		IpHash:  ipHashParam,
	})
	if err != nil {
		log.Error().Err(err).Msg("批量查询用户反应失败")
		return nil, fmt.Errorf("批量查询用户反应失败: %w", err)
	}

	// 构建用户反应映射
	userReactionMap := make(map[string]map[int32]bool)
	for _, ur := range userReactions {
		commentIDStr := ur.CommentID.String()
		if userReactionMap[commentIDStr] == nil {
			userReactionMap[commentIDStr] = make(map[int32]bool)
		}
		userReactionMap[commentIDStr][ur.EmojiID] = true
	}

	// 3. 组装响应
	result := make(map[string][]CommentReactionSummary)

	// 初始化所有评论的空数组
	for _, cid := range commentIDs {
		result[cid.String()] = []CommentReactionSummary{}
	}

	// 填充反应数据
	for _, r := range reactions {
		commentIDStr := r.CommentID.String()
		summary := CommentReactionSummary{
			EmojiID:     r.EmojiID,
			EmojiName:   r.EmojiName,
			Count:       r.Count,
			UserReacted: false,
		}
		if r.EmojiUrl.Valid {
			summary.EmojiURL = r.EmojiUrl.String
		}
		if r.TextContent.Valid {
			summary.TextContent = r.TextContent.String
		}

		// 检查用户是否已反应
		if userReactionMap[commentIDStr] != nil {
			summary.UserReacted = userReactionMap[commentIDStr][r.EmojiID]
		}

		result[commentIDStr] = append(result[commentIDStr], summary)
	}

	log.Info().Int("comment_count", len(commentIDs)).Int("reaction_count", len(reactions)).Msg("批量反应统计查询成功")
	return result, nil
}

// HashIPAddress 对 IP 地址进行 SHA256 哈希
func HashIPAddress(ip string) string {
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
