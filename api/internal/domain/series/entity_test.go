package series

import (
	"testing"

	"blog-api/internal/domain/shared"
)

func newAuthorID(t *testing.T) shared.ID {
	t.Helper()
	return shared.NewID()
}

func newTestSeries(t *testing.T) *Series {
	t.Helper()
	s, err := NewSeries(shared.NewID(), newAuthorID(t), "Java 渐进式笔记", "java-notes", "一本持续生长的书", "https://img.example.com/cover.jpg")
	if err != nil {
		t.Fatalf("NewSeries: %v", err)
	}
	return s
}

func TestNewSeriesValidation(t *testing.T) {
	author := newAuthorID(t)
	cases := []struct {
		name    string
		title   string
		slug    string
		author  shared.ID
		wantErr bool
	}{
		{"合法", "Java 笔记", "java-notes", author, false},
		{"书名空白", "   ", "java-notes", author, true},
		{"slug 大写", "Java 笔记", "Java-Notes", author, true},
		{"slug 下划线", "Java 笔记", "java_notes", author, true},
		{"slug 前导连字符", "Java 笔记", "-java", author, true},
		{"slug 连续连字符", "Java 笔记", "java--notes", author, true},
		{"slug 纯数字", "2026 手记", "2026", author, false},
		{"作者空", "Java 笔记", "java-notes", shared.ID{}, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := NewSeries(shared.NewID(), tc.author, tc.title, tc.slug, "", "")
			if (err != nil) != tc.wantErr {
				t.Fatalf("err = %v, wantErr = %v", err, tc.wantErr)
			}
		})
	}
}

func TestNewSeriesCoverURL(t *testing.T) {
	author := newAuthorID(t)
	if _, err := NewSeries(shared.NewID(), author, "T", "t", "", "javascript:alert(1)"); err == nil {
		t.Fatal("伪协议封面应被拒绝")
	}
	if _, err := NewSeries(shared.NewID(), author, "T", "t", "", "data:image/png;base64,xx"); err == nil {
		t.Fatal("data 伪协议封面应被拒绝")
	}
	if _, err := NewSeries(shared.NewID(), author, "T", "t", "", ""); err != nil {
		t.Fatalf("空封面应允许: %v", err)
	}
	if _, err := NewSeries(shared.NewID(), author, "T", "t", "", "/uploads/abc.png?crop=1:2"); err != nil {
		t.Fatalf("素材库相对路径应允许: %v", err)
	}
	if _, err := NewSeries(shared.NewID(), author, "T", "t", "", "https://img.example.com/c.jpg"); err != nil {
		t.Fatalf("http 外链应允许: %v", err)
	}
}

func TestStatusTransitions(t *testing.T) {
	s := newTestSeries(t)
	if s.IsPublished() {
		t.Fatal("新书应为 draft")
	}
	if err := s.Unpublish(); err == nil {
		t.Fatal("draft 收回应被拒绝")
	}
	if err := s.Publish(); err != nil {
		t.Fatalf("Publish: %v", err)
	}
	if err := s.Publish(); err == nil {
		t.Fatal("重复发布应被拒绝")
	}
	if err := s.Unpublish(); err != nil {
		t.Fatalf("Unpublish: %v", err)
	}
	if !s.HasEvents() {
		t.Fatal("状态转换应记录事件")
	}
}

func TestAuthorAndSlugImmutable(t *testing.T) {
	s := newTestSeries(t)
	// 聚合无 authorID/slug 的任何修改入口：编译期保证。
	// Update 只接受 Title/Description/CoverImage。
	if err := s.Update(UpdateParams{Title: "新标题", Description: s.Description(), CoverImage: s.CoverImage()}); err != nil {
		t.Fatalf("Update: %v", err)
	}
	if s.Title() != "新标题" || s.Slug() != "java-notes" {
		t.Fatalf("slug 不应随 Update 改变: %s", s.Slug())
	}
}

func TestUpdateDiff(t *testing.T) {
	s := newTestSeries(t)
	s.PullEvents() // 清掉 created 事件
	if err := s.Update(UpdateParams{Title: s.Title(), Description: s.Description(), CoverImage: s.CoverImage()}); err != nil {
		t.Fatalf("Update: %v", err)
	}
	if s.HasEvents() {
		t.Fatal("同值更新不应产生事件")
	}
	if err := s.Update(UpdateParams{Title: s.Title(), Description: "新简介", CoverImage: s.CoverImage()}); err != nil {
		t.Fatalf("Update: %v", err)
	}
	events := s.PullEvents()
	if len(events) != 1 || events[0].EventName() != "series.updated" {
		t.Fatalf("应恰好记录一个 series.updated 事件，得到 %d", len(events))
	}
}

func TestSectionLifecycle(t *testing.T) {
	s := newTestSeries(t)
	id1, id2, id3 := shared.NewID(), shared.NewID(), shared.NewID()
	if err := s.AddSection(id1, "第一部"); err != nil {
		t.Fatalf("AddSection: %v", err)
	}
	if err := s.AddSection(id2, "第二部"); err != nil {
		t.Fatalf("AddSection: %v", err)
	}
	if err := s.AddSection(id1, "重复卷"); err == nil {
		t.Fatal("重复卷 ID 应被拒绝")
	}
	if err := s.AddSection(shared.NewID(), "  "); err == nil {
		t.Fatal("空卷名应被拒绝")
	}
	secs := s.Sections()
	if secs[0].SortOrder() != 0 || secs[1].SortOrder() != 1 {
		t.Fatalf("sortOrder 应依次分配: %d %d", secs[0].SortOrder(), secs[1].SortOrder())
	}

	// 调序：交换两部
	if err := s.ReorderSections([]shared.ID{id2, id1}); err != nil {
		t.Fatalf("ReorderSections: %v", err)
	}
	secs = s.Sections()
	if secs[0].ID() != id2 || secs[0].SortOrder() != 0 {
		t.Fatal("调序后 id2 应排第一")
	}

	// 调序校验：多/少/重复/外来 ID
	if err := s.ReorderSections([]shared.ID{id1}); err == nil {
		t.Fatal("缺一卷应被拒绝")
	}
	if err := s.ReorderSections([]shared.ID{id1, id2, id3}); err == nil {
		t.Fatal("外来卷应被拒绝")
	}
	if err := s.ReorderSections([]shared.ID{id1, id1}); err == nil {
		t.Fatal("重复卷应被拒绝")
	}

	// 删除
	if err := s.RemoveSection(id1); err != nil {
		t.Fatalf("RemoveSection: %v", err)
	}
	if s.HasSection(id1) {
		t.Fatal("删除后 HasSection 应为 false")
	}
	if err := s.RemoveSection(id1); err == nil {
		t.Fatal("删除不存在的卷应返回 ErrSectionNotFound")
	}
}

func TestOrderedChapters(t *testing.T) {
	secA, secB := shared.NewID(), shared.NewID()
	sections := []*SeriesSection{
		ReconstructSection(secA, "第一部", 0),
		ReconstructSection(secB, "第二部", 1),
	}
	p1, p2, p3, p4, p5 := shared.NewID(), shared.NewID(), shared.NewID(), shared.NewID(), shared.NewID()
	chapters := []Chapter{
		{PostID: p3, Slug: "c3", Title: "卷A第2章", SectionID: &secA, ChapterOrder: 1},
		{PostID: p5, Slug: "c5", Title: "卷B第1章", SectionID: &secB, ChapterOrder: 0},
		{PostID: p1, Slug: "c1", Title: "前言", SectionID: nil, ChapterOrder: 0},
		{PostID: p4, Slug: "c4", Title: "卷B第2章", SectionID: &secB, ChapterOrder: 1},
		{PostID: p2, Slug: "c2", Title: "卷A第1章", SectionID: &secA, ChapterOrder: 0},
	}
	got := OrderedChapters(sections, chapters)
	wantOrder := []shared.ID{p1, p2, p3, p5, p4}
	if len(got) != len(wantOrder) {
		t.Fatalf("目录长度 %d != %d", len(got), len(wantOrder))
	}
	for i, want := range wantOrder {
		if got[i].PostID != want {
			t.Fatalf("目录第 %d 位应为 %s，得到 %s（%s）", i+1, want, got[i].PostID, got[i].Title)
		}
	}
}
