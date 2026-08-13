// Package routing 负责注册全部业务 HTTP 路由（chi）。
//
// 路由按 chi 官方模式组织（见 chi/_examples/rest）：
//   - 公开路由在 RegisterRoutes 内按资源域 r.Route 注册；
//   - 管理后台用独立 sub-router（NewAdminRouter），经 v1.Mount("/admin", ...) 挂载；
//   - MCP 端点在顶层独立挂载，绕过 v1 组的 CSRF/SessionAuth。
//
// 本包只依赖 interfaces/http/handler/*、middleware、config、openapi，
// 不依赖 internal/app（装配层），以打破循环依赖：
// 调用方（main.go）负责从各 container 拆出 handler 指针填入 Deps。
package routing

import (
	"net/http"

	"github.com/redis/go-redis/v9"

	"blog-api/config"
	apitokenhttp "blog-api/internal/interfaces/http/handler/api_token"
	audithttp "blog-api/internal/interfaces/http/handler/audit"
	authhttp "blog-api/internal/interfaces/http/handler/auth"
	codehttp "blog-api/internal/interfaces/http/handler/coderunner"
	commenthttp "blog-api/internal/interfaces/http/handler/comment"
	crhttp "blog-api/internal/interfaces/http/handler/commentreaction"
	contenthttp "blog-api/internal/interfaces/http/handler/content"
	friendlinkhttp "blog-api/internal/interfaces/http/handler/friendlink"
	githubhttp "blog-api/internal/interfaces/http/handler/github"
	imagehttp "blog-api/internal/interfaces/http/handler/image"
	mediahttp "blog-api/internal/interfaces/http/handler/media"
	posthttp "blog-api/internal/interfaces/http/handler/post"
	releaseshttp "blog-api/internal/interfaces/http/handler/releases"
	rolehttp "blog-api/internal/interfaces/http/handler/role"
	settingshttp "blog-api/internal/interfaces/http/handler/settings"
	statshttp "blog-api/internal/interfaces/http/handler/stats"
	subscriptionhttp "blog-api/internal/interfaces/http/handler/subscription"
	systemhttp "blog-api/internal/interfaces/http/handler/system"
	taghttp "blog-api/internal/interfaces/http/handler/tag"
	notificationhttp "blog-api/internal/interfaces/http/handler/notification"
	tweethttp "blog-api/internal/interfaces/http/handler/tweet"
	useradminhttp "blog-api/internal/interfaces/http/handler/useradmin"
	"blog-api/internal/middleware"
)

// MCPHandlers 聚合 4 个 MCP JSON-RPC 端点 handler（顶层挂载，PAT 鉴权在内层完成）。
type MCPHandlers struct {
	Post     http.Handler // /api/v1/mcp（文章 CRUD + 检索）
	Scraper  http.Handler // /api/v1/mcp/scraper（抓取 + 订阅）
	Public   http.Handler // /api/v1/mcp/reader（匿名只读）
	Comments http.Handler // /api/v1/mcp/comments（评论检索）
}

// Deps 聚合路由注册所需的全部依赖：配置、基础设施中间件依赖与各模块 handler。
//
// 与旧 app.Deps 不同，本结构持有各 *handler 指针（而非 app 包的 *Container），
// 由 main.go 从各 container 拆出 handler 填入，使 routing 不依赖 internal/app。
type Deps struct {
	Cfg               *config.Config
	Redis             *redis.Client
	PermissionChecker middleware.PermissionChecker

	// 预构造的 session 中间件（在 main.go 一次性构造，省去各注册函数重复传
	// sessionLookup/cfg.Cookie/IdleTTL 三参）。
	SessionAuth           func(http.Handler) http.Handler
	OptionalAuth          func(http.Handler) http.Handler
	SessionAuthReadOnlyMW func(http.Handler) http.Handler

	Role            *rolehttp.Handler
	Settings        *settingshttp.Handler
	Stats           *statshttp.Handler
	GitHub          *githubhttp.Handler
	Releases        *releaseshttp.Handler
	Auth            *authhttp.Handler
	Content         *contenthttp.Handler
	Comment         *commenthttp.Handler
	CommentReaction *crhttp.Handler
	Media           *mediahttp.Handler
	Post            *posthttp.Handler
	Tag             *taghttp.Handler
	Audit           *audithttp.Handler
	UserAdmin       *useradminhttp.Handler
	APIToken        *apitokenhttp.Handler
	Subscription    *subscriptionhttp.Handler
	CodeRunner      *codehttp.Handler
	System          *systemhttp.Handler
	Image           *imagehttp.Handler
	Tweet           *tweethttp.Handler
	FriendLink      *friendlinkhttp.Handler
	Notification    *notificationhttp.Handler

	MCP MCPHandlers
}
