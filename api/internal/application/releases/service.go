// Package releases 提供更新日志（GitHub Releases）的应用用例。
//
// 代理 GitHub Releases API 拉取版本列表，解析 release body 的 section 标题成分类，
// 结果用 Redis 缓存（~1h），失败回退缓存。owner/repo/token 从站点配置注入。
package releases

import (
	"context"
	"encoding/json"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"

	domainreleases "blog-api/internal/domain/releases"
	domainsettings "blog-api/internal/domain/settings"
)

// breakingKeywords 触发 breaking change 标记的标题/条目关键词
var breakingKeywords = map[string]bool{
	"breaking": true,
	"破坏":       true,
	"破坏性":      true,
	"不兼容":      true,
}

// 条目尾部的 commit hash 引用（7-40 位十六进制，与 PR/issue 的 (#36) 区分：后者带 # 且是十进制）。
// 三种形态：括号包链接 ([704a52a](url))、裸链接 [704a52a](url)、纯文本短 hash (704a52a)。
// 读者不关心短 hash；merge 合并时同一条目带两个不同 hash 还会破坏去重。
var (
	commitRefParenLinkRe = regexp.MustCompile(`\s*\(\[[0-9a-f]{7,40}\]\([^)]*\)\)`)
	commitRefLinkRe      = regexp.MustCompile(`\s*\[[0-9a-f]{7,40}\]\([^)]*\)`)
	commitRefTextRe      = regexp.MustCompile(`\s*\([0-9a-f]{7,40}\)`)
)

// cleanCommitRef 去掉条目中的 commit hash 引用。
func cleanCommitRef(item string) string {
	item = commitRefParenLinkRe.ReplaceAllString(item, "")
	item = commitRefLinkRe.ReplaceAllString(item, "")
	item = commitRefTextRe.ReplaceAllString(item, "")
	return strings.TrimSpace(item)
}

// cacheKey Redis 缓存键，cacheTTL 缓存有效期
const (
	cacheKey = "releases:cache"
	cacheTTL = 1 * time.Hour
)

// Service 更新日志用例服务
type Service struct {
	provider domainreleases.Provider
	settings domainsettings.SettingsStore
	rdb      *redis.Client
}

// NewService 构造更新日志服务
func NewService(provider domainreleases.Provider, settings domainsettings.SettingsStore, rdb *redis.Client) *Service {
	return &Service{provider: provider, settings: settings, rdb: rdb}
}

// Get 获取更新日志（带 Redis 缓存 + 失败降级）
//
// 流程：从配置读 owner/repo/token → 尝试调 GitHub API → 成功则解析+缓存 →
// 失败则回退读缓存（即使过期）→ 缓存也没有则返回空（不 500）。
// username/token 空时直接返回空（对齐 contributions 短路模式）。
func (s *Service) Get(ctx context.Context) (*domainreleases.ReleasesData, error) {
	m, err := s.settings.GetAll(ctx)
	if err != nil {
		return nil, err
	}
	token := m["github_token"]
	owner := m["github_username"]
	repo := m["releases_repo"]
	if repo == "" {
		return emptyData(), nil
	}
	// releases_repo 支持完整 owner/repo 格式（如 "VOD-Studio/violet"）：
	// 含 "/" 时拆分，直接用其中的 owner，不依赖 github_username（后者可能是个人号而非组织）。
	// 仅填仓库名（如 "violet"）时回退用 github_username 作 owner。
	if parts := strings.SplitN(repo, "/", 2); len(parts) == 2 && parts[0] != "" && parts[1] != "" {
		owner = parts[0]
		repo = parts[1]
	}

	// 尝试调 GitHub API
	rawReleases, err := s.provider.ListReleases(ctx, owner, repo, token)
	if err == nil && len(rawReleases) > 0 {
		// 成功：解析 body 成分类 + 组装 + 写缓存
		data := buildData(rawReleases)
		s.cacheAsync(data)
		return data, nil
	}

	// 失败或空：回退读缓存（即使过期）
	if cached, ok := s.readCache(ctx); ok {
		return cached, nil
	}
	return emptyData(), nil
}

// buildData 把原始 releases 解析成 ReleasesData（含分类标签 + 当前版本）
func buildData(raw []domainreleases.Release) *domainreleases.ReleasesData {
	releases := make([]domainreleases.Release, 0, len(raw))
	for _, r := range raw {
		r.Categories, r.Breaking = parseBody(r.Body)
		releases = append(releases, r)
	}
	current := ""
	if len(releases) > 0 {
		current = releases[0].TagName
	}
	return &domainreleases.ReleasesData{
		CurrentVersion: current,
		Releases:       releases,
	}
}

// parseBody 解析 GitHub 原生 release notes 成分类条目，并检测 breaking。
//
// GitHub 原生格式（changelog-type: github，读 .github/release.yml 分类）形如：
//
//	## What's Changed
//	* About 页重设计 by @xunrua in #7
//
//	### 新功能
//	* About 页重设计 by @xunrua in #7
//
//	### Bug 修复
//	* 修复评论分页 by @DefectingCat in #11
//
//	**Full Changelog**: https://github.com/.../compare/v2.0.4...v2.1.0
//
// 解析逻辑：
//   - `### <纯文字 title>` 开启分类（title 直接作 label）
//   - `* <item>` / `- <item>` 归入当前分类
//   - `## ` 级标题（What's Changed / New Contributors）跳过
//   - `**Full Changelog**` 尾行跳过
//   - label 或条目含 breaking/破坏/不兼容 关键词时标记 breaking
func parseBody(body string) ([]domainreleases.Category, bool) {
	if body == "" {
		return nil, false
	}
	idx := make(map[string]*domainreleases.Category)
	order := make([]string, 0)
	breaking := false
	var current *domainreleases.Category

	for _, line := range strings.Split(body, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// 跳过 Full Changelog 尾行
		if strings.HasPrefix(line, "**Full Changelog**") {
			continue
		}

		// 分类标题行：### <纯文字 title>
		if strings.HasPrefix(line, "### ") {
			label := strings.TrimSpace(strings.TrimPrefix(line, "### "))
			if label == "" {
				continue
			}
			if isBreaking(label) {
				breaking = true
			}
			if cat, ok := idx[label]; ok {
				current = cat
			} else {
				current = &domainreleases.Category{Label: label}
				idx[label] = current
				order = append(order, label)
			}
			continue
		}

		// ## 级标题（What's Changed / New Contributors）不开启分类，跳过
		if strings.HasPrefix(line, "## ") {
			current = nil
			continue
		}

		// 条目行：* <text> 或 - <text>
		if current != nil && (strings.HasPrefix(line, "*") || strings.HasPrefix(line, "-")) {
			item := strings.TrimSpace(strings.TrimLeft(line, "*-"))
			if item == "" {
				continue
			}
			if isBreaking(item) {
				breaking = true
			}
			// 先清理 commit hash 引用再去重：merge 合并 PR 时 release-please 会以
			// PR title 与原始 commit 各记一条，hash 不同但内容相同，不清理则去不掉。
			item = cleanCommitRef(item)
			if slices.Contains(current.Items, item) {
				continue
			}
			current.Items = append(current.Items, item)
		}
	}

	cats := make([]domainreleases.Category, 0, len(order))
	for _, label := range order {
		cat := *idx[label]
		if cat.Items == nil {
			cat.Items = []string{}
		}
		cats = append(cats, cat)
	}
	return cats, breaking
}

// isBreaking 判断文本是否含 breaking change 关键词（大小写不敏感）。
func isBreaking(text string) bool {
	lower := strings.ToLower(text)
	for kw := range breakingKeywords {
		if strings.Contains(lower, strings.ToLower(kw)) {
			return true
		}
	}
	return false
}

// readCache 读 Redis 缓存（命中返回数据 + true）
func (s *Service) readCache(ctx context.Context) (*domainreleases.ReleasesData, bool) {
	if s.rdb == nil {
		return nil, false
	}
	raw, err := s.rdb.Get(ctx, cacheKey).Bytes()
	if err != nil || len(raw) == 0 {
		return nil, false
	}
	var data domainreleases.ReleasesData
	if err := json.Unmarshal(raw, &data); err != nil {
		return nil, false
	}
	return &data, true
}

func (s *Service) cacheAsync(data *domainreleases.ReleasesData) {
	if s.rdb == nil {
		return
	}
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if raw, err := json.Marshal(data); err == nil {
			_ = s.rdb.Set(bgCtx, cacheKey, raw, cacheTTL).Err()
		}
	}()
}

func emptyData() *domainreleases.ReleasesData {
	return &domainreleases.ReleasesData{Releases: []domainreleases.Release{}}
}
