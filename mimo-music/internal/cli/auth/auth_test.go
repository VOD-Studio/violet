// auth 包命令层测试。seam:loginDeps.stdinIsTTY 注入(沿 play_test.go 惯例)。
//
// 不测:bubbletea Program 在真实终端的渲染(人工 smoke);真实网络 RPC(集成)。
package auth

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
)

// newTestKit 沿 download_deps_test.go 惯例:仅 Out/Err 注入 buffer,engine 留空
// (runLoginWith 在 TTY 守卫阶段就返回,不触达 RawDo)。
func newTestKit() (*kit.Kit, *bytes.Buffer, *bytes.Buffer) {
	var out, errb bytes.Buffer
	k := &kit.Kit{Out: &out, Err: &errb}
	return k, &out, &errb
}

// ==================== TTY 守卫 ====================

func TestRunLoginWith_NonTTYReturnsErrUsage(t *testing.T) {
	k, _, _ := newTestKit()
	err := runLoginWith(k, loginDeps{stdinIsTTY: func() bool { return false }})
	require.ErrorIs(t, err, kit.ErrUsage)
	require.Contains(t, err.Error(), "交互式终端")
}

// TTY 通过后,因 testKit 的 engine 为 nil,下一步 RawDo 会 panic/nil deref。
// 这里只验证守卫行为——TTY 通过后的真实流程依赖集成测试(需真 engine)。
// 为避免 panic 污染测试输出,这个用例故意停在守卫层。
