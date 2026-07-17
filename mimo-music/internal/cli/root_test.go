// Package cli 的根命令测试。
package cli

import (
	"errors"
	"fmt"
	"testing"

	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
	"github.com/stretchr/testify/require"
)

// TestExitCode 错误到退出码的映射: 3=未登录,2=用法,1=通用。
func TestExitCode(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		err  error
		want int
	}{
		{"未登录", fmt.Errorf("%w:先运行 login", kit.ErrNotLogin), 3},
		{"用法错误", errors.Join(kit.ErrUsage, errors.New("unknown flag: --bogus")), 2},
		{"必填 flag 缺失", errors.New(`required flag(s) "id" not set`), 2},
		{"通用错误", errors.New("上游不可用: code=503"), 1},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			require.Equal(t, tc.want, ExitCode(tc.err))
		})
	}
}
