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
	if u := c.UserID(); u != nil {
		uid := u.UUID()
		po.CreatedBy = &uid
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
	return comment.ReconstructComment(
		domainshared.MustParseID(po.ID.String()),
		domainshared.MustParseID(po.PostID.String()),
		userID,
		parentID, po.Path, po.Depth,
		nil, // anchor 字段未在 045 migration 落地（Issue-0003 处理），重建时暂为 nil
		po.AuthorName, po.AuthorEmail, po.AuthorURL, po.AvatarURL,
		po.Body, pictures, po.Status, po.IPHash, po.UserAgent,
		po.CreatedAt, po.UpdatedAt,
	), nil
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

func (r *CommentRepository) FindByPost(ctx context.Context, postID domainshared.ID, status string, viewerUserID *domainshared.ID, page, limit int) ([]*comment.Comment, int64, error) {
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

func (r *CommentRepository) FindReplies(ctx context.Context, parentPath string) ([]*comment.Comment, error) {
	var pos []model.Comment
	// 查询 path 以 parentPath 开头的所有后代
	if err := r.db.WithContext(ctx).Where("path LIKE ?", parentPath+"%").
		Order("created_at ASC").Find(&pos).Error; err != nil {
		return nil, domainshared.Internal("查询回复失败", err)
	}
	result := make([]*comment.Comment, 0, len(pos))
	for _, po := range pos {
		c, _ := commentToDomain(po)
		result = append(result, c)
	}
	return result, nil
}

func (r *CommentRepository) FindPending(ctx context.Context, page, limit int) ([]*comment.Comment, int64, error) {
	query := r.db.WithContext(ctx).Model(&model.Comment{}).Where("status = ?", comment.StatusPending)
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
func (r *CommentRepository) FindAll(ctx context.Context, status string, page, limit int) ([]*comment.CommentWithPost, int64, error) {
	query := r.db.WithContext(ctx).
		Table("comments c").
		Select("c.*, p.title AS post_title, p.slug AS post_slug").
		Joins("LEFT JOIN posts p ON p.id = c.post_id")
	if status != "" {
		query = query.Where("c.status = ?", status)
	}
	var total int64
	countQuery := r.db.WithContext(ctx).
		Table("comments c").
		Joins("LEFT JOIN posts p ON p.id = c.post_id")
	if status != "" {
		countQuery = countQuery.Where("c.status = ?", status)
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
