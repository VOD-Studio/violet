package cli

import (
	"bytes"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// TestHelpGroups_FiveGroupsDefined 验证 root 定义了 PRD 既定的 5 个 help 组。
func TestHelpGroups_FiveGroupsDefined(t *testing.T) {
	root := NewRootCommand()
	wantGroups := map[string]string{
		"quickstart": "快速上手:",
		"account":    "账号:",
		"music":      "音乐:",
		"discover":   "发现:",
		"tools":      "工具:",
	}
	got := map[string]string{}
	for _, g := range root.Groups() {
		got[g.ID] = g.Title
	}
	require.Equal(t, len(wantGroups), len(got), "组数应为 5,got %v", got)
	for id, title := range wantGroups {
		require.Equal(t, title, got[id], "组 %q 标题不符", id)
	}
}

// TestHelpGroups_EveryCommandHasGroup 验证每个命令都分配了 GroupID
// (无静默落 Additional Commands 的——这正是 #F 守护要拦的)。
// cobra 自动生成的命令(completion/help)也应归组。
func TestHelpGroups_EveryCommandHasGroup(t *testing.T) {
	root := NewRootCommand()
	// 触发懒生成的 completion/help 命令归组。
	require.NoError(t, root.Execute()) // 触发 InitDefaultCompletionCmd 等(若有)
	for _, c := range root.Commands() {
		// help 命令本身有时 GroupID 特殊处理,但本实现已归 tools。
		require.NotEmpty(t, c.GroupID, "命令 %q 缺 GroupID(会落 Additional Commands)", c.Name())
	}
}

// TestHelpGroups_CommandAssignment 验证关键命令归到正确的组。
func TestHelpGroups_CommandAssignment(t *testing.T) {
	root := NewRootCommand()
	cases := map[string]string{
		"login":          "quickstart",
		"login-cellphone": "quickstart",
		"login-status":   "quickstart",
		"logout":         "quickstart",
		"search":         "quickstart",
		"send-captcha":   "account",
		"user":           "account",
		"song":           "music",
		"album":          "music",
		"artist":         "music",
		"playlist":       "music",
		"recommend":      "discover",
		"fm":             "discover",
		"completion":     "tools",
		"help":           "tools",
	}
	cmds := map[string]string{}
	for _, c := range root.Commands() {
		cmds[c.Name()] = c.GroupID
	}
	for name, wantGroup := range cases {
		require.Equal(t, wantGroup, cmds[name], "命令 %q 归组不符", name)
	}
}

// TestHelp_DefaultShowsGroupsAndAliases 验证默认 --help 输出含 5 组标题 + 别名节。
func TestHelp_DefaultShowsGroupsAndAliases(t *testing.T) {
	root := NewRootCommand()
	var buf bytes.Buffer
	root.SetOut(&buf)
	root.SetArgs([]string{"--help"})
	require.NoError(t, root.Execute())
	out := buf.String()
	for _, title := range []string{"快速上手:", "账号:", "音乐:", "发现:", "工具:", "别名(跨级简写):"} {
		require.Contains(t, out, title, "默认 help 应含 %q", title)
	}
	require.Contains(t, out, "pp\tsong play", "别名节应列出 pp")
}

// TestHelp_VerboseFlattensAllCommands 验证 --help-verbose 平铺全部命令(无分组标题)。
func TestHelp_VerboseFlattensAllCommands(t *testing.T) {
	root := NewRootCommand()
	var buf bytes.Buffer
	root.SetOut(&buf)
	root.SetArgs([]string{"--help-verbose"})
	require.NoError(t, root.Execute())
	out := buf.String()
	// verbose 模式不应出现分组标题(命令平铺在 Additional Commands)。
	require.NotContains(t, out, "快速上手:", "verbose 不应有分组标题")
	require.NotContains(t, out, "音乐:", "verbose 不应有分组标题")
	// 应含全部命令(平铺)。
	require.Contains(t, out, "song", "verbose 应列 song")
	require.Contains(t, out, "completion", "verbose 应列 completion")
}

// TestHelp_AliasSectionReflectsAliasTable 验证别名节内容与别名表一致(单一真相)。
func TestHelp_AliasSectionReflectsAliasTable(t *testing.T) {
	root := NewRootCommand()
	var buf bytes.Buffer
	root.SetOut(&buf)
	root.SetArgs([]string{"--help"})
	require.NoError(t, root.Execute())
	out := buf.String()
	for _, e := range aliasList() {
		require.Contains(t, out, e.Alias, "别名节应含 %q", e.Alias)
		require.Contains(t, out, strings.Join(e.Expands, " "), "别名节应含 %q 的展开", e.Alias)
	}
}
