package gorm

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"

	domainnote "blog-api/internal/domain/note"
	"blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

type NoteRepository struct {
	db *gorm.DB
}

func NewNoteRepository(db *gorm.DB) *NoteRepository { return &NoteRepository{db: db} }

var _ domainnote.Repository = (*NoteRepository)(nil)

func (r *NoteRepository) Create(ctx context.Context, n *domainnote.Note) error {
	po := noteToPO(n)
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&po).Error; err != nil {
			return noteWriteError("创建笔记失败", err)
		}
		return replaceNoteTags(tx, &po, n.Tags())
	})
}

func (r *NoteRepository) FindByID(ctx context.Context, id shared.ID) (*domainnote.Note, error) {
	var po model.Note
	err := r.db.WithContext(ctx).Preload("Tags").Where("id = ?", id.UUID()).First(&po).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domainnote.ErrNotFound
		}
		return nil, shared.Internal("查询笔记失败", err)
	}
	return noteFromPO(&po), nil
}

func (r *NoteRepository) Save(ctx context.Context, n *domainnote.Note) error {
	po := noteToPO(n)
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&po).Error; err != nil {
			return noteWriteError("保存笔记失败", err)
		}
		return replaceNoteTags(tx, &po, n.Tags())
	})
}

func noteWriteError(message string, err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23503" && pgErr.ConstraintName == "notes_project_id_fkey" {
		return shared.BadRequest("关联项目不存在")
	}
	return shared.Internal(message, err)
}

func (r *NoteRepository) Delete(ctx context.Context, id shared.ID) error {
	res := r.db.WithContext(ctx).Delete(&model.Note{}, "id = ?", id.UUID())
	if res.Error != nil {
		return shared.Internal("删除笔记失败", res.Error)
	}
	if res.RowsAffected == 0 {
		return domainnote.ErrNotFound
	}
	return nil
}

func (r *NoteRepository) FindPage(ctx context.Context, filter domainnote.ListFilter, q shared.PageQuery) (shared.PageResult[*domainnote.Note], error) {
	query := r.db.WithContext(ctx).Model(&model.Note{})
	if filter.AuthorID != nil {
		query = query.Where("author_id = ?", filter.AuthorID.UUID())
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	var rows []model.Note
	total, err := countAndFind(query.Order("created_at DESC, id DESC").Preload("Tags"), q, &rows, "笔记")
	if err != nil {
		return shared.PageResult[*domainnote.Note]{}, err
	}
	items := make([]*domainnote.Note, 0, len(rows))
	for i := range rows {
		items = append(items, noteFromPO(&rows[i]))
	}
	return shared.NewPageResult(q, items, total), nil
}

func (r *NoteRepository) FindPublishedPage(ctx context.Context, cursor *domainnote.PublishedCursor, filter domainnote.BrowseFilter, limit int) ([]domainnote.PublishedNote, error) {
	query := r.publishedNotes(ctx)
	if filter.Type != "" {
		query = query.Where("note_type = ?", filter.Type)
	}
	if filter.ProjectID != nil {
		query = query.Where("project_id = ?", filter.ProjectID.UUID())
	}
	if filter.TagSlug != "" {
		query = query.Where(
			"id IN (SELECT nt.note_id FROM note_tags nt JOIN tags t ON nt.tag_id = t.id WHERE t.slug = ?)",
			filter.TagSlug,
		)
	}
	if cursor != nil {
		// OR 展开而非行值比较，兼容 SQLite 契约测试（与 tweet/gallery 同款）。
		query = query.Where(
			"published_at < ? OR (published_at = ? AND id < ?)",
			cursor.PublishedAt, cursor.PublishedAt, cursor.ID.UUID(),
		)
	}
	var rows []model.Note
	if err := query.Order("published_at DESC, id DESC").Limit(limit).Find(&rows).Error; err != nil {
		return nil, shared.Internal("查询公开笔记流失败", err)
	}
	out := make([]domainnote.PublishedNote, 0, len(rows))
	for i := range rows {
		out = append(out, publishedNoteFromPO(&rows[i]))
	}
	return out, nil
}

func (r *NoteRepository) FindPublishedByID(ctx context.Context, id shared.ID) (domainnote.PublishedNote, error) {
	var po model.Note
	err := r.publishedNotes(ctx).Where("id = ?", id.UUID()).First(&po).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return domainnote.PublishedNote{}, domainnote.ErrNotFound
		}
		return domainnote.PublishedNote{}, shared.Internal("查询公开笔记失败", err)
	}
	return publishedNoteFromPO(&po), nil
}

func (r *NoteRepository) publishedNotes(ctx context.Context) *gorm.DB {
	return r.db.WithContext(ctx).Model(&model.Note{}).
		Select("id", "title", "content_html", "published_at", "note_type", "project_id",
			"pitfall_symptom", "pitfall_cause", "pitfall_remedy", "pitfall_resolved", "pitfall_code").
		Where("status = ?", domainnote.StatusPublished).
		Preload("Tags").
		Preload("Project", func(db *gorm.DB) *gorm.DB {
			return db.Select("id", "title")
		})
}

// replaceNoteTags 按 name 解析标签并整体替换关联；语义与 post 仓储一致：
// 请求的标签必须已存在，未知标签报错而非静默丢弃（自动建标签是 MCP
// create_note 的责任，T4 接入）。
func replaceNoteTags(tx *gorm.DB, po *model.Note, tagNames []string) error {
	if len(tagNames) == 0 {
		return tx.Model(po).Association("Tags").Clear()
	}
	var tags []model.Tag
	if err := tx.Where("name IN ?", tagNames).Find(&tags).Error; err != nil {
		return shared.Internal("查询标签失败", err)
	}
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
		return shared.BadRequest(fmt.Sprintf("标签不存在: %s", strings.Join(missing, ", ")))
	}
	return tx.Model(po).Association("Tags").Replace(&tags)
}

func noteToPO(n *domainnote.Note) model.Note {
	journal := n.Journal()
	po := model.Note{
		ID:          n.ID().UUID(),
		AuthorID:    n.AuthorID().UUID(),
		Title:       n.Title(),
		ContentMD:   n.ContentMD(),
		ContentHTML: n.ContentHTML(),
		Status:      n.Status(),
		PublishedAt: n.PublishedAt(),
		CreatedAt:   n.CreatedAt(),
		UpdatedAt:   n.UpdatedAt(),
		NoteType:    string(journal.Type),
	}
	if journal.ProjectID != nil {
		id := journal.ProjectID.UUID()
		po.ProjectID = &id
	}
	if p := journal.Pitfall; p != nil {
		po.PitfallSymptom = p.Symptom
		po.PitfallCause = p.Cause
		po.PitfallRemedy = p.Remedy
		po.PitfallResolved = p.Resolved
		po.PitfallCode = p.Code
	}
	return po
}

func noteFromPO(po *model.Note) *domainnote.Note {
	tags := make([]string, 0, len(po.Tags))
	for _, t := range po.Tags {
		tags = append(tags, t.Name)
	}
	journal := domainnote.Journal{
		Type: domainnote.Type(po.NoteType), ProjectID: noteProjectID(po.ProjectID), Pitfall: notePitfallFromPO(po),
	}
	return domainnote.Reconstruct(
		shared.IDFromUUID(po.ID), shared.IDFromUUID(po.AuthorID),
		po.Title, po.ContentMD, po.ContentHTML, po.Status,
		po.PublishedAt, po.CreatedAt, po.UpdatedAt, tags, journal,
	)
}

func publishedNoteFromPO(po *model.Note) domainnote.PublishedNote {
	tags := make([]string, 0, len(po.Tags))
	for _, t := range po.Tags {
		tags = append(tags, t.Name)
	}
	var project *domainnote.PublishedProject
	if po.Project != nil {
		project = &domainnote.PublishedProject{ID: shared.IDFromUUID(po.Project.ID), Title: po.Project.Title}
	}
	return domainnote.PublishedNote{
		ID:          shared.IDFromUUID(po.ID),
		Title:       po.Title,
		ContentHTML: po.ContentHTML,
		Tags:        tags,
		PublishedAt: derefTime(po.PublishedAt),
		Type:        domainnote.Type(po.NoteType),
		Project:     project,
		Pitfall:     notePitfallFromPO(po),
	}
}

func noteProjectID(id *uuid.UUID) *shared.ID {
	if id == nil {
		return nil
	}
	projectID := shared.IDFromUUID(*id)
	return &projectID
}

func notePitfallFromPO(po *model.Note) *domainnote.Pitfall {
	if po.NoteType != string(domainnote.TypePitfall) {
		return nil
	}
	return &domainnote.Pitfall{
		Symptom: po.PitfallSymptom, Cause: po.PitfallCause, Remedy: po.PitfallRemedy,
		Resolved: po.PitfallResolved, Code: po.PitfallCode,
	}
}

func derefTime(t *time.Time) time.Time {
	if t == nil {
		return time.Time{}
	}
	return *t
}
