package mcp

import (
	"context"
	"fmt"

	"github.com/modelcontextprotocol/go-sdk/auth"
	"github.com/modelcontextprotocol/go-sdk/mcp"

	domainapitoken "blog-api/internal/domain/api_token"
)

// writingStyleGuide 是本博客品牌写作风格指南（硬编码常量）。
// 风格规则相对稳定，变更频率低；改规则即改代码+发版。
// 将来站长真有"自定义风格"需求（S4 域）再升级为可配置。
//
// 注入博客特有上下文（agent 不知道的规则）：公式/代码块/转载/标题摘要约定。
const writingStyleGuide = `# Violet 博客写作风格指南

写作前请严格遵循以下约定。这些是本博客特有的规则，通用写作技巧不在此列。

## 公式
- 行内公式用 $...$，块级公式用 $$...$$。
- 量子态用 \ket{...}（如 $\ket{0}$、$\ket{\psi}$），不用 |...\rangle 写法。
- 化学式用 \ce{...}（如 $\ce{H2O}$、$\ce{2H2 + O2 -> 2H2O}$）。
- 公式源码以 LaTeX 原样存于 Markdown，不在渲染层改写。

## 代码块
- 可运行代码块标注语言并加 runnable 标记（见 ADR-0006 code runner）。
- 语言限定 code runner 五语言：python / node / go / rust / bun。
- 示例与正文配合，避免孤立代码块。

## 转载
- 转载文章必须填 canonical_url（原创留空）。
- 转载正文前注明出处，标题下保留最小转载标记。

## 标题与摘要
- 标题简洁达意，不用标题党。
- 摘要一两句话概括核心，不做完整引言。

## 标签
- 标签用现成主题词，不造新词；一篇文章 1-4 个标签。
`

// PromptTools MCP Prompt 集合，分布在 reader 与文章 server。
//
// writing_style 挂 reader（匿名静态）；polish_draft 挂文章 server（PAT 编排）。
// 见 PRD-0007 Prompts 形状。
type PromptTools struct {
	posts PostService // 复用现有端口：GetBySlugForAuthor 读 PAT 持有人的草稿
}

// NewPromptTools 构造 Prompt 集合。
func NewPromptTools(posts PostService) *PromptTools {
	return &PromptTools{posts: posts}
}

// WritingStyle 处理 writing_style prompt（匿名，无参数）。
// 返回单条 user message，注入博客品牌写作风格指南全文。
func (t *PromptTools) WritingStyle(_ context.Context, _ *mcp.GetPromptRequest) (*mcp.GetPromptResult, error) {
	return &mcp.GetPromptResult{
		Description: "本博客品牌写作风格指南",
		Messages: []*mcp.PromptMessage{{
			Role:    "user",
			Content: &mcp.TextContent{Text: "你是本博客写作助手。请严格遵循以下品牌写作风格指南：\n\n" + writingStyleGuide},
		}},
	}, nil
}

// polishDraftArgs polish_draft prompt 的参数。
type polishDraftArgs struct {
	Slug string `json:"slug"`
}

// PolishDraft 处理 polish_draft prompt（PAT posts:read，参数 slug）。
// 编排型：一次 prompts/get 完成读草稿 + 注入风格 + 触发润色。
// 草稿查询范围 = PAT 持有人的文章；不存在/非持有人 → 显式错误，不静默降级。
//
// 草稿 embed URI 用 blog://drafts/{slug}（非 blog://posts/{slug}）：
// EmbeddedResource.URI 是可寻址标识，agent 可能 resources/read 它；草稿不在 reader
// 公开通道（仅 published），用独立 drafts 路径段区分状态，与公开/私有线同构。
func (t *PromptTools) PolishDraft(ctx context.Context, req *mcp.GetPromptRequest) (*mcp.GetPromptResult, error) {
	if err := requirePromptScope(req, domainapitoken.ScopePostsRead); err != nil {
		return nil, err
	}
	slug, ok := req.Params.Arguments["slug"]
	if !ok || slug == "" {
		return nil, fmt.Errorf("缺少必填参数 slug：要润色的草稿 slug")
	}

	dto, err := t.posts.GetBySlugForAuthor(ctxWithOperator(ctx, promptOperatorUserID(req)), slug)
	if err != nil {
		return nil, fmt.Errorf("读取草稿失败（slug=%s，可能不存在或无权访问）: %w", slug, err)
	}

	instruction := &mcp.TextContent{
		Text: "按以下风格指南润色草稿，保持事实与结构不变：\n\n" + writingStyleGuide,
	}
	draftResource := &mcp.EmbeddedResource{
		Resource: &mcp.ResourceContents{
			URI:      fmt.Sprintf("blog://drafts/%s", slug),
			MIMEType: "text/markdown",
			Text:     dto.ContentMD,
		},
	}
	outputReq := &mcp.TextContent{
		Text: "输出润色后的完整 Markdown，保持公式与代码块标记（$...$ / ```lang）不变。",
	}

	return &mcp.GetPromptResult{
		Description: fmt.Sprintf("按本博客风格润色草稿「%s」", dto.Title),
		Messages: []*mcp.PromptMessage{
			// msg[0]: 指令 + 草稿同条 message 的两个 content block（语义上"指令和它处理的数据是一组"）
			{Role: "user", Content: instruction},
			{Role: "user", Content: draftResource},
			// msg[1]: 输出要求独立（完成动作的触发语）
			{Role: "user", Content: outputReq},
		},
	}, nil
}

// requirePromptScope 校验 PAT scope（与 tool 的 requireScope 同语义，但作用于 GetPromptRequest）。
func requirePromptScope(req *mcp.GetPromptRequest, scope string) error {
	ti := promptTokenInfo(req)
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

// promptTokenInfo 从 GetPromptRequest 取 TokenInfo（与 tool 的 tokenInfo 平行）。
func promptTokenInfo(req *mcp.GetPromptRequest) *auth.TokenInfo {
	if req == nil || req.Extra == nil {
		return nil
	}
	return req.Extra.TokenInfo
}

// promptOperatorUserID 取 prompt 请求的 PAT 持有人 user_id。
func promptOperatorUserID(req *mcp.GetPromptRequest) string {
	if ti := promptTokenInfo(req); ti != nil {
		return ti.UserID
	}
	return ""
}
