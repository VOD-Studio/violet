## 当前服务边界

站点已有的 `violet-reader` / `violet-posts` / `violet-comments` 等 MCP 服务处理博客内容与读者反馈；它们不提供 `@violet/ui` 的组件文档、源码或主题查询。当前没有可安装的「营造法式 MCP server」，不应将博客 MCP 地址作为组件工具接入。

## 博客 MCP 可以做什么

| Server | 能力 | 鉴权 |
| --- | --- | --- |
| `violet-reader` | 读取已发布文章与写作风格指南 | 匿名 |
| `violet-comments` | 检索已审核的读者评论与划线批注 | PAT（`comments:read`） |
| `violet-posts` | 当前用户名下文章的读写、发布、标签与检索 | PAT（`posts:read/write/publish`） |
| `violet-scraper` | 抓取外站文章、管理 RSS 订阅 | PAT（`posts:scrape` / `subscriptions:*`） |
| `violet-notes` | 会话知识笔记的写入与检索 | PAT（`notes:read/write/publish`） |

可以问什么：

- 「按博客既有风格写一篇文章」→ reader 的写作风格指南
- 「读者对哪篇文章反馈最密集？」→ comments 的 `comment_stats`
- 「我以前写过某个主题的文章吗？」→ posts 的 `search_posts`

接入方式为 HTTP MCP server，匿名读通道：

```json
{
	"mcpServers": {
		"violet-reader": {
			"type": "http",
			"url": "https://xunrua.top/api/v1/mcp/reader"
		}
	}
}
```

其余 server 在同一配置中追加，并经环境变量注入 PAT。完整 server 清单、PAT 生成与各工具说明以仓库的 `docs/guides/mcp-servers.md` 为准。

## 组件文档如何获取

智能体读取 [llms.txt](/llms.txt) 和仓库源码即可查到真实文档；技能入口见 [Agent Skills](/design-system/guides/skills)。
