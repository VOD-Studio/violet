package releases

import (
	"testing"

	domainreleases "blog-api/internal/domain/releases"
)

func TestParseBody_GitHubNativeFormat(t *testing.T) {
	body := `## What's Changed
* About 页重设计 by @xunrua in #7

### 新功能
* About 页重设计 + 更新日志 by @xunrua in #7

### Bug 修复
* 修复评论分页越界 by @DefectingCat in #11

**Full Changelog**: https://github.com/VOD-Studio/violet/compare/v2.0.4...v2.1.0`

	cats, breaking := parseBody(body)

	if breaking {
		t.Error("不应标记 breaking")
	}
	if len(cats) != 2 {
		t.Fatalf("期望 2 个分类，得到 %d: %+v", len(cats), cats)
	}
	assertCategory(t, cats[0], "新功能", []string{"About 页重设计 + 更新日志 by @xunrua in #7"})
	assertCategory(t, cats[1], "Bug 修复", []string{"修复评论分页越界 by @DefectingCat in #11"})
}

func TestParseBody_BreakingDetection(t *testing.T) {
	tests := []struct {
		name     string
		body     string
		breaking bool
	}{
		{
			name: "label 含破坏性",
			body: "### 破坏性变更\n* 移除旧 API",
			breaking: true,
		},
		{
			name: "条目含 Breaking",
			body: "### Changed\n* **Breaking:** bump yaml-parser from 4.x to 5.x",
			breaking: true,
		},
		{
			name: "label 含不兼容",
			body: "### 不兼容变更\n* 重构数据库 schema",
			breaking: true,
		},
		{
			name: "无 breaking",
			body: "### 新功能\n* 新增搜索功能",
			breaking: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, breaking := parseBody(tt.body)
			if breaking != tt.breaking {
				t.Errorf("breaking = %v, want %v", breaking, tt.breaking)
			}
		})
	}
}

func TestParseBody_SkipsNonCategorySections(t *testing.T) {
	body := `## What's Changed
* 总览条目 by @user in #1

## New Contributors
* @newuser made their first contribution in #2

### 新功能
* 实际功能条目

**Full Changelog**: https://example.com/compare/v1...v2`

	cats, _ := parseBody(body)

	// What's Changed 和 New Contributors 下的条目不应被归入分类
	if len(cats) != 1 {
		t.Fatalf("期望 1 个分类（跳过 ## 级），得到 %d", len(cats))
	}
	assertCategory(t, cats[0], "新功能", []string{"实际功能条目"})
}

func TestParseBody_EmptyBody(t *testing.T) {
	cats, breaking := parseBody("")
	if cats != nil {
		t.Errorf("空 body 应返回 nil categories，得到 %+v", cats)
	}
	if breaking {
		t.Error("空 body 不应标记 breaking")
	}
}

func TestParseBody_EmptyCategoryHasEmptyItems(t *testing.T) {
	// 有标题但无条目的分类，Items 应为 []string{} 而非 nil
	body := "### 新功能\n"
	cats, _ := parseBody(body)
	if len(cats) != 1 {
		t.Fatalf("期望 1 个分类，得到 %d", len(cats))
	}
	if cats[0].Items == nil {
		t.Error("无条目分类的 Items 应为 []string{} 非 nil")
	}
	if len(cats[0].Items) != 0 {
		t.Errorf("期望 0 个条目，得到 %d", len(cats[0].Items))
	}
}

func assertCategory(t *testing.T, cat domainreleases.Category, label string, items []string) {
	t.Helper()
	if cat.Label != label {
		t.Errorf("label = %q, want %q", cat.Label, label)
	}
	if len(cat.Items) != len(items) {
		t.Errorf("items 数量 = %d, want %d (%+v)", len(cat.Items), len(items), cat.Items)
		return
	}
	for i, want := range items {
		if cat.Items[i] != want {
			t.Errorf("items[%d] = %q, want %q", i, cat.Items[i], want)
		}
	}
}
