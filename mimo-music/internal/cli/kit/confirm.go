package kit

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
)

// readStdin 交互确认读取源(可注入替身,测试用)。
var readStdin = func() io.Reader { return os.Stdin }

// ErrCancelled 用户取消哨兵错误,Execute 静默吞掉(退出码 0,不打错误信息)。
var ErrCancelled = errors.New("用户已取消")

// ConfirmFatal 写操作确认的一行化形式:确认返回 nil;
// 取消返回 ErrCancelled(Execute 退出码 0);非交互未授权返回 ErrUsage(退出码 2)。
// 13 个写命令调用点统一用这个,不再重复 ok/err 三行判断。
func (k *Kit) ConfirmFatal(action string) error {
	ok, err := k.ConfirmWrite(action)
	if err != nil {
		return err
	}
	if !ok {
		return ErrCancelled
	}
	return nil
}

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
	fmt.Fprintf(os.Stderr, "即将执行写操作:%s\n输入 y 确认,其他取消: ", action)
	reader := bufio.NewReader(readStdin())
	line, _ := reader.ReadString('\n')
	if strings.TrimSpace(line) != "y" {
		fmt.Fprintln(os.Stderr, "已取消")
		return false, nil
	}
	return true, nil
}
