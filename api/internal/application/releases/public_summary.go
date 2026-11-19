package releases

import (
	"context"
	"encoding/json"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"golang.org/x/sync/singleflight"

	domainreleases "blog-api/internal/domain/releases"
)

const (
	publicSummaryCachePrefix = "releases:public-summary:v1:"
	publicSummaryTTL         = time.Hour
	publicSummaryNegativeTTL = 2 * time.Minute
	publicSummaryBudget      = 900 * time.Millisecond
	publicSummaryFetchBudget = 8 * time.Second
	publicSummaryCacheBudget = 100 * time.Millisecond
	publicSummaryParallelism = 4
)

var (
	githubOwnerPattern = regexp.MustCompile(`^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$`)
	githubRepoPattern  = regexp.MustCompile(`^[a-zA-Z0-9._-]{1,100}$`)
)

// PublicSummaryReader 为公开项目列表补充可用的正式发布摘要。
// 它不读取站点设置，也不影响更新日志。
type PublicSummaryReader struct {
	provider domainreleases.PublicSummaryProvider
	rdb      *redis.Client
	group    singleflight.Group
	slots    chan struct{}
}

func NewPublicSummaryReader(provider domainreleases.PublicSummaryProvider, rdb *redis.Client) *PublicSummaryReader {
	return &PublicSummaryReader{provider: provider, rdb: rdb, slots: make(chan struct{}, publicSummaryParallelism)}
}

// ReadSummaries 按输入原 URL 返回摘要；不支持的 URL、无正式发布和不可用仓库都不返回。
func (r *PublicSummaryReader) ReadSummaries(ctx context.Context, githubURLs []string) map[string]domainreleases.PublicSummary {
	result := make(map[string]domainreleases.PublicSummary)
	if r.provider == nil || ctx.Err() != nil {
		return result
	}
	aliases := make(map[string][]string, len(githubURLs))
	for _, raw := range githubURLs {
		if repo := publicRepositoryKey(raw); repo != "" {
			aliases[repo] = append(aliases[repo], raw)
		}
	}
	if len(aliases) == 0 {
		return result
	}

	// 页面只等一个短预算；独立的共享读取可继续完成分页并给后续访问填充缓存。
	waitCtx, cancel := context.WithTimeout(ctx, publicSummaryBudget)
	defer cancel()
	type completed struct {
		repo    string
		summary domainreleases.PublicSummary
	}
	ready := make(chan completed, len(aliases))
	for repo := range aliases {
		flight := r.group.DoChan(repo, func() (any, error) {
			workCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), publicSummaryFetchBudget)
			defer cancel()
			return r.read(workCtx, repo), nil
		})
		go func() {
			select {
			case value := <-flight:
				ready <- completed{repo: repo, summary: value.Val.(domainreleases.PublicSummary)}
			case <-waitCtx.Done():
			}
		}()
	}
	store := func(item completed) {
		if item.summary.Count > 0 {
			for _, raw := range aliases[item.repo] {
				result[raw] = item.summary
			}
		}
	}
	for range aliases {
		select {
		case item := <-ready:
			store(item)
		case <-waitCtx.Done():
			for {
				select {
				case item := <-ready:
					store(item)
				default:
					return result
				}
			}
		}
	}
	return result
}

func (r *PublicSummaryReader) read(ctx context.Context, repo string) domainreleases.PublicSummary {
	key := publicSummaryCachePrefix + repo
	if r.rdb != nil {
		cacheCtx, cancel := context.WithTimeout(ctx, publicSummaryCacheBudget)
		raw, err := r.rdb.Get(cacheCtx, key).Bytes()
		cancel()
		var cached domainreleases.PublicSummary
		if err == nil && json.Unmarshal(raw, &cached) == nil {
			return cached
		}
	}
	select {
	case r.slots <- struct{}{}:
	case <-ctx.Done():
		return domainreleases.PublicSummary{}
	}
	owner, name, _ := strings.Cut(repo, "/")
	summary, err := r.provider.SummarizePublicReleases(ctx, owner, name)
	<-r.slots
	ttl := publicSummaryTTL
	if err != nil || summary.Count == 0 {
		summary = domainreleases.PublicSummary{}
		ttl = publicSummaryNegativeTTL
	}
	if r.rdb != nil {
		// 即使实际出网耗尽本批预算，也为失败短暂写入冷却缓存。
		cacheCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), publicSummaryCacheBudget)
		defer cancel()
		raw, _ := json.Marshal(summary)
		_ = r.rdb.Set(cacheCtx, key, raw, ttl).Err()
	}
	return summary
}

func publicRepositoryKey(raw string) string {
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.User != nil ||
		!strings.EqualFold(u.Host, "github.com") || u.RawPath != "" || strings.ContainsAny(raw, "?#") {
		return ""
	}
	owner, repo, ok := strings.Cut(strings.TrimSuffix(strings.TrimPrefix(u.Path, "/"), "/"), "/")
	if !ok || !githubOwnerPattern.MatchString(owner) || !githubRepoPattern.MatchString(repo) || repo == "." || repo == ".." {
		return ""
	}
	return strings.ToLower(owner + "/" + repo)
}
