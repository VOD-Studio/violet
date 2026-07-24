package cli

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// TestAlias_RoutesToCorrectCommand 验证别名展开后,cobra 能在命令树里定位到目标命令
// (行为等价的代理断言:别名展开为合法命令路径,与直接调用一致)。
//
// 用 NewRootCommand().Find(展开后的 args) 验证命令存在;不实际执行(避免网络/TTY 依赖)。
func TestAlias_RoutesToCorrectCommand(t *testing.T) {
	root := NewRootCommand()
	cases := []struct {
		alias   string
		expands []string // 期望展开的命令路径
	}{
		{"pp", []string{"song", "play"}},
		{"dl", []string{"song", "download"}},
		{"pll", []string{"playlist", "download"}},
		{"se", []string{"search"}},
		{"rd", []string{"recommend", "daily-songs"}},
		{"whoami", []string{"login-status"}},
	}
	for _, tc := range cases {
		t.Run(tc.alias, func(t *testing.T) {
			// 先验证 expand 真的展开成期望路径。
			rewritten, ok := expand([]string{tc.alias})
			require.True(t, ok, "别名 %q 应命中", tc.alias)
			require.Equal(t, tc.expands, rewritten, "展开不符")

			// 再验证展开后的命令路径在 root 树里能找到(命令存在)。
			cmd, _, err := root.Find(tc.expands)
			require.NoError(t, err, "展开路径 %v 在命令树里找不到", tc.expands)
			require.NotNil(t, cmd, "Find 返回 nil 命令")
			require.Equal(t, tc.expands[len(tc.expands)-1], cmd.Name(),
				"找到的命令名不符")
		})
	}
}

// TestAlias_NotInCommandTree 验证别名不进命令树(cobra 不认识裸别名,需 argv 重写)。
// 这是「tab 补全不含别名」的保证:别名不是命令,不会被 cobra 当子命令列出。
func TestAlias_NotInCommandTree(t *testing.T) {
	root := NewRootCommand()
	for alias := range aliases {
		cmd, _, err := root.Find([]string{alias})
		// 找不到(err)或找到的是 root 本身(别名被当未知参数)——都说明别名不在树里。
		if err == nil && cmd != nil && cmd != root.Root() && cmd.Name() == alias {
			t.Errorf("别名 %q 不应是命令树里的命令", alias)
		}
	}
}

// TestAlias_UnknownAliasFallsThroughToCobra 未知别名不重写,交给 cobra 报 unknown command。
func TestAlias_UnknownAliasFallsThroughToCobra(t *testing.T) {
	_, ok := expand([]string{"nonexistent-alias"})
	require.False(t, ok, "未知别名应 miss")
}

// TestAlias_KnownAliasesComplete 验证全部六枚别名都在表里(防漏)。
func TestAlias_KnownAliasesComplete(t *testing.T) {
	want := map[string]bool{
		"pp": true, "dl": true, "pll": true,
		"se": true, "rd": true, "whoami": true,
	}
	require.Equal(t, len(want), len(aliases), "别名数量应为 6")
	for a := range want {
		_, ok := aliases[a]
		require.True(t, ok, "缺少别名 %q", a)
	}
}
