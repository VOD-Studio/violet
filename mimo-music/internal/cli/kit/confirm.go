package kit

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"strings"
)

// readStdin 交互确认读取源(可注入替身,测试用)。
var readStdin = func() io.Reader { return os.Stdin }

// ConfirmWrite 写操作前确认。
//
// 三态:--yes 直通;stdin 非 TTY 且无 --yes 返回用法错误(退出码 2);
// TTY 提示 y/N,取消返回 false(打印「已取消」,退出码 0)。
// 提示走 stderr,结果输出不被污染。
func (k *Kit) ConfirmWrite(action string) (bool, error) {
	if k.Yes {
		return true, nil
	}
	if !stdinIsTTY() {
		return false, fmt.Errorf("%w:非交互环境的写操作需要 --yes 确认:%s", ErrUsage, action)
	}
	fmt.Fprintf(os.Stderr, "⚠ 即将真实操作你的网易云账号:%s\n输入 y 确认,其他取消: ", action)
	reader := bufio.NewReader(readStdin())
	line, _ := reader.ReadString('\n')
	if strings.TrimSpace(line) != "y" {
		fmt.Fprintln(os.Stderr, "已取消")
		return false, nil
	}
	return true, nil
}
