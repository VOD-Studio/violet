// Package mcp 提供 MCP（Model Context Protocol）服务器应用层：
// 注册文章读写 tool，PAT scope 门禁，并把参数委托给现有 application/post 服务。
//
// 鉴权身份由 SDK 的 auth.RequireBearerToken 中间件注入 req.Extra.TokenInfo
// （UserID + Scopes）。tool handler 据此做 scope 门禁，并适配 ctx 形态供
// post.Service 的所有权判定（middleware.UserIDKey）复用——不复制写逻辑。
package mcp

import (
	"context"
	"fmt"

	"github.com/modelcontextprotocol/go-sdk/auth"
	"github.com/modelcontextprotocol/go-sdk/mcp"

	domainapitoken "blog-api/internal/domain/api_token"
	apppost "blog-api/internal/application/post"
	appsub "blog-api/internal/application/subscription"
	"blog-api/internal/middleware"
)

// PostService MCP tool 依赖的文章服务端口。
//
// 仅声明 MCP 用到的方法；application/post.Service 实现之。
// 抽成接口便于单元测试用 fake 替换（seam #2）。
type PostService interface {
	Create(ctx context.Context, in apppost.CreateInput) (apppost.PostDTO, error)
	Update(ctx context.Context, in apppost.UpdateInput, operatorID string) error
	UpdateStatus(ctx context.Context, id, status string) (apppost.PostDTO, error)
	GetByID(ctx context.Context, id string) (apppost.PostDTO, error)
	GetBySlugForAuthor(ctx context.Context, slug string) (apppost.PostDTO, error)
	ListAll(ctx context.Context, page, limit int, status string) ([]apppost.PostListItemDTO, int64, error)
	ImportURL(ctx context.Context, rawURL string, opts apppost.ImportURLOpts) (apppost.ImportResult, error)
}

// SubscriptionService MCP tool 依赖的订阅服务端口。
// application/subscription.Service 实现之；抽接口便于单测 fake 替换。
type SubscriptionService interface {
	Create(ctx context.Context, in appsub.CreateInput) (appsub.SubscriptionDTO, error)
	GetByID(ctx context.Context, id, userID string) (appsub.SubscriptionDTO, error)
	ListByUser(ctx context.Context, userID, status string, page, limit int) ([]appsub.SubscriptionDTO, int64, error)
	Update(ctx context.Context, in appsub.UpdateInput) error
	Pause(ctx context.Context, id, userID string) error
	Resume(ctx context.Context, id, userID string) error
	Delete(ctx context.Context, id, userID string) error
}

// RobotsChecker robots.txt 预检端口。
// 抽成接口便于注入假实现（避免单测真实网络拉取 robots.txt）。
type RobotsChecker interface {
	// Allowed 返回给定 URL 是否被目标站点 robots.txt 允许抓取。
	// 第二返回值是拒绝原因（用于 warnings / 错误信息）。
	Allowed(ctx context.Context, target string) (bool, string, error)
}

// PostTools 文章 CRUD tool 集合，挂在文章 MCP server（/api/v1/mcp）上。
// 低风险域：只写自己的草稿/发布自己的文章，无 SSRF。
type PostTools struct {
	posts PostService
}

// NewPostTools 构造文章 tool 集合。
func NewPostTools(posts PostService) *PostTools {
	return &PostTools{posts: posts}
}

// ScraperTools 抓取 tool 集合，挂在抓取 MCP server（/api/v1/mcp/scraper）上。
// 高风险域：scrape_url 任意 URL 抓取（SSRF）+ 订阅抓取外部 feed。
// posts 仍需复用（scrape_url 调 ImportURL；订阅 FetchOne 经 SubscriptionService 间接调）。
type ScraperTools struct {
	posts  PostService
	robots RobotsChecker
	subs   SubscriptionService
}

// NewScraperTools 构造抓取 tool 集合。
// robots 传 nil 时禁用 robots.txt 预检（仅测试用）。
// subs 传 nil 时订阅 tool 不可用（仅未接入订阅模块的过渡期/测试用）。
func NewScraperTools(posts PostService, robots RobotsChecker, subs SubscriptionService) *ScraperTools {
	return &ScraperTools{posts: posts, robots: robots, subs: subs}
}

// requireScope 校验 PAT 是否拥有指定 scope；缺失返回 error（调用方包成 tool error 结果）。
func requireScope(req *mcp.CallToolRequest, scope string) error {
	ti := tokenInfo(req)
	if ti == nil {
		return fmt.Errorf("未认证：缺少访问令牌")
	}
	for _, s := range ti.Scopes {
		if s == scope {
			return nil
		}
	}
	return fmt.Errorf("权限不足：需要 %s scope", scope)
}

// requireScopeIf 校验 PAT 是否拥有指定 scope，仅当 cond 为真时检查。
// 用于订阅 auto_publish=true 时强制 posts:publish scope（PRD-0005 安全语义）：
// 持 subscriptions:write 但无 posts:publish 的 PAT 不能配自动发布，避免 scope 分离被绕过。
func requireScopeIf(req *mcp.CallToolRequest, cond bool, scope string) error {
	if !cond {
		return nil
	}
	return requireScope(req, scope)
}

// operatorUserID 取 PAT 持有人 user_id；未认证返回空串。
func operatorUserID(req *mcp.CallToolRequest) string {
	if ti := tokenInfo(req); ti != nil {
		return ti.UserID
	}
	return ""
}

func tokenInfo(req *mcp.CallToolRequest) *auth.TokenInfo {
	if req == nil || req.Extra == nil {
		return nil
	}
	return req.Extra.TokenInfo
}

// ctxWithOperator 把 PAT 持有人身份适配进 post.Service 读取的 ctx 形态。
//
// post.Service.canModify 仅凭「操作者 == 文章作者」即可放行（所有权），
// 故只注入 middleware.UserIDKey——agent 等同 PAT 持有人，仅能动其自己的文章。
// 不设 isRoot：不让 PAT 越权改他人文章。
func ctxWithOperator(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, middleware.UserIDKey, userID)
}

// --- tool 参数结构（jsonschema 由结构体 tag 推导） ---
//
// jsonschema-go 约定：tag 裸字符串 = 字段描述；必填由「非指针 + 无 omitempty」推导，
// 故可选字段须在 json tag 加 omitempty。

type createPostArgs struct {
	Title        string   `json:"title" jsonschema:"文章标题"`
	Slug         string   `json:"slug" jsonschema:"URL slug（小写字母数字连字符）"`
	ContentHTML  string   `json:"content_html,omitempty" jsonschema:"正文 HTML（violet 编辑器 schema 格式，渲染/编辑权威源，优先于 content_md；抓取场景应从 scrape_url 的 content_html 透传）"`
	ContentMD    string   `json:"content_md,omitempty" jsonschema:"Markdown 原文（仅当无 content_html 时作为兜底，后端会自动转 HTML）"`
	Excerpt      string   `json:"excerpt,omitempty" jsonschema:"摘要"`
	CoverImage   string   `json:"cover_image,omitempty" jsonschema:"封面图 URL"`
	CanonicalURL *string  `json:"canonical_url,omitempty" jsonschema:"转载源 URL；不传=原创，传值=转载（指向源文章）"`
	Tags         []string `json:"tags,omitempty" jsonschema:"标签列表"`
}

type updatePostArgs struct {
	ID           string   `json:"id" jsonschema:"文章 ID"`
	Title        string   `json:"title,omitempty" jsonschema:"文章标题"`
	Slug         string   `json:"slug,omitempty" jsonschema:"URL slug"`
	ContentHTML  string   `json:"content_html,omitempty" jsonschema:"正文 HTML（violet 编辑器 schema 格式，渲染/编辑权威源，优先于 content_md）"`
	ContentMD    string   `json:"content_md,omitempty" jsonschema:"Markdown 原文（仅当无 content_html 时作为兜底，后端会自动转 HTML）"`
	Excerpt      string   `json:"excerpt,omitempty" jsonschema:"摘要"`
	CoverImage   string   `json:"cover_image,omitempty" jsonschema:"封面图 URL"`
	CanonicalURL *string  `json:"canonical_url,omitempty" jsonschema:"转载源 URL。全量覆盖语义（同其它字段）：传值=转载，传 null/省略=清空回原创。若文章已是转载且本次不改，须显式传原值"`
	Tags         []string `json:"tags,omitempty" jsonschema:"标签列表"`
}

type publishPostArgs struct {
	ID string `json:"id" jsonschema:"待发布文章 ID"`
}

type getPostArgs struct {
	ID string `json:"id" jsonschema:"文章 ID"`
}

type listDraftsArgs struct {
	Page  int `json:"page,omitempty" jsonschema:"页码（从 1 开始，默认 1）"`
	Limit int `json:"limit,omitempty" jsonschema:"每页条数（默认 20，上限 100）"`
}

type scrapeURLArgs struct {
	URL string `json:"url" jsonschema:"待抓取的外站文章 URL（仅 http/https）"`
}

// --- 订阅 tool 参数结构（T6） ---

type createSubscriptionArgs struct {
	FeedURL           string   `json:"feed_url" jsonschema:"RSS feed URL（仅 http/https）"`
	Title             string   `json:"title,omitempty" jsonschema:"订阅源标题（缺省时由 feed 解析填充）"`
	Interval          string   `json:"interval,omitempty" jsonschema:"抓取频率：hourly/every-6h/daily/weekly（默认 daily）"`
	AutoPublish       bool     `json:"auto_publish,omitempty" jsonschema:"抓来是否自动发布（默认 false 建草稿）"`
	CanonicalOverride string   `json:"canonical_override,omitempty" jsonschema:"覆盖 entry.link 作为 canonical；空=用 entry.link"`
	Tags              []string `json:"tags,omitempty" jsonschema:"订阅级默认标签，抓来的文章自动打上"`
}

type listSubscriptionsArgs struct {
	Status string `json:"status,omitempty" jsonschema:"按状态过滤：active/paused（留空表示不过滤）"`
	Page   int    `json:"page,omitempty" jsonschema:"页码（从 1 开始，默认 1）"`
	Limit  int    `json:"limit,omitempty" jsonschema:"每页条数（默认 20，上限 100）"`
}

type getSubscriptionArgs struct {
	ID string `json:"id" jsonschema:"订阅 ID"`
}

type updateSubscriptionArgs struct {
	ID                string   `json:"id" jsonschema:"订阅 ID"`
	Title             string   `json:"title,omitempty" jsonschema:"订阅源标题"`
	Interval          string   `json:"interval,omitempty" jsonschema:"抓取频率：hourly/every-6h/daily/weekly"`
	AutoPublish       bool     `json:"auto_publish,omitempty" jsonschema:"抓来是否自动发布（全量覆盖语义：省略即为 false）。若订阅已是自动发布且本次不改，须显式传 true（另需 posts:publish scope）"`
	CanonicalOverride string   `json:"canonical_override,omitempty" jsonschema:"覆盖 entry.link 作为 canonical"`
	Tags              []string `json:"tags,omitempty" jsonschema:"订阅级默认标签"`
}

type subscriptionIDArgs struct {
	ID string `json:"id" jsonschema:"订阅 ID"`
}

// 编译期断言：作用域常量与 domain 对齐（防拼写漂移）
var (
	_ = domainapitoken.ScopePostsRead
	_ = domainapitoken.ScopePostsWrite
	_ = domainapitoken.ScopePostsPublish
	_ = domainapitoken.ScopePostsScrape
	_ = domainapitoken.ScopeSubscriptionsRead
	_ = domainapitoken.ScopeSubscriptionsWrite
)
