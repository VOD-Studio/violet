package mcp

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/modelcontextprotocol/go-sdk/auth"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainapitoken "blog-api/internal/domain/api_token"
)

// bearerTransport 给每个请求带上令牌，模拟 MCP 客户端的 Authorization 头。
type bearerTransport struct{ token string }

func (b bearerTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	req = req.Clone(req.Context())
	req.Header.Set("Authorization", "Bearer "+b.token)
	return http.DefaultTransport.RoundTrip(req)
}

// connectRoadmap 起一个真实的 streamable HTTP 端点（套 PAT 鉴权中间件），再用 SDK 客户端连上去：
// 参数 schema 的推导、指针与可选字段的解码、scope 门禁都走真实的线上路径。
func connectRoadmap(t *testing.T, f roadmapFixture, scopes ...string) *mcp.ClientSession {
	t.Helper()
	verify := func(_ context.Context, token string, _ *http.Request) (*auth.TokenInfo, error) {
		if token != "good" {
			return nil, auth.ErrInvalidToken
		}
		return &auth.TokenInfo{UserID: "u-1", Scopes: scopes, Expiration: time.Now().Add(time.Hour)}, nil
	}
	handler := auth.RequireBearerToken(verify, nil)(StreamableHandler(NewRoadmapServer(f.tools)))
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	client := mcp.NewClient(&mcp.Implementation{Name: "test", Version: "1"}, nil)
	session, err := client.Connect(context.Background(), &mcp.StreamableClientTransport{
		Endpoint:             server.URL,
		HTTPClient:           &http.Client{Transport: bearerTransport{token: "good"}},
		DisableStandaloneSSE: true,
	}, nil)
	require.NoError(t, err)
	t.Cleanup(func() { _ = session.Close() })
	return session
}

func call(t *testing.T, session *mcp.ClientSession, name string, args map[string]any) *mcp.CallToolResult {
	t.Helper()
	res, err := session.CallTool(context.Background(), &mcp.CallToolParams{Name: name, Arguments: args})
	require.NoError(t, err)
	return res
}

func TestRoadmapServer_OverTheWire(t *testing.T) {
	f := newRoadmapFixture()
	session := connectRoadmap(t, f, domainapitoken.ScopeRoadmapRead, domainapitoken.ScopeRoadmapWrite)

	t.Run("列出 10 个 tool，并带着路线图的使用说明", func(t *testing.T) {
		tools, err := session.ListTools(context.Background(), nil)
		require.NoError(t, err)
		names := make([]string, 0, len(tools.Tools))
		for _, tool := range tools.Tools {
			names = append(names, tool.Name)
		}
		assert.ElementsMatch(t, []string{
			"list_projects", "get_roadmap", "create_item", "create_items", "update_item",
			"move_item", "delete_item", "restore_item", "create_relation", "delete_relation",
		}, names)
		assert.Contains(t, session.InitializeResult().Instructions, "roadmap:write")
	})

	t.Run("局部更新：省略的字段保持原样，空数组清空", func(t *testing.T) {
		res := call(t, session, "update_item", map[string]any{"project": "violet", "number": 1, "title": "线上改名", "tags": []string{}})

		require.False(t, res.IsError, textOf(t, res))
		assert.Equal(t, "线上改名", f.roadmap.updated.Title)
		assert.NotNil(t, f.roadmap.updated.Tags)
		assert.Empty(t, f.roadmap.updated.Tags, "tags: [] 是清空")
		assert.Equal(t, "简介 1", f.roadmap.updated.Description, "没给的字段沿用原值")
		assert.Len(t, f.roadmap.updated.Links, 1, "没给 links 就不动")
	})

	t.Run("移动：用编号锚点", func(t *testing.T) {
		res := call(t, session, "move_item", map[string]any{"project": "violet", "number": 4, "stage": "planned", "after_number": 2})

		require.False(t, res.IsError, textOf(t, res))
		assert.Equal(t, "item-2", f.roadmap.moved.BeforeID)
		assert.Equal(t, "item-3", f.roadmap.moved.AfterID)
	})

	t.Run("批量创建：一次提交整份路线图", func(t *testing.T) {
		res := call(t, session, "create_items", map[string]any{
			"project": "violet",
			"items": []map[string]any{
				{"ref": "a", "title": "第一项"},
				{"ref": "b", "title": "第二项", "stage": "in_progress", "tags": []string{"x"}},
			},
			"relations": []map[string]any{{"source": "b", "target": "a", "type": "extends"}},
		})

		require.False(t, res.IsError, textOf(t, res))
		assert.Len(t, f.relations.created, 1)
	})

	t.Run("参数类型不对时由 schema 在门口拦下，不触达服务", func(t *testing.T) {
		before := len(f.roadmap.created)
		res, err := session.CallTool(context.Background(), &mcp.CallToolParams{
			Name: "create_item", Arguments: map[string]any{"project": "violet", "title": 123},
		})

		require.True(t, err != nil || res.IsError)
		assert.Len(t, f.roadmap.created, before)
	})
}

func TestRoadmapServer_RejectsMissingTokenAndMissingScopeOverTheWire(t *testing.T) {
	f := newRoadmapFixture()
	handler := auth.RequireBearerToken(func(context.Context, string, *http.Request) (*auth.TokenInfo, error) {
		return nil, auth.ErrInvalidToken
	}, nil)(StreamableHandler(NewRoadmapServer(f.tools)))
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	response, err := http.Post(server.URL, "application/json", nil)
	require.NoError(t, err)
	defer response.Body.Close()
	assert.Equal(t, http.StatusUnauthorized, response.StatusCode, "没有令牌直接 401")

	session := connectRoadmap(t, f, domainapitoken.ScopeRoadmapRead)
	res := call(t, session, "create_item", map[string]any{"project": "violet", "title": "不该成功"})
	assert.True(t, res.IsError, "只读令牌写入被拒绝")
	assert.Contains(t, textOf(t, res), "roadmap:write")
	assert.Empty(t, f.roadmap.created)
	read := call(t, session, "get_roadmap", map[string]any{"project": "violet"})
	assert.False(t, read.IsError)
}
