package gorm

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
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

// FindPage 分页列出评论（统一入口；筛选与排序语义见 comment.ListFilter）。
//
// 表引用统一走 Table("comments c") 别名形态，与 FindPageWithPost 的 JOIN 场景
// 共享同一套 applyCommentFilters（列名一律 c. 前缀，无歧义）。
func (r *CommentRepository) FindPage(ctx context.Context, filter comment.ListFilter, q domainshared.PageQuery) (domainshared.PageResult[*comment.Comment], error) {
	q = q.Normalize()
	query := r.db.WithContext(ctx).Table("comments c")
	query, err := applyCommentFilters(r.db, ctx, query, filter)
	if err != nil {
		return domainshared.PageResult[*comment.Comment]{}, err
	}
	query = query.Order(commentPageOrder(filter))
	var pos []model.Comment
	total, err := countAndFind(query, q, &pos, "评论")
	if err != nil {
		return domainshared.PageResult[*comment.Comment]{}, err
	}
	result := make([]*comment.Comment, 0, len(pos))
	for _, po := range pos {
		c, err := commentToDomain(po)
		if err != nil {
			return domainshared.PageResult[*comment.Comment]{}, err
		}
		result = append(result, c)
	}
	return domainshared.NewPageResult(q, result, total), nil
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

// commentPageOrder 由 filter 决定页内排序（均带唯一列 tiebreaker，防 offset 翻页漂移）。
func commentPageOrder(filter comment.ListFilter) string {
	if filter.ParentID != nil && filter.Sort != "desc" {
		// 回复链默认最早优先（时间线阅读顺序）
		return "c.created_at ASC, c.id ASC"
	}
	return "c.created_at DESC, c.id DESC"
}
// applyCommentFilters 把 ListFilter 的正交筛选维度组装到 query。
//
// 入参 query 必须是 Table("comments c") 别名形态（列名一律 c. 前缀），
// 与 FindPage / FindPageWithPost 两种调用方保持一致，同一套列名无歧义。
// parent 查询走独立的 db 入口，不与主 query 链交互。
func applyCommentFilters(db *gorm.DB, ctx context.Context, query *gorm.DB, filter comment.ListFilter) (*gorm.DB, error) {
	// ParentID 场景：先查 parent 拿 path（顶层评论 path 形如 "<uuid>/"），
	// 再按 path 前缀查所有回复（path LIKE "<uuid>/%"），排除 parent 自身。
	// 两层扁平下，回复的 parent_id 可能指另一条回复，但 path 都挂同一顶层，
	// 所以按 path 前缀能把「回复 @yyy」整条链都拉出来。
	if filter.ParentID != nil {
		var parent model.Comment
		if err := db.WithContext(ctx).Model(&model.Comment{}).
			Where("id = ?", filter.ParentID.UUID()).First(&parent).Error; err != nil {
			return nil, domainshared.Internal("查询父评论失败", err)
		}
		query = query.Where("c.path LIKE ?", parent.Path+"%").
			Where("c.id != ?", filter.ParentID.UUID())
	}
	if filter.PostID != nil {
		query = query.Where("c.post_id = ?", filter.PostID.UUID())
	}
	// viewer 过滤：Status 匹配项联合（若 viewer 登录）viewer 自己的 pending；
	// ViewerUserID 为 nil 时仅 Status 过滤（匿名场景由 service 层短路，此分支供后台复用）。
	if filter.ViewerUserID != nil {
		query = query.Where(
			"c.status = ? OR (c.status = ? AND c.created_by = ?)",
			filter.Status, comment.StatusPending, filter.ViewerUserID.UUID(),
		)
	} else if filter.Status != "" {
		query = query.Where("c.status = ?", filter.Status)
	}
	// anchor 维度过滤：自由评论（anchor_block_id IS NULL）/ 批注（IS NOT NULL）/ 全部（不过滤）。
	switch filter.AnchorFilter {
	case comment.AnchorFilterFree:
		query = query.Where("c.anchor_block_id IS NULL")
	case comment.AnchorFilterAnnotation:
		query = query.Where("c.anchor_block_id IS NOT NULL")
	}
	// depth 维度过滤：nil = 不过滤；顶层列表传 &TopLevel，避免子和父混在一页被分页切走。
	if filter.DepthFilter != nil {
		query = query.Where("c.depth = ?", *filter.DepthFilter)
	}
	// block_id 精确过滤（批注按块懒加载）
	if filter.BlockID != "" {
		query = query.Where("c.anchor_block_id = ?", filter.BlockID)
	}
	// 全文检索：多关键词 AND，每个词都命中 body。
	// 用 LOWER(body) LIKE LOWER(?) 跨库兼容（SQLite 无 ILIKE，PG ILIKE 等价于此）。
	for _, kw := range strings.Fields(filter.Query) {
		like := "%" + likeEscaper.Replace(kw) + "%"
		query = query.Where("LOWER(c.body) LIKE LOWER(?) ESCAPE '\\'", like)
	}
	return query, nil
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

// FindPageWithPost 分页列出评论并关联所属文章（后台管理读模型）。
//
// JOIN posts（主键关联不翻倍），countAndFind 统一计数与切片；
// Query 非空时做 body 多关键词 AND 检索（MCP search_comments）。
func (r *CommentRepository) FindPageWithPost(ctx context.Context, filter comment.ListFilter, q domainshared.PageQuery) (domainshared.PageResult[*comment.CommentWithPost], error) {
	q = q.Normalize()
	query := r.db.WithContext(ctx).
		Table("comments c").
		Select("c.*, p.title AS post_title, p.slug AS post_slug").
		Joins("LEFT JOIN posts p ON p.id = c.post_id")
	// 表别名 c. 前缀场景在 helper 内统一改写（锚点/全文列名不带别名会歧义）
	filterQuery, err := applyCommentFilters(r.db, ctx, query, filter)
	if err != nil {
		return domainshared.PageResult[*comment.CommentWithPost]{}, err
	}
	filterQuery = filterQuery.Order(commentPageOrder(filter))
	var rows []commentWithPostRow
	total, err := countAndFind(filterQuery, q, &rows, "评论")
	if err != nil {
		return domainshared.PageResult[*comment.CommentWithPost]{}, err
	}
	result := make([]*comment.CommentWithPost, 0, len(rows))
	for _, row := range rows {
		cwp, err := rowToCommentWithPost(row)
		if err != nil {
			return domainshared.PageResult[*comment.CommentWithPost]{}, err
		}
		result = append(result, cwp)
	}
	return domainshared.NewPageResult(q, result, total), nil
}

// Stats 按文章聚合评论统计（MCP comment_stats），仅含有反馈的文章。
func (r *CommentRepository) Stats(ctx context.Context, status string) ([]comment.PostCommentStat, error) {
	q := r.db.WithContext(ctx).
		Table("comments c").
		Joins("JOIN posts p ON p.id = c.post_id").
		Where("c.post_id IS NOT NULL")
	if status != "" {
		q = q.Where("c.status = ?", status)
	}
	// 批注计数用条件聚合（anchor_block_id IS NOT NULL 计 1，否则 0）
	type statRow struct {
		PostID          string `gorm:"column:post_id"`
		PostTitle       string `gorm:"column:post_title"`
		PostSlug        string `gorm:"column:post_slug"`
		AnnotationCount int64  `gorm:"column:annotation_count"`
		CommentCount    int64  `gorm:"column:comment_count"`
		// LatestAt 用 string 接收跨库兼容（SQLite MAX(date) 返回 TEXT，PG 返回 timestamp 文本），
		// 再 time.Parse 转回 time.Time。
		LatestAt string `gorm:"column:latest_at"`
	}
	var rows []statRow
	// HAVING COUNT(*) > 0 排除零反馈文章（JOIN posts 已隐含 post 存在）；
	// annotation_count DESC 排序，批注密集的优先。
	if err := q.Select(`
		c.post_id AS post_id,
		p.title AS post_title,
		p.slug AS post_slug,
		COUNT(*) AS comment_count,
		COUNT(c.anchor_block_id) AS annotation_count,
		MAX(c.created_at) AS latest_at
	`).
		Group("c.post_id, p.title, p.slug").
		Having("COUNT(*) > 0").
		Order("annotation_count DESC, comment_count DESC").
		Scan(&rows).Error; err != nil {
		return nil, domainshared.Internal("聚合评论统计失败", err)
	}
	result := make([]comment.PostCommentStat, 0, len(rows))
	for _, row := range rows {
		pid, err := domainshared.ParseID(row.PostID)
		if err != nil {
			return nil, domainshared.Internal("解析 post_id 失败", err)
		}
		// MAX(created_at) 跨库返回字符串，尝试多格式解析（RFC3339 / SQLite datetime）。
		var latest time.Time
		for _, layout := range []string{time.RFC3339Nano, time.RFC3339, "2006-01-02 15:04:05+00:00", "2006-01-02 15:04:05"} {
			if t, e := time.Parse(layout, row.LatestAt); e == nil {
				latest = t
				break
			}
		}
		result = append(result, comment.PostCommentStat{
			PostID:          pid,
			PostTitle:       row.PostTitle,
			PostSlug:        row.PostSlug,
			AnnotationCount: row.AnnotationCount,
			CommentCount:    row.CommentCount,
			LatestAt:        latest,
		})
	}
	return result, nil
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
