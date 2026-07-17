package kit

import (
	"io"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// TestConfirmWrite 确认四态:yes 直通/非 TTY 报错/TTY 取消/TTY 确认。
func TestConfirmWrite(t *testing.T) {
	defer func(orig func(int) bool) { isTerminal = orig }(isTerminal)
	defer func(orig func() io.Reader) { readStdin = orig }(readStdin)

	t.Run("yes 直通", func(t *testing.T) {
		isTerminal = func(int) bool { return false } // 即使非 TTY 也直通
		k := &Kit{Yes: true}
		ok, err := k.ConfirmWrite("删除歌单 1")
		require.NoError(t, err)
		require.True(t, ok)
	})

	t.Run("非 TTY 无 yes 报错", func(t *testing.T) {
		isTerminal = func(int) bool { return false }
		k := &Kit{}
		ok, err := k.ConfirmWrite("删除歌单 1")
		require.ErrorIs(t, err, ErrUsage)
		require.False(t, ok)
	})

	t.Run("TTY 取消", func(t *testing.T) {
		isTerminal = func(int) bool { return true }
		readStdin = func() io.Reader { return strings.NewReader("n\n") }
		k := &Kit{}
		ok, err := k.ConfirmWrite("删除歌单 1")
		require.NoError(t, err)
		require.False(t, ok)
	})

	t.Run("TTY 确认", func(t *testing.T) {
		isTerminal = func(int) bool { return true }
		readStdin = func() io.Reader { return strings.NewReader("y\n") }
		k := &Kit{}
		ok, err := k.ConfirmWrite("删除歌单 1")
		require.NoError(t, err)
		require.True(t, ok)
	})
}
