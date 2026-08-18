package gorm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"blog-api/internal/domain/post"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// PostRepository 文章仓储 GORM 实现
type PostRepository struct {
	db *gorm.DB
}

func NewPostRepository(db *gorm.DB) *PostRepository {
	return &PostRepository{db: db}
}

func postToPO(p *post.Post) model.Post {
	po := model.Post{
		ID: p.ID().UUID(), Title: p.Title(), Slug: p.Slug(),
		ContentMD: p.ContentMD(), ContentHTML: p.ContentHTML(),
		Excerpt: p.Excerpt(), CoverImage: p.CoverImage(),
		Status: p.Status(), AuthorID: p.AuthorID().UUID(),
		ViewCount: p.ViewCount(), IsFeatured: p.IsFeatured(),
		SEOTitle: p.SEOTitle(), SEODescription: p.SEODescription(),
		CanonicalURL: p.CanonicalURL(),
	}
	if t := p.PublishedAt(); t != nil {
		po.PublishedAt = t
	}
	if c := p.CreatedAt(); !c.IsZero() {
		po.CreatedAt = c
		po.UpdatedAt = p.UpdatedAt()
	} else {
		po.CreatedAt = time.Now()
		po.UpdatedAt = time.Now()
	}
	return po
}

func postToDomain(po model.Post) (*post.Post, error) {
	tags := make([]string, 0, len(po.Tags))
	for _, t := range po.Tags {
		tags = append(tags, t.Name)
	}
	return post.ReconstructPost(
		domainshared.MustParseID(po.ID.String()),
		domainshared.MustParseID(po.AuthorID.String()),
		po.Title, po.Slug, po.ContentMD, po.ContentHTML,
		po.Excerpt, po.CoverImage, po.Status, po.ViewCount,
		po.IsFeatured, po.SEOTitle, po.SEODescription,
		po.PublishedAt, po.CanonicalURL, tags, po.CreatedAt, po.UpdatedAt,
	), nil
}

func (r *PostRepository) FindByID(ctx context.Context, id domainshared.ID) (*post.Post, error) {
	var po model.Post
	if err := r.db.WithContext(ctx).Unscoped().Preload("Tags").First(&po, "id = ?", id.UUID()).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, post.ErrNotFound
		}
		return nil, domainshared.Internal("查询文章失败", err)
	}
	return postToDomain(po)
}

func (r *PostRepository) FindBySlug(ctx context.Context, slug string) (*post.Post, error) {
	var po model.Post
	if err := r.db.WithContext(ctx).Preload("Tags").First(&po, "slug = ?", slug).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, post.ErrNotFound
		}
		return nil, domainshared.Internal("查询文章失败", err)
	}
	return postToDomain(po)
}

// FindPage 分页列出文章（统一入口；筛选与排序语义见 post.ListFilter）。
//
// 关键词检索用 LOWER(col) LIKE LOWER(?) 而非 ILIKE 关键字：语义与 ILIKE 等价
// （中文无大小写，子串精确命中），且 SQLite 测试库可跑同一 SQL（ILIKE 是
// PostgreSQL 方言）。tags（slug 列表，AND 关系）：每个 tag 要求 posts.id 属于
// 该标签的文章集合，多个条件叠加即「同时关联全部标签」。用子查询而非
// JOIN+HAVING，避免 GROUP BY 与分页 Count/Preload 冲突。
func (r *PostRepository) FindPage(ctx context.Context, filter post.ListFilter, q domainshared.PageQuery) (domainshared.PageResult[*post.Post], error) {
	q = q.Normalize()
	query := r.db.WithContext(ctx).Model(&model.Post{})
	if filter.Status == "trashed" {
		// 回收站视图：切 Unscoped 取软删除行（deleted_at IS NOT NULL）
		query = query.Unscoped().Where("deleted_at IS NOT NULL")
	} else if filter.Status != "" && filter.Status != "all" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.AuthorID != nil {
		query = query.Where("author_id = ?", filter.AuthorID.UUID())
	}
	for _, kw := range strings.Fields(filter.Keyword) {
		like := "%" + likeEscaper.Replace(kw) + "%"
		query = query.Where(
			"(LOWER(title) LIKE LOWER(?) ESCAPE '\\' OR LOWER(excerpt) LIKE LOWER(?) ESCAPE '\\' OR LOWER(content_md) LIKE LOWER(?) ESCAPE '\\')",
			like, like, like,
		)
	}
	for _, slug := range filter.Tags {
		slug = strings.TrimSpace(slug)
		if slug == "" {
			continue
		}
		query = query.Where(
			"posts.id IN (SELECT post_id FROM post_tags JOIN tags ON tags.id = post_tags.tag_id WHERE tags.slug = ?)",
			slug,
		)
	}
	var pos []model.Post
	total, err := countAndFind(query.Order(postPageOrder(filter.Sort)).Preload("Tags"), q, &pos, "文章")
	if err != nil {
		return domainshared.PageResult[*post.Post]{}, err
	}
	result := make([]*post.Post, 0, len(pos))
	for _, po := range pos {
		p, err := postToDomain(po)
		if err != nil {
			return domainshared.PageResult[*post.Post]{}, err
		}
		result = append(result, p)
	}
	return domainshared.NewPageResult(q, result, total), nil
}

// postPageOrder 列表排序子句（唯一列 id tiebreaker 防 offset 翻页漂移）。
func postPageOrder(sort string) string {
	switch sort {
	case post.SortPublished:
		return "is_featured DESC, published_at DESC, id DESC"
	case post.SortUpdated:
		return "updated_at DESC, id DESC"
	default:
		return "created_at DESC, id DESC"
	}
}

// BatchGetByIDs 批量按 ID 查文章（Unscoped，含软删除行）。
// 批量操作前一次性校验存在性与所有权，避免逐条 FindByID 查询。
func (r *PostRepository) BatchGetByIDs(ctx context.Context, ids []domainshared.ID) ([]*post.Post, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	uuids := make([]interface{}, len(ids))
	for i, id := range ids {
		uuids[i] = id.UUID()
	}
	var pos []model.Post
	if err := r.db.WithContext(ctx).Unscoped().Preload("Tags").Where("id IN ?", uuids).Find(&pos).Error; err != nil {
		return nil, domainshared.Internal("批量查询文章失败", err)
	}
	result := make([]*post.Post, 0, len(pos))
	for _, po := range pos {
		p, _ := postToDomain(po)
		result = append(result, p)
	}
	return result, nil
}

// likeEscaper 转义 LIKE 模式中的特殊字符，配合 ESCAPE '\' 使用。
var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

func (r *PostRepository) ExistsBySlug(ctx context.Context, slug string) (bool, error) {	var count int64
	if err := r.db.WithContext(ctx).Model(&model.Post{}).Where("slug = ?", slug).Count(&count).Error; err != nil {
		return false, domainshared.Internal("查询 slug 存在性失败", err)
	}
	return count > 0, nil
}

// Save 保存文章并同步标签关联。
// 用 db.Transaction 包裹全文 + 标签关联，保证原子性；通过 Association API
// 操作 many2many 关系（替代原先手写 Begin/Commit + 裸 SQL 的脆弱实现）。
func (r *PostRepository) Save(ctx context.Context, p *post.Post) error {
	po := postToPO(p)
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 保存文章基本信息
		if err := tx.Save(&po).Error; err != nil {
			return domainshared.Internal("保存文章失败", err)
		}
		// 同步标签关联：按 name 查 tag → 替换关联
		tagNames := p.Tags()
		if len(tagNames) == 0 {
			return tx.Model(&po).Association("Tags").Clear()
		}
		var tags []model.Tag
		if err := tx.Where("name IN ?", tagNames).Find(&tags).Error; err != nil {
			return domainshared.Internal("查询标签失败", err)
		}
		// 校验：所有请求的标签必须存在，避免静默丢弃未知标签
		if len(tags) != len(tagNames) {
			found := make(map[string]bool, len(tags))
			for _, t := range tags {
				found[t.Name] = true
			}
			missing := make([]string, 0)
			for _, n := range tagNames {
				if !found[n] {
					missing = append(missing, n)
				}
			}
			return domainshared.BadRequest(fmt.Sprintf("标签不存在: %s", strings.Join(missing, ", ")))
		}
		return tx.Model(&po).Association("Tags").Replace(&tags)
	})
}

func (r *PostRepository) Delete(ctx context.Context, id domainshared.ID) error {
	result := r.db.WithContext(ctx).Where("id = ?", id.UUID()).Delete(&model.Post{})
	if result.Error != nil {
		return domainshared.Internal("删除文章失败", result.Error)
	}
	if result.RowsAffected == 0 {
		return post.ErrNotFound
	}
	return nil
}

func (r *PostRepository) Restore(ctx context.Context, id domainshared.ID) error {
	result := r.db.WithContext(ctx).Unscoped().Model(&model.Post{}).Where("id = ?", id.UUID()).Update("deleted_at", nil)
	if result.Error != nil {
		return domainshared.Internal("恢复文章失败", result.Error)
	}
	if result.RowsAffected == 0 {
		return post.ErrNotFound
	}
	return nil
}

func (r *PostRepository) HardDelete(ctx context.Context, id domainshared.ID) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		uuid := id.UUID()
		
		// 1. Delete comment reactions for comments belonging to this post
		if err := tx.Unscoped().Where("comment_id IN (SELECT id FROM comments WHERE post_id = ?)", uuid).Delete(&model.CommentReaction{}).Error; err != nil {
			return domainshared.Internal("删除评论反应失败", err)
		}
		
		// 2. Delete comments
		if err := tx.Unscoped().Where("post_id = ?", uuid).Delete(&model.Comment{}).Error; err != nil {
			return domainshared.Internal("删除评论失败", err)
		}
		
		// 3. Delete post versions
		if err := tx.Unscoped().Where("post_id = ?", uuid).Delete(&model.PostVersion{}).Error; err != nil {
			return domainshared.Internal("删除历史版本失败", err)
		}
		
		// 4. Delete post views
		if err := tx.Unscoped().Where("post_id = ?", uuid).Delete(&model.PostView{}).Error; err != nil {
			return domainshared.Internal("删除浏览记录失败", err)
		}
		
		// 5. Delete post_tags mappings
		if err := tx.Exec("DELETE FROM post_tags WHERE post_id = ?", uuid).Error; err != nil {
			return domainshared.Internal("删除标签关联失败", err)
		}
		
		// 6. Delete post itself
		result := tx.Unscoped().Where("id = ?", uuid).Delete(&model.Post{})
		if result.Error != nil {
			return domainshared.Internal("彻底删除文章失败", result.Error)
		}
		if result.RowsAffected == 0 {
			return post.ErrNotFound
		}
		
		return nil
	})
}

// IncrementViewAtomic 原子地浏览量+1 并记录浏览事件，保证两者在同一事务内提交。
// 在 DB 内用 UPDATE ... SET view_count = view_count + 1（避免读-改-写竞态），
// 同时写入 post_views 事件行。修复原先 Save 与 RecordView 分离导致计数与事件可能不一致。
func (r *PostRepository) IncrementViewAtomic(ctx context.Context, postID domainshared.ID, ipAddress, userAgent string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 浏览量原子自增（DB 内 +1，避免并发覆盖）
		if err := tx.Model(&model.Post{}).
			Where("id = ?", postID.UUID()).
			UpdateColumn("view_count", gorm.Expr("view_count + 1")).Error; err != nil {
			return domainshared.Internal("更新浏览量失败", err)
		}
		// 浏览事件行
		pv := model.PostView{
			PostID: postID.UUID(), IPAddress: ipAddress, UserAgent: userAgent,
		}
		if err := tx.Create(&pv).Error; err != nil {
			return domainshared.Internal("记录浏览事件失败", err)
		}
		return nil
	})
}

// FindArchiveYears 返回所有含已发布文章的年份（倒序、去重）。
// 仅取 published_at 的年份分量，过滤未发布与无发布时间的文章。
func (r *PostRepository) FindArchiveYears(ctx context.Context) ([]int, error) {
	var years []int
	err := r.db.WithContext(ctx).
		Model(&model.Post{}).
		Where("status = ? AND published_at IS NOT NULL", post.StatusPublished).
		Distinct("EXTRACT(YEAR FROM published_at)").
		Order("EXTRACT(YEAR FROM published_at) DESC").
		Pluck("EXTRACT(YEAR FROM published_at)", &years).
		Error
	if err != nil {
		return nil, domainshared.Internal("归档年份查询失败", err)
	}
	return years, nil
}

// FindPublishedByYear 返回指定年份的全部已发布文章（按 published_at 倒序）。
// Preload Tags 以便归档项携带标签名。
func (r *PostRepository) FindPublishedByYear(ctx context.Context, year int) ([]*post.Post, error) {
	var pos []model.Post
	err := r.db.WithContext(ctx).
		Preload("Tags").
		Where("status = ? AND published_at IS NOT NULL AND EXTRACT(YEAR FROM published_at) = ?",
			post.StatusPublished, year).
		Order("published_at DESC").
		Find(&pos).Error
	if err != nil {
		return nil, domainshared.Internal("按年查询归档文章失败", err)
	}
	result := make([]*post.Post, 0, len(pos))
	for _, po := range pos {
		p, _ := postToDomain(po)
		result = append(result, p)
	}
	return result, nil
}

func postVersionToPO(v *post.PostVersion) model.PostVersion {
	tagsBytes, _ := json.Marshal(v.Tags())
	return model.PostVersion{
		ID:          v.ID().UUID(),
		PostID:      v.PostID().UUID(),
		Title:       v.Title(),
		ContentMD:   v.ContentMD(),
		ContentHTML: v.ContentHTML(),
		Excerpt:     v.Excerpt(),
		CoverImage:  v.CoverImage(),
		Tags:        string(tagsBytes),
		EditorID:    v.EditorID().UUID(),
		Summary:     v.Summary(),
		CreatedAt:   v.CreatedAt(),
	}
}

func postVersionToDomain(po model.PostVersion) (*post.PostVersion, error) {
	var tags []string
	if po.Tags != "" {
		_ = json.Unmarshal([]byte(po.Tags), &tags)
	}
	return post.ReconstructPostVersion(
		domainshared.MustParseID(po.ID.String()),
		domainshared.MustParseID(po.PostID.String()),
		po.Title, po.ContentMD, po.ContentHTML,
		po.Excerpt, po.CoverImage, tags,
		domainshared.MustParseID(po.EditorID.String()),
		po.Summary, po.CreatedAt,
	), nil
}

func (r *PostRepository) SaveVersion(ctx context.Context, version *post.PostVersion) error {
	po := postVersionToPO(version)
	if err := r.db.WithContext(ctx).Create(&po).Error; err != nil {
		return domainshared.Internal("保存版本快照失败", err)
	}
	return nil
}

func (r *PostRepository) FindVersionsByPostID(ctx context.Context, postID domainshared.ID) ([]*post.PostVersion, error) {
	var pos []model.PostVersion
	if err := r.db.WithContext(ctx).Where("post_id = ?", postID.UUID()).Order("created_at DESC").Find(&pos).Error; err != nil {
		return nil, domainshared.Internal("查询版本列表失败", err)
	}
	result := make([]*post.PostVersion, 0, len(pos))
	for _, po := range pos {
		p, _ := postVersionToDomain(po)
		result = append(result, p)
	}
	return result, nil
}

func (r *PostRepository) GetVersionByID(ctx context.Context, versionID domainshared.ID) (*post.PostVersion, error) {
	var po model.PostVersion
	if err := r.db.WithContext(ctx).First(&po, "id = ?", versionID.UUID()).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, post.ErrNotFound // Using ErrNotFound from post pkg
		}
		return nil, domainshared.Internal("查询版本快照失败", err)
	}
	return postVersionToDomain(po)
}

// FindCollaboratorIDsByPostID 返回该文章的协同者 ID（按首次编辑时间升序、去重、排除 owner）。
// 协同者 = 在 post_versions.editor_id 出现过且不等于 posts.author_id 的用户。
// 用 GROUP BY editor_id + ORDER BY MIN(created_at) 保证去重且按首次参与时间排序。
func (r *PostRepository) FindCollaboratorIDsByPostID(ctx context.Context, postID domainshared.ID) ([]domainshared.ID, error) {
	var ids []string
	err := r.db.WithContext(ctx).
		Table("post_versions").
		Select("post_versions.editor_id").
		Joins("JOIN posts ON posts.id = post_versions.post_id").
		Where("post_versions.post_id = ? AND post_versions.editor_id <> posts.author_id", postID.UUID()).
		Group("post_versions.editor_id").
		Order("MIN(post_versions.created_at) ASC").
		Pluck("post_versions.editor_id", &ids).Error
	if err != nil {
		return nil, domainshared.Internal("查询协同者 ID 失败", err)
	}
	result := make([]domainshared.ID, 0, len(ids))
	for _, id := range ids {
		result = append(result, domainshared.MustParseID(id))
	}
	return result, nil
}

// FindCollaboratorIDsByPostIDs 批量返回多篇文章的协同者 ID。
// 返回 map[postID][]collaboratorID，每个 post 内的 ID 按首次编辑时间升序、去重、排除 owner。
func (r *PostRepository) FindCollaboratorIDsByPostIDs(ctx context.Context, postIDs []domainshared.ID) (map[string][]domainshared.ID, error) {
	if len(postIDs) == 0 {
		return map[string][]domainshared.ID{}, nil
	}
	uuids := make([]string, 0, len(postIDs))
	for _, id := range postIDs {
		uuids = append(uuids, id.UUID().String())
	}

	type row struct {
		PostID   string `gorm:"column:post_id"`
		EditorID string `gorm:"column:editor_id"`
	}
	var rows []row
	err := r.db.WithContext(ctx).
		Table("post_versions").
		Select("post_versions.post_id, post_versions.editor_id").
		Joins("JOIN posts ON posts.id = post_versions.post_id").
		Where("post_versions.post_id IN ? AND post_versions.editor_id <> posts.author_id", uuids).
		Group("post_versions.post_id, post_versions.editor_id").
		Order("post_versions.post_id, MIN(post_versions.created_at) ASC").
		Scan(&rows).Error
	if err != nil {
		return nil, domainshared.Internal("批量查询协同者 ID 失败", err)
	}

	result := make(map[string][]domainshared.ID, len(postIDs))
	for _, r := range rows {
		result[r.PostID] = append(result[r.PostID], domainshared.MustParseID(r.EditorID))
	}
	return result, nil
}

var _ post.PostRepository = (*PostRepository)(nil)
