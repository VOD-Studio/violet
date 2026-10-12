// Package brand 集中定义品牌标识常量。
//
// 品牌更名只需修改本文件。User-Agent、MCP server 名等对外标识
// 禁止在各层写字面量，统一引用这里——尤其 ImporterProduct 同时被
// 抓取请求 UA 与 robots.txt 判定使用，字面量分散会导致两者漂移。
package brand

const (
	// Name 品牌名（小写），通用标识。
	Name = "violet"

	// GitHubOAuthUA GitHub OAuth API 请求的 User-Agent。
	GitHubOAuthUA = "Violet"

	// ImporterProduct 文章导入抓取的 robots.txt product token。
	// 抓取请求 UA（ImporterUA）与 robots.txt 判定必须共用此值。
	ImporterProduct = "violet-importer"
	// ImporterUA 文章导入抓取请求的完整 User-Agent。
	ImporterUA = "Mozilla/5.0 (compatible; " + ImporterProduct + "/1.0)"

	// FeedFetcherProduct 订阅 feed 拉取的 robots.txt product token。
	FeedFetcherProduct = "violet-feed-fetcher"
	// FeedFetcherUA 订阅 feed 拉取请求的完整 User-Agent。
	FeedFetcherUA = "Mozilla/5.0 (compatible; " + FeedFetcherProduct + "/1.0)"

	// MCPServerName 文章域 MCP server 标识（前端管理页 key 与之对应）。
	// 按域命名（AWS DDD MCP 实践：server 名描述所拥有的域，非品牌名）。
	MCPServerName = "violet-posts"
	// MCPScraperServerName 抓取 MCP server 标识。
	MCPScraperServerName = "violet-scraper"
	// MCPReaderServerName 公开只读 MCP server 标识（匿名，仅已发布文章）。
	MCPReaderServerName = "violet-reader"
	// MCPCommentsServerName 评论检索 MCP server 标识（PAT，评论独立 bounded context）。
	MCPCommentsServerName = "violet-comments"
	// MCPNotesServerName 笔记域 MCP server 标识（PAT，AI 会话沉淀运输层）。
	MCPNotesServerName = "violet-notes"
)
