// Package note 提供 application 层用例。
package note

import (
	"context"
	"strings"
	"time"

	"blog-api/internal/application/markdown"
	domainnote "blog-api/internal/domain/note"
	"blog-api/internal/domain/shared"
)

// Service 编排笔记的创建、编辑、发布与公开浏览。
type Service struct {
	repo domainnote.Repository
}

func NewService(repo domainnote.Repository) *Service {
	return &Service{repo: repo}
}

// Create 创建草稿笔记；content_html 由 markdown 管线在保存前生成。
func (s *Service) Create(ctx context.Context, in CreateInput) (NoteDTO, error) {
	authorID, err := shared.ParseID(strings.TrimSpace(in.UserID))
	if err != nil {
		return NoteDTO{}, shared.BadRequest("作者身份无效")
	}
	html, err := markdown.ToHTML(in.ContentMD)
	if err != nil {
		return NoteDTO{}, shared.BadRequest("笔记正文渲染失败")
	}
	n, err := domainnote.NewNote(shared.NewID(), authorID, in.Title, in.ContentMD, in.Tags)
	if err != nil {
		return NoteDTO{}, err
	}
	if err := n.Edit(in.Title, in.ContentMD, html, in.Tags); err != nil {
		return NoteDTO{}, err
	}
	if err := s.repo.Create(ctx, n); err != nil {
		return NoteDTO{}, err
	}
	return toDTO(n), nil
}

// Update 全量保存可编辑内容；状态与发布时间不变。
func (s *Service) Update(ctx context.Context, in UpdateInput) (NoteDTO, error) {
	id, err := parseID(in.NoteID)
	if err != nil {
		return NoteDTO{}, err
	}
	html, err := markdown.ToHTML(in.ContentMD)
	if err != nil {
		return NoteDTO{}, shared.BadRequest("笔记正文渲染失败")
	}
	n, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return NoteDTO{}, err
	}
	if err := n.Edit(in.Title, in.ContentMD, html, in.Tags); err != nil {
		return NoteDTO{}, err
	}
	if err := s.repo.Save(ctx, n); err != nil {
		return NoteDTO{}, err
	}
	return toDTO(n), nil
}

// Get 读取单条笔记（含草稿）。
func (s *Service) Get(ctx context.Context, noteID string) (NoteDTO, error) {
	id, err := parseID(noteID)
	if err != nil {
		return NoteDTO{}, err
	}
	n, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return NoteDTO{}, err
	}
	return toDTO(n), nil
}

// List 按状态筛选分页读取管理列表，created_at 倒序。
func (s *Service) List(ctx context.Context, query ListQuery) ([]NoteSummaryDTO, int64, error) {
	q := shared.PageQuery{Page: query.Page, Limit: query.Limit}.Normalize()
	page, err := s.repo.FindPage(ctx, domainnote.ListFilter{Status: query.Status}, q)
	if err != nil {
		return nil, 0, err
	}
	items := make([]NoteSummaryDTO, 0, len(page.Items))
	for _, n := range page.Items {
		items = append(items, toSummaryDTO(n))
	}
	return items, page.Total, nil
}

// Publish 发布笔记；已发布时幂等 no-op。
func (s *Service) Publish(ctx context.Context, noteID string) (NoteDTO, error) {
	id, err := parseID(noteID)
	if err != nil {
		return NoteDTO{}, err
	}
	n, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return NoteDTO{}, err
	}
	n.Publish(time.Now().UTC())
	if err := s.repo.Save(ctx, n); err != nil {
		return NoteDTO{}, err
	}
	return toDTO(n), nil
}

// Delete 物理删除笔记（note_tags 级联）。
func (s *Service) Delete(ctx context.Context, noteID string) error {
	id, err := parseID(noteID)
	if err != nil {
		return err
	}
	return s.repo.Delete(ctx, id)
}

// BrowsePublished 按稳定复合游标读取公开笔记流，可按标签 slug 筛选。
func (s *Service) BrowsePublished(ctx context.Context, encodedCursor string, limit int, tagSlug string) ([]PublicNoteDTO, string, error) {
	cursor, err := decodePublishedCursor(encodedCursor)
	if err != nil {
		return nil, "", err
	}
	limit = normalizePublicLimit(limit)
	rows, err := s.repo.FindPublishedPage(ctx, cursor, domainnote.BrowseFilter{TagSlug: strings.TrimSpace(tagSlug)}, limit+1)
	if err != nil {
		return nil, "", err
	}
	hasMore := len(rows) > limit
	if hasMore {
		rows = rows[:limit]
	}
	items := make([]PublicNoteDTO, 0, len(rows))
	for _, row := range rows {
		items = append(items, toPublicDTO(row))
	}
	next := ""
	if hasMore && len(rows) > 0 {
		next = encodePublishedCursor(domainnote.PublishedCursor{
			PublishedAt: rows[len(rows)-1].PublishedAt, ID: rows[len(rows)-1].ID,
		})
	}
	return items, next, nil
}

// GetPublished 只读取已发布笔记；草稿与无效 ID 一律按不存在处理。
func (s *Service) GetPublished(ctx context.Context, noteID string) (PublicNoteDTO, error) {
	id, err := parseID(noteID)
	if err != nil {
		return PublicNoteDTO{}, err
	}
	row, err := s.repo.FindPublishedByID(ctx, id)
	if err != nil {
		return PublicNoteDTO{}, err
	}
	return toPublicDTO(row), nil
}

func normalizePublicLimit(limit int) int {
	if limit < 1 {
		return 20
	}
	if limit > 50 {
		return 50
	}
	return limit
}

func parseID(s string) (shared.ID, error) {
	id, err := shared.ParseID(strings.TrimSpace(s))
	if err != nil {
		return shared.ID{}, domainnote.ErrNotFound
	}
	return id, nil
}
