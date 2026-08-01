// Package releases 提供更新日志（GitHub Releases）的应用用例。
//
// 代理 GitHub Releases API 拉取版本列表，解析 release body 的 emoji 行成分类标签，
// 结果用 Redis 缓存（~1h），失败回退缓存。owner/repo/token 从站点配置注入。
package releases

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"

	domainreleases "blog-api/internal/domain/releases"
	domainsettings "blog-api/internal/domain/settings"
)

// emojiLabel release-please 标题行 emoji → 中文标签映射
// 对齐 conventional-commits 全类型（release-please action v4 输出）
var emojiLabel = map[string][2]string{
	"🎉": {"🎉", "开始"},
	"✨": {"✨", "新增"},
	"🐛": {"🐛", "修复"},
	"📚": {"📚", "文档"},
	"📝": {"📝", "文档"},
	"💄": {"💄", "样式"},
	"🎨": {"🎨", "样式"},
	"♻️": {"♻️", "重构"},
	"🚀": {"🚀", "性能"},
	"⚡️": {"⚡️", "优化"},
	"🔧": {"🔧", "配置"},
	"👷": {"👷", "CI"},
	"🔨": {"🔨", "构建"},
	"🔒️": {"🔒️", "安全"},
	"🚨": {"🚨", "破坏性变更"},
	"💥": {"💥", "破坏性变更"},
	"⏪️": {"⏪️", "回退"},
	"🗑️": {"🗑️", "移除"},
	"🧪": {"🧪", "测试"},
	"📦️": {"📦️", "依赖"},
}

// breakingEmojis 标记为 breaking change 的 emoji
var breakingEmojis = map[string]bool{"🚨": true, "💥": true}

// cacheKey Redis 缓存键，cacheTTL 缓存有效期
const (
	cacheKey = "releases:cache"
	cacheTTL = 1 * time.Hour
)

// Service 更新日志用例服务
type Service struct {
	provider       domainreleases.Provider
	settings       domainsettings.SettingsStore
	rdb            *redis.Client
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
		s.cacheAsync(ctx, data)
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

// parseBody 解析 release-please 标准格式的 release body 成分类条目，并检测 breaking
//
// release-please 生成的格式（conventional-commits）形如：
//   ### 🐛 修复
//
//   * **media:** 补注册 admin 组批量删除路由修复 405 ([#3](...)) ([f5eff6f](...))
//
//   ### 📝 文档
//
//   * **changelog:** 重写 v2.0.0 段落 ([f378a4d](...))
//
// 解析逻辑：`### <emoji> <label>` 标题行开启一个分类，其后的 `* <item>` 行归入该分类。
// emoji 不在已知映射时用原标题 label 兜底。breaking emoji 触发 breaking 标记。
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

		// 标题行：### <emoji> <label>
		if strings.HasPrefix(line, "###") {
			rest := strings.TrimSpace(strings.TrimPrefix(line, "###"))
			matchedEmoji := ""
			for emoji := range emojiLabel {
				if strings.HasPrefix(rest, emoji) {
					matchedEmoji = emoji
					break
				}
			}
			if matchedEmoji == "" {
				continue
			}
			if breakingEmojis[matchedEmoji] {
				breaking = true
			}
			if cat, ok := idx[matchedEmoji]; ok {
				current = cat
			} else {
				pair := emojiLabel[matchedEmoji]
				current = &domainreleases.Category{Emoji: pair[0], Label: pair[1]}
				idx[matchedEmoji] = current
				order = append(order, matchedEmoji)
			}
			continue
		}

		// 条目行：* <text> 或 - <text>
		if current != nil && (strings.HasPrefix(line, "*") || strings.HasPrefix(line, "-")) {
			item := strings.TrimSpace(strings.TrimLeft(line, "*-"))
			if item == "" {
				continue
			}
			current.Items = append(current.Items, item)
		}
	}

	cats := make([]domainreleases.Category, 0, len(order))
	for _, emoji := range order {
		cat := *idx[emoji]
		if cat.Items == nil {
			cat.Items = []string{}
		}
		cats = append(cats, cat)
	}
	return cats, breaking
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

// cacheAsync 异步写缓存（不阻塞主流程，失败静默）
func (s *Service) cacheAsync(ctx context.Context, data *domainreleases.ReleasesData) {
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
