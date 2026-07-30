package mcp

import (
	"context"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/auth"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainapitoken "blog-api/internal/domain/api_token"
	domainpost "blog-api/internal/domain/post"
)

// promptReq 构造带 TokenInfo 与 arguments 的 GetPromptRequest。
func promptReq(scopes []string, userID string, args map[string]string) *mcp.GetPromptRequest {
	params := mcp.GetPromptParams{Arguments: args}
	return &mcp.GetPromptRequest{
		Params: &params,
		Extra: &mcp.RequestExtra{
			TokenInfo: &auth.TokenInfo{Scopes: scopes, UserID: userID},
		},
	}
}

func TestPromptTools_WritingStyle(t *testing.T) {
	tools := NewPromptTools(nil)

	res, err := tools.WritingStyle(context.Background(), &mcp.GetPromptRequest{})
	require.NoError(t, err)
	require.Len(t, res.Messages, 1)

	msg := res.Messages[0]
	assert.Equal(t, mcp.Role("user"), msg.Role)
	tc, ok := msg.Content.(*mcp.TextContent)
	require.True(t, ok)
	// 含风格指南关键章节（公式/代码块/转载约定）
	assert.Contains(t, tc.Text, "写作风格指南")
	assert.Contains(t, tc.Text, "\\ket")
	assert.Contains(t, tc.Text, "runnable")
	assert.Contains(t, tc.Text, "canonical_url")
}

func TestPromptTools_PolishDraft_ThreeMessageStructure(t *testing.T) {
	tools := NewPromptTools(&fakePostService{})

	res, err := tools.PolishDraft(context.Background(),
		promptReq([]string{domainapitoken.ScopePostsRead}, "u-1", map[string]string{"slug": "wip"}))
	require.NoError(t, err)

	// 3 条 message（指令 + 草稿 + 输出要求）。
	// 注：PRD-0007 原设计为 2-message（指令+草稿同条 message 的两个 content block），
	// 但 go-sdk 的 PromptMessage.Content 是单个 Content（非数组），故拆为 3 条。
	require.Len(t, res.Messages, 3, "应为指令+草稿+输出要求三条 message")

	// msg[0] 指令：TextContent 含风格指南
	instr, ok := res.Messages[0].Content.(*mcp.TextContent)
	require.True(t, ok, "msg[0] 应为 TextContent")
	assert.Contains(t, instr.Text, "风格指南")

	// msg[1] 草稿：EmbeddedResource，URI 为 blog://drafts/{slug}
	er, ok := res.Messages[1].Content.(*mcp.EmbeddedResource)
	require.True(t, ok, "msg[1] 应为 EmbeddedResource")
	assert.Equal(t, "blog://drafts/wip", er.Resource.URI)
	assert.Equal(t, "text/markdown", er.Resource.MIMEType)
	assert.Contains(t, er.Resource.Text, "草稿", "embed 内容应为草稿正文")

	// msg[2] 输出要求：TextContent
	out, ok := res.Messages[2].Content.(*mcp.TextContent)
	require.True(t, ok, "msg[2] 应为 TextContent")
	assert.Contains(t, out.Text, "Markdown")
}

func TestPromptTools_PolishDraft_MissingScope(t *testing.T) {
	tools := NewPromptTools(&fakePostService{})

	_, err := tools.PolishDraft(context.Background(),
		promptReq(nil, "u-1", map[string]string{"slug": "wip"}))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "posts:read")
}

func TestPromptTools_PolishDraft_MissingSlug(t *testing.T) {
	tools := NewPromptTools(&fakePostService{})

	_, err := tools.PolishDraft(context.Background(),
		promptReq([]string{domainapitoken.ScopePostsRead}, "u-1", nil))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "slug")
}

func TestPromptTools_PolishDraft_EmptySlug(t *testing.T) {
	tools := NewPromptTools(&fakePostService{})

	_, err := tools.PolishDraft(context.Background(),
		promptReq([]string{domainapitoken.ScopePostsRead}, "u-1", map[string]string{"slug": ""}))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "slug")
}

func TestPromptTools_PolishDraft_DraftNotFound(t *testing.T) {
	// fakePostService.GetBySlugForAuthor 默认返回 getErr=nil；
	// 这里注入 NotFound 模拟草稿不存在/无权访问。
	svc := &fakePostService{getErr: domainpost.ErrNotFound}
	tools := NewPromptTools(svc)

	_, err := tools.PolishDraft(context.Background(),
		promptReq([]string{domainapitoken.ScopePostsRead}, "u-1", map[string]string{"slug": "missing"}))
	require.Error(t, err)
	// 显式错误，不静默降级
	assert.Contains(t, err.Error(), "missing")
}

func TestPromptTools_PolishDraft_EmbedContentMatchesDraft(t *testing.T) {
	// fakePostService.GetBySlugForAuthor 返回固定 ContentMD="# 草稿\n正文"
	tools := NewPromptTools(&fakePostService{})

	res, err := tools.PolishDraft(context.Background(),
		promptReq([]string{domainapitoken.ScopePostsRead}, "u-1", map[string]string{"slug": "wip"}))
	require.NoError(t, err)

	er, ok := res.Messages[1].Content.(*mcp.EmbeddedResource)
	require.True(t, ok)
	// embed 内容与 fake 返回的草稿 content_md 一致
	assert.Equal(t, "# 草稿\n正文", er.Resource.Text)
}

// 编译期断言：writingStyleGuide 含关键约定（防风格规则被误删后测试无感知）。
func TestWritingStyleGuide_ContainsKeyConventions(t *testing.T) {
	for _, key := range []string{"\\ket", "\\ce{", "runnable", "canonical_url", "python"} {
		assert.True(t, strings.Contains(writingStyleGuide, key),
			"风格指南应含关键约定 %q", key)
	}
}
