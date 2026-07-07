package gorm

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"gorm.io/gorm"

	"blog-api/internal/domain/comment"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// CommentRepository 评论仓储 GORM 实现
type CommentRepository struct {
	db *gorm.DB
}

func NewCommentRepository(db *gorm.DB) *CommentRepository {
	return &CommentRepository{db: db}
}

func commentToPO(c *comment.Comment) (model.Comment, error) {
	var picturesJSON []byte
	if len(c.Pictures()) > 0 {
		picturesJSON, _ = json.Marshal(c.Pictures())
	} else {
		picturesJSON = []byte("[]")
	}
	var parentID *interface{}
	_ = parentID

	po := model.Comment{
		ID: c.ID().UUID(), Path: c.Path(), Depth: c.Depth(),
		AuthorName: c.AuthorName(), AuthorEmail: c.AuthorEmail(),
		AuthorURL: c.AuthorURL(), AvatarURL: c.AvatarURL(),
		Body: c.Body(), Pictures: picturesJSON,
		Status: c.Status(), IPHash: c.IPHash(), UserAgent: c.UserAgent(),
	}
	po.PostID = c.PostID().UUID()
	if p := c.ParentID(); p != nil {
		pid := p.UUID()
		po.ParentID = &pid
	}
	// created_by 仅登录评论者有值；匿名为 nil（DB 列允许 NULL）。
	if u := c.UserID(); u != nil {
		uid := u.UUID()
		po.CreatedBy = &uid
	}
	// anchor 5 列：批注才有值（自由评论 a 为 nil，PO 5 列全空，由 GORM 零值/nullable 处理）。
	if a := c.Anchor(); a != nil {
		blockID := a.BlockID
		start := a.StartOffset
		end := a.EndOffset
		selected := a.SelectedText
		hash := a.BlockHashSync
		po.AnchorBlockID = &blockID
		po.AnchorStartOffset = &start
		po.AnchorEndOffset = &end
		po.AnchorSelectedText = &selected
		po.AnchorBlockTextHash = &hash
	}
	if t := c.CreatedAt(); !t.IsZero() {
		po.CreatedAt = t
		po.UpdatedAt = c.UpdatedAt()
	} else {
		po.CreatedAt = time.Now()
		po.UpdatedAt = time.Now()
	}
	return po, nil
}

func commentToDomain(po model.Comment) (*comment.Comment, error) {
	var pictures []comment.Picture
	if len(po.Pictures) > 0 {
		_ = json.Unmarshal(po.Pictures, &pictures)
	}
	var parentID *domainshared.ID
	if po.ParentID != nil {
		pid := domainshared.MustParseID(po.ParentID.String())
		parentID = &pid
	}
	var userID *domainshared.ID
	if po.CreatedBy != nil {
		uid := domainshared.MustParseID(po.CreatedBy.String())
		userID = &uid
	}
	// anchor 5 列：block_id 非空表示批注，重建 *Anchor；自由评论 anchor_block_id 为 nil → Anchor=nil。
	var anchor *comment.Anchor
	if po.AnchorBlockID != nil {
		anchor = &comment.Anchor{
			BlockID:       *po.AnchorBlockID,
			StartOffset:   derefInt(po.AnchorStartOffset),
			EndOffset:     derefInt(po.AnchorEndOffset),
			SelectedText:  derefStr(po.AnchorSelectedText),
			BlockHashSync: derefStr(po.AnchorBlockTextHash),
		}
	}
	return comment.ReconstructComment(
		domainshared.MustParseID(po.ID.String()),
		domainshared.MustParseID(po.PostID.String()),
		userID,
		parentID, po.Path, po.Depth,
		anchor,
		po.AuthorName, po.AuthorEmail, po.AuthorURL, po.AvatarURL,
		po.Body, pictures, po.Status, po.IPHash, po.UserAgent,
		po.CreatedAt, po.UpdatedAt,
	), nil
}

// derefStr 安全解引用 *string，nil 返回空串。
func derefStr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

// derefInt 安全解引用 *int，nil 返回 0。
func derefInt(p *int) int {
	if p == nil {
		return 0
	}
	return *p
}

func (r *CommentRepository) FindByID(ctx context.Context, id domainshared.ID) (*comment.Comment, error) {
	var po model.Comment
	if err := r.db.WithContext(ctx).First(&po, "id = ?", id.UUID()).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, comment.ErrNotFound
		}
		return nil, domainshared.Internal("查询评论失败", err)
	}
	return commentToDomain(po)
}

func (r *CommentRepository) FindByPost(ctx context.Context, postID domainshared.ID, status string, viewerUserID *domainshared.ID, anchorFilter comment.AnchorFilter, depthFilter comment.DepthFilter, blockID string, page, limit int) ([]*comment.Comment, int64, error) {
	query := r.db.WithContext(ctx).Model(&model.Comment{}).Where("post_id = ?", postID.UUID())
	// viewer 过滤：approved 评论联合（若 viewer 登录）viewer 自己的 pending。
	// viewerUserID 为 nil 时（匿名）仅 status 过滤——但 service.ListByPost 会在
	// 匿名时直接返回空数组，不走到这里；保留 status 分支供后台管理等场景复用。
	if viewerUserID != nil {
		query = query.Where(
			"status = ? OR (status = ? AND created_by = ?)",
			status, comment.StatusPending, viewerUserID.UUID(),
		)
	} else if status != "" {
		query = query.Where("status = ?", status)
	}
	// anchor 维度过滤：自由评论（anchor_block_id IS NULL）/ 批注（IS NOT NULL）/ 全部（不过滤）。
	switch anchorFilter {
	case comment.AnchorFilterFree:
		query = query.Where("anchor_block_id IS NULL")
	case comment.AnchorFilterAnnotation:
		query = query.Where("anchor_block_id IS NOT NULL")
	} // AnchorFilterAll / 空串：不过滤
	// depth 维度过滤：顶层列表只查 depth=0，避免子和父混在一页被分页切走。
	if depthFilter != comment.DepthFilterAll {
		query = query.Where("depth = ?", depthFilter)
	}
	// block_id 精确过滤（批注按块懒加载）
	if blockID != "" {
		query = query.Where("anchor_block_id = ?", blockID)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, domainshared.Internal("统计评论失败", err)
	}
	var pos []model.Comment
	offset := (page - 1) * limit
	if err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&pos).Error; err != nil {
		return nil, 0, domainshared.Internal("查询评论列表失败", err)
	}
	result := make([]*comment.Comment, 0, len(pos))
	for _, po := range pos {
		c, _ := commentToDomain(po)
		result = append(result, c)
	}
	return result, total, nil
}

// CountByPostAndAnon 统计某文章下某匿名身份（ip_hash + email）已留存的评论数，
// 仅计 status IN ('pending','approved')。用于「一篇一次」配额校验（PRD-0001）。
func (r *CommentRepository) CountByPostAndAnon(ctx context.Context, postID domainshared.ID, ipHash, email string) (int64, error) {
	var n int64
	err := r.db.WithContext(ctx).Model(&model.Comment{}).
		Where("post_id = ? AND ip_hash = ? AND author_email = ? AND status IN ?", postID.UUID(), ipHash, email, []string{comment.StatusPending, comment.StatusApproved}).
		Count(&n).Error
	if err != nil {
		return 0, domainshared.Internal("统计匿名配额失败", err)
	}
	return n, nil
}

// FindReplies 列出某顶层评论下的全部扁平回复。
//
// 实现策略：先查 parent 拿 path（顶层评论 path 形如 "<uuid>/"），
// 再按 path 前缀查所有回复（path LIKE "<uuid>/%"），排除 parent 自身（id != parentID）。
// 两层扁平下，回复的 parent_id 可能指另一条回复，但 path 都挂同一顶层，
// 所以按 path 前缀能把「回复 @yyy」整条链都拉出来。
//
// status / viewerUserID 语义同 FindByPost；sort 控制时间正倒序。
func (r *CommentRepository) FindReplies(ctx context.Context, parentID domainshared.ID, status string, viewerUserID *domainshared.ID, sort string, page, limit int) ([]*comment.Comment, int64, error) {
	// 先查 parent 拿 path（顶层评论 path = "<uuid>/"）
	var parent model.Comment
	if err := r.db.WithContext(ctx).First(&parent, "id = ?", parentID.UUID()).Error; err != nil {
		return nil, 0, domainshared.Internal("查询父评论失败", err)
	}

	// 按 path 前缀查回复（排除 parent 自身）
	query := r.db.WithContext(ctx).Model(&model.Comment{}).
		Where("path LIKE ?", parent.Path+"%").
		Where("id != ?", parentID.UUID())
	// viewer 过滤（语义同 FindByPost）
	if viewerUserID != nil {
		query = query.Where(
			"status = ? OR (status = ? AND created_by = ?)",
			status, comment.StatusPending, viewerUserID.UUID(),
		)
	} else if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, domainshared.Internal("统计回复失败", err)
	}

	order := "created_at ASC"
	if sort == "desc" {
		order = "created_at DESC"
	}
	var pos []model.Comment
	offset := (page - 1) * limit
	if err := query.Order(order).Offset(offset).Limit(limit).Find(&pos).Error; err != nil {
		return nil, 0, domainshared.Internal("查询回复失败", err)
	}
	result := make([]*comment.Comment, 0, len(pos))
	for _, po := range pos {
		c, _ := commentToDomain(po)
		result = append(result, c)
	}
	return result, total, nil
}

// CountAnnotationsByBlock 按块聚合统计批注数量（仅 depth=0 顶层批注）。
// viewerUserID 非空时返回 approved ∪ 自己 pending；nil 时仅 approved。
func (r *CommentRepository) CountAnnotationsByBlock(ctx context.Context, postID domainshared.ID, status string, viewerUserID *domainshared.ID) ([]comment.BlockCount, error) {
	query := r.db.WithContext(ctx).Model(&model.Comment{}).
		Where("post_id = ?", postID.UUID()).
		Where("anchor_block_id IS NOT NULL").
		Where("depth = 0")

	if viewerUserID != nil {
		query = query.Where("status = ? OR (status = ? AND created_by = ?)", status, comment.StatusPending, viewerUserID.UUID())
	} else if status != "" {
		query = query.Where("status = ?", status)
	}

	var results []comment.BlockCount
	err := query.Select("anchor_block_id AS block_id, COUNT(*) AS count").
		Group("anchor_block_id").
		Find(&results).Error
	if err != nil {
		return nil, domainshared.Internal("统计批注按块聚合失败", err)
	}
	return results, nil
}

func (r *CommentRepository) FindPending(ctx context.Context, anchorFilter comment.AnchorFilter, page, limit int) ([]*comment.Comment, int64, error) {
	query := r.db.WithContext(ctx).Model(&model.Comment{}).Where("status = ?", comment.StatusPending)
	// anchor 维度过滤（后台审核区分批注/自由评论，Issue-0008）
	switch anchorFilter {
	case comment.AnchorFilterFree:
		query = query.Where("anchor_block_id IS NULL")
	case comment.AnchorFilterAnnotation:
		query = query.Where("anchor_block_id IS NOT NULL")
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, domainshared.Internal("统计待审核评论失败", err)
	}
	var pos []model.Comment
	offset := (page - 1) * limit
	if err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&pos).Error; err != nil {
		return nil, 0, domainshared.Internal("查询待审核评论失败", err)
	}
	result := make([]*comment.Comment, 0, len(pos))
	for _, po := range pos {
		c, _ := commentToDomain(po)
		result = append(result, c)
	}
	return result, total, nil
}

// CountPending 统计待审核评论数量
func (r *CommentRepository) CountPending(ctx context.Context) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).Model(&model.Comment{}).
		Where("status = ?", comment.StatusPending).Count(&count).Error; err != nil {
		return 0, domainshared.Internal("统计待审核评论失败", err)
	}
	return count, nil
}

// commentWithPostRow 用于 join posts 表的查询结果
type commentWithPostRow struct {
	model.Comment
	PostTitle *string `gorm:"column:post_title"`
	PostSlug  *string `gorm:"column:post_slug"`
}

// rowToCommentWithPost 将 join 结果转为 CommentWithPost 读模型
func rowToCommentWithPost(row commentWithPostRow) (*comment.CommentWithPost, error) {
	c, err := commentToDomain(row.Comment)
	if err != nil {
		return nil, err
	}
	ref := comment.PostRef{ID: domainshared.MustParseID(row.PostID.String())}
	if row.PostTitle != nil {
		ref.Title = *row.PostTitle
	}
	if row.PostSlug != nil {
		ref.Slug = *row.PostSlug
	}
	return &comment.CommentWithPost{Comment: c, Post: ref}, nil
}

// FindAll 全局评论列表（后台管理，关联文章标题/slug）
//
// status 控制状态筛选；anchorFilter 控制 anchor 维度筛选（自由评论/批注/全部，Issue-0008）。
// 两个维度正交：例如 status=approved + anchorFilter=annotation 返回已通过的批注。
//
// 实现注意：本查询用独立的 query（含 Select/Order）和 countQuery（仅统计）两个 GORM 查询对象，
// status 和 anchor 维度的 WHERE 都要同步追加到两个 query 上，否则总数与列表不一致。
func (r *CommentRepository) FindAll(ctx context.Context, status string, anchorFilter comment.AnchorFilter, page, limit int) ([]*comment.CommentWithPost, int64, error) {
	query := r.db.WithContext(ctx).
		Table("comments c").
		Select("c.*, p.title AS post_title, p.slug AS post_slug").
		Joins("LEFT JOIN posts p ON p.id = c.post_id")
	if status != "" {
		query = query.Where("c.status = ?", status)
	}
	// anchor 维度过滤（后台审核区分批注/自由评论，Issue-0008）
	switch anchorFilter {
	case comment.AnchorFilterFree:
		query = query.Where("c.anchor_block_id IS NULL")
	case comment.AnchorFilterAnnotation:
		query = query.Where("c.anchor_block_id IS NOT NULL")
	}

	var total int64
	countQuery := r.db.WithContext(ctx).
		Table("comments c").
		Joins("LEFT JOIN posts p ON p.id = c.post_id")
	if status != "" {
		countQuery = countQuery.Where("c.status = ?", status)
	}
	// countQuery 同步追加 anchor WHERE，避免总数与列表不一致
	switch anchorFilter {
	case comment.AnchorFilterFree:
		countQuery = countQuery.Where("c.anchor_block_id IS NULL")
	case comment.AnchorFilterAnnotation:
		countQuery = countQuery.Where("c.anchor_block_id IS NOT NULL")
	}
	if err := countQuery.Distinct("c.id").Count(&total).Error; err != nil {
		return nil, 0, domainshared.Internal("统计评论失败", err)
	}
	offset := (page - 1) * limit
	var rows []commentWithPostRow
	if err := query.Order("c.created_at DESC").Offset(offset).Limit(limit).Scan(&rows).Error; err != nil {
		return nil, 0, domainshared.Internal("查询评论列表失败", err)
	}
	result := make([]*comment.CommentWithPost, 0, len(rows))
	for _, row := range rows {
		cwp, err := rowToCommentWithPost(row)
		if err != nil {
			return nil, 0, err
		}
		result = append(result, cwp)
	}
	return result, total, nil
}

// FindByIDWithPost 按ID查评论并关联所属文章（后台详情）
func (r *CommentRepository) FindByIDWithPost(ctx context.Context, id domainshared.ID) (*comment.CommentWithPost, error) {
	var row commentWithPostRow
	err := r.db.WithContext(ctx).
		Table("comments c").
		Select("c.*, p.title AS post_title, p.slug AS post_slug").
		Joins("LEFT JOIN posts p ON p.id = c.post_id").
		Where("c.id = ?", id.UUID()).
		Scan(&row).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, comment.ErrNotFound
		}
		return nil, domainshared.Internal("查询评论详情失败", err)
	}
	if row.ID == (model.Comment{}).ID {
		return nil, comment.ErrNotFound
	}
	return rowToCommentWithPost(row)
}

// BatchUpdateStatus 批量更新评论状态，返回受影响行数
func (r *CommentRepository) BatchUpdateStatus(ctx context.Context, ids []domainshared.ID, status string) (int64, error) {
	uuids := make([]interface{}, len(ids))
	for i, id := range ids {
		uuids[i] = id.UUID()
	}
	result := r.db.WithContext(ctx).Model(&model.Comment{}).
		Where("id IN ?", uuids).
		Updates(map[string]any{"status": status, "updated_at": time.Now()})
	if result.Error != nil {
		return 0, domainshared.Internal("批量更新评论状态失败", result.Error)
	}
	return result.RowsAffected, nil
}

func (r *CommentRepository) Save(ctx context.Context, c *comment.Comment) error {
	po, err := commentToPO(c)
	if err != nil {
		return err
	}
	if err := r.db.WithContext(ctx).Save(&po).Error; err != nil {
		return domainshared.Internal("保存评论失败", err)
	}
	return nil
}

func (r *CommentRepository) UpdateStatus(ctx context.Context, id domainshared.ID, status string) error {
	result := r.db.WithContext(ctx).Model(&model.Comment{}).
		Where("id = ?", id.UUID()).Update("status", status)
	if result.Error != nil {
		return domainshared.Internal("更新评论状态失败", result.Error)
	}
	if result.RowsAffected == 0 {
		return comment.ErrNotFound
	}
	return nil
}

func (r *CommentRepository) Delete(ctx context.Context, id domainshared.ID) error {
	result := r.db.WithContext(ctx).Where("id = ?", id.UUID()).Delete(&model.Comment{})
	if result.Error != nil {
		return domainshared.Internal("删除评论失败", result.Error)
	}
	if result.RowsAffected == 0 {
		return comment.ErrNotFound
	}
	return nil
}

var _ comment.CommentRepository = (*CommentRepository)(nil)
