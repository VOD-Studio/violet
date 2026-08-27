package mcp

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// TestNewServers_RegisterAllToolsWithoutPanic 防回归：
// tool 参数结构体的 jsonschema tag 若在首个空格分隔 token 内含 '='，
// sdk ForType 会按 key=value 解析并以非法 key panic（曾致 server 启动崩溃）。
// 注册路径只取方法值不触发调用，nil 依赖即可覆盖全部 18 个 tool 的 schema 推导。
func TestNewServers_RegisterAllToolsWithoutPanic(t *testing.T) {
	post := NewPostServer(NewPostTools(nil), NewSearchTools(nil), NewPromptTools(nil), NewTagTools(nil), NewSeriesTools(nil))
	require.NotNil(t, post, "文章 server 应构造成功（10 tool + 1 prompt 注册无 panic）")

	scraper := NewScraperServer(NewScraperTools(nil, nil, nil))
	require.NotNil(t, scraper, "抓取 server 应构造成功（8 tool 注册无 panic）")

	reader := NewPublicServer(NewPublicTools(nil, nil), NewPromptTools(nil))
	require.NotNil(t, reader, "公开只读 server 应构造成功（2 Resource + 1 prompt 注册无 panic）")

	comments := NewCommentsServer(NewCommentTools(nil))
	require.NotNil(t, comments, "评论 server 应构造成功（3 tool 注册无 panic）")
}
