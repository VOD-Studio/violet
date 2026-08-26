// Package series 提供系列书 application 层用例（PRD-0021）。
package series

import (
	"time"

	domain "blog-api/internal/domain/series"
)

// SeriesDTO 公开书架项（GET /series）。
type SeriesDTO struct {
	// ID 书 ID
	ID string `json:"id"`
	// Slug 书 slug
	Slug string `json:"slug"`
	// Title 书名
	Title string `json:"title"`
	// Description 简介
	Description string `json:"description"`
	// CoverImage 封面图 URL；空串=无封面（前端用无图书封规则）
	CoverImage string `json:"cover_image"`
	// ChapterCount 已发布章节数
	ChapterCount int64 `json:"chapter_count"`
	// LatestChapterAt 最近一章发布时间（RFC3339；空书为空串）
	LatestChapterAt string `json:"latest_chapter_at"`
	// CreatedAt 建书时间（RFC3339）
	CreatedAt string `json:"created_at"`
}

// SeriesAdminDTO 后台书列表项（GET /admin/series）。
type SeriesAdminDTO struct {
	SeriesDTO
	// Status draft / published
	Status string `json:"status"`
	// TotalChapterCount 全部章节数（含 draft/archived）
	TotalChapterCount int64 `json:"total_chapter_count"`
	// UpdatedAt 最近编辑时间（RFC3339）
	UpdatedAt string `json:"updated_at"`
}

// SectionDTO 卷/部。
type SectionDTO struct {
	// ID 卷 ID
	ID string `json:"id"`
	// Title 卷名
	Title string `json:"title"`
	// SortOrder 卷顺序
	SortOrder int `json:"sort_order"`
}

// ChapterDTO 目录章节项。
type ChapterDTO struct {
	// PostID 章节（文章）ID
	PostID string `json:"post_id"`
	// Slug 文章 slug（跳转用）
	Slug string `json:"slug"`
	// Title 章节标题
	Title string `json:"title"`
	// ChapterNo 全书展示序号（1 起；公开视角按可见章节连续编号）
	ChapterNo int `json:"chapter_no"`
	// Status 文章状态；仅管理视角返回，公开视角恒 published（省略）
	Status string `json:"status,omitempty"`
	// PublishedAt 发布时间（RFC3339；未发布章节为空串）
	PublishedAt string `json:"published_at"`
}

// SectionChaptersDTO 卷与其章节。
type SectionChaptersDTO struct {
	Section SectionDTO `json:"section"`
	// Chapters 卷内章节（chapter_order 升序）
	Chapters []ChapterDTO `json:"chapters"`
}

// SeriesDetailDTO 书籍详情（GET /series/{slug} 与 GET /admin/series/{id}）。
//
// 目录为两层：根章节在前，各卷按 sort_order 依次排列；ChapterNo 全书连续编号。
type SeriesDetailDTO struct {
	SeriesDTO
	// Sections 卷列表（sort_order 升序，含空卷——空卷是发布书中的占位结构，
	// 是否展示由前端决定）
	Sections []SectionChaptersDTO `json:"sections"`
	// RootChapters 书根章节（无卷）
	RootChapters []ChapterDTO `json:"root_chapters"`
}

// ChapterContextDTO 文章的书籍上下文（阅读器壳与文章页归属标注）。
type ChapterContextDTO struct {
	// Series 归属书
	Series SeriesRefDTO `json:"series"`
	// ChapterNo 当前章在可见序列中的序号（1 起）
	ChapterNo int `json:"chapter_no"`
	// TotalChapters 可见章节总数
	TotalChapters int `json:"total_chapters"`
	// Prev 上一章（同为可见章节）；首章为 nil
	Prev *ChapterNavDTO `json:"prev_chapter"`
	// Next 下一章（同为可见章节）；末章为 nil
	Next *ChapterNavDTO `json:"next_chapter"`
}

// SeriesRefDTO 归属书引用。
type SeriesRefDTO struct {
	// Slug 书 slug
	Slug string `json:"slug"`
	// Title 书名
	Title string `json:"title"`
}

// ChapterNavDTO 相邻章导航。
type ChapterNavDTO struct {
	// Slug 文章 slug
	Slug string `json:"slug"`
	// Title 章节标题
	Title string `json:"title"`
}

// toSeriesDTO 聚合 → 公开 DTO（章节计数与最近章节时间由 service 补齐）。
func toSeriesDTO(s *domain.Series) SeriesDTO {
	return SeriesDTO{
		ID:          s.ID().String(),
		Slug:        s.Slug(),
		Title:       s.Title(),
		Description: s.Description(),
		CoverImage:  s.CoverImage(),
		CreatedAt:   s.CreatedAt().UTC().Format(time.RFC3339),
	}
}

// toAdminDTO 聚合 → 后台 DTO。
func toAdminDTO(s *domain.Series) SeriesAdminDTO {
	return SeriesAdminDTO{
		SeriesDTO: toSeriesDTO(s),
		Status:    s.Status(),
		UpdatedAt: s.UpdatedAt().UTC().Format(time.RFC3339),
	}
}

// toSectionDTO 卷 → DTO。
func toSectionDTO(sec *domain.SeriesSection) SectionDTO {
	return SectionDTO{
		ID:        sec.ID().String(),
		Title:     sec.Title(),
		SortOrder: sec.SortOrder(),
	}
}

// buildDetailDTO 组装详情目录。
//
// publicView=true 过滤非 published 章节（编号按可见章节连续）；
// false 为管理视角（含全部状态章节并标注 status）。
// 先按聚合卷序建好全部卷桶再填章节，空卷保留在原位。
func buildDetailDTO(s *domain.Series, chapters []domain.Chapter, publicView bool) SeriesDetailDTO {
	dto := SeriesDetailDTO{
		SeriesDTO:    toSeriesDTO(s),
		RootChapters: make([]ChapterDTO, 0),
		Sections:     make([]SectionChaptersDTO, 0, len(s.Sections())),
	}
	for _, sec := range s.Sections() {
		dto.Sections = append(dto.Sections, SectionChaptersDTO{
			Section:  toSectionDTO(sec),
			Chapters: make([]ChapterDTO, 0),
		})
	}

	ordered := domain.OrderedChapters(s.Sections(), chapters)
	no := 0
	for _, ch := range ordered {
		if publicView && !ch.IsPublished() {
			continue
		}
		no++
		item := ChapterDTO{
			PostID:      ch.PostID.String(),
			Slug:        ch.Slug,
			Title:       ch.Title,
			ChapterNo:   no,
			PublishedAt: formatPublishedAt(ch.PublishedAt),
		}
		if !publicView {
			item.Status = ch.Status
		}
		if ch.SectionID == nil {
			dto.RootChapters = append(dto.RootChapters, item)
			continue
		}
		// 章节挂了不属于本书的卷（数据异常）：防御性跳过，不让目录崩坏
		if _, ok := s.SectionByID(*ch.SectionID); !ok {
			continue
		}
		for i := range dto.Sections {
			if dto.Sections[i].Section.ID == ch.SectionID.String() {
				dto.Sections[i].Chapters = append(dto.Sections[i].Chapters, item)
				break
			}
		}
	}
	return dto
}

// formatPublishedAt 时间 → RFC3339；零值为空串。
func formatPublishedAt(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.UTC().Format(time.RFC3339)
}

// fillChapterCounts 补齐书架项的章节计数与最近章节时间（仅计 published）。
func fillChapterCounts(dto *SeriesDTO, chapters []domain.Chapter) {
	dto.ChapterCount = 0
	var latest time.Time
	for _, ch := range chapters {
		if !ch.IsPublished() {
			continue
		}
		dto.ChapterCount++
		if ch.PublishedAt.After(latest) {
			latest = ch.PublishedAt
		}
	}
	dto.LatestChapterAt = formatPublishedAt(latest)
}
