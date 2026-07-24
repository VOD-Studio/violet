package cli

import (
	"testing"

	"github.com/spf13/cobra"
	"github.com/stretchr/testify/require"
)

// ungroupedAllowlist 登记允许「不分组」的命令(默认空——所有命令应归组)。
//
// 新增无 GroupID 的命令要么归组,要么在此登记理由。cobra 对无 group 命令静默落
// "Additional Commands",本守护拦这个:无 GroupID 且未登记 → 测试红,防止随接口
// 增长 silently 腐烂(PRD-0014 #F)。
//
// key 是命令的 Name(),value 是理由。
var ungroupedAllowlist = map[string]string{}

// TestGuard_EveryCommandHasGroup 守护:root 的每个直接子命令都必须有 GroupID,
// 或在 ungroupedAllowlist 显式登记理由。
//
// cobra 的分组只对 root 的直接子命令生效(它们出现在 `musicctl --help` 的分组里);
// 孙命令(song play 等)在各自父命令的 --help 里展示,不继承父 GroupID,不要求分组。
// 无 GroupID 的直接子命令会静默落 "Additional Commands",随接口增长 silently 腐烂——
// 本测试拦这个。
//
// cobra 自动生成的 completion/help 应已在 root.go 归组;若遗漏,本测试捕获。
func TestGuard_EveryCommandHasGroup(t *testing.T) {
	root := NewRootCommand()
	// 触发 cobra 懒生成的 completion/help 命令并归组。
	_ = root.Execute()

	var ungrouped []string
	for _, c := range root.Commands() {
		if c.GroupID == "" {
			if _, allowed := ungroupedAllowlist[c.Name()]; !allowed {
				ungrouped = append(ungrouped, c.Name())
			}
		}
	}
	require.Empty(t, ungrouped,
		"以下 root 直接子命令缺 GroupID(会静默落 Additional Commands),请归组或登记 ungroupedAllowlist:\n%v",
		ungrouped)
}

// TestGuard_ValidGroupsOnly 守护:root 直接子命令的 GroupID 必须是 root 已注册的组。
// 防止拼写错误(如 "musci")导致命令落到不存在的组(同样静默落 Additional)。
func TestGuard_ValidGroupsOnly(t *testing.T) {
	root := NewRootCommand()
	_ = root.Execute()
	validGroups := map[string]bool{}
	for _, g := range root.Groups() {
		validGroups[g.ID] = true
	}
	var invalid []string
	for _, c := range root.Commands() {
		if c.GroupID != "" && !validGroups[c.GroupID] {
			invalid = append(invalid, c.Name()+" (group="+c.GroupID+")")
		}
	}
	require.Empty(t, invalid,
		"以下命令的 GroupID 不在 root 注册的组里(拼写错?会静默落 Additional):\n%v", invalid)
}

// TestGuard_RootHasExpectedGroups 守护:root 必须定义 PRD 既定的 5 组。
// 防止重构时误删组定义(组删了命令会全部落 Additional)。
func TestGuard_RootHasExpectedGroups(t *testing.T) {
	root := NewRootCommand()
	got := map[string]bool{}
	for _, g := range root.Groups() {
		got[g.ID] = true
	}
	for _, id := range []string{"quickstart", "account", "music", "discover", "tools"} {
		require.True(t, got[id], "root 缺少既定组 %q(5 组之一,误删会让命令落 Additional)", id)
	}
}

// TestGuard_EveryCommandHasShort 守护:每个命令(含子命令)必须有非空 Short。
// 空 Short 会让 --help 列表里该命令无描述,用户无法判断命令用途。
// cobra 自动生成的 completion/help 有 Short,不需排除。
func TestGuard_EveryCommandHasShort(t *testing.T) {
	root := NewRootCommand()
	_ = root.Execute()
	var missing []string
	walkAll(root, func(name, short string) {
		if short == "" {
			missing = append(missing, name)
		}
	})
	require.Empty(t, missing, "以下命令缺 Short(--help 列表会无描述):\n%v", missing)
}

// TestGuard_LeafCommandsRunnable 守护:叶子命令(无子命令)必须有 Run/RunE,
// 否则 cobra 报「unknown command」或什么都不做(漏接 RunE 是常见 bug)。
// 容器命令(有子命令,如 song/album)不要求 Run。
func TestGuard_LeafCommandsRunnable(t *testing.T) {
	root := NewRootCommand()
	_ = root.Execute()
	var notRunnable []string
	walkAllCmd(root, func(c *guardCmd) {
		// 有子命令 = 容器,跳过。help/completion 是 cobra 特殊命令,跳过。
		if c.hasSubCommands || c.name == "help" || c.name == "completion" {
			return
		}
		if !c.runnable {
			notRunnable = append(notRunnable, c.name)
		}
	})
	require.Empty(t, notRunnable,
		"以下叶子命令无 Run/RunE(漏接会什么都不做):\n%v", notRunnable)
}

// guardCmd 是 walkAllCmd 的访问单元。
type guardCmd struct {
	name          string
	hasSubCommands bool
	runnable      bool
}

// walkAll 深度优先遍历命令树(含 root),visit(name, short)。
func walkAll(cmd *cobra.Command, visit func(name, short string)) {
	visit(cmd.Name(), cmd.Short)
	for _, sub := range cmd.Commands() {
		walkAll(sub, visit)
	}
}

// walkAllCmd 深度优先遍历(含 root),visit 完整 guardCmd。
func walkAllCmd(cmd *cobra.Command, visit func(*guardCmd)) {
	visit(&guardCmd{
		name:           cmd.Name(),
		hasSubCommands: len(cmd.Commands()) > 0,
		runnable:       cmd.Runnable(),
	})
	for _, sub := range cmd.Commands() {
		walkAllCmd(sub, visit)
	}
}
