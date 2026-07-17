package kit

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

// ConfirmWrite 写操作前 y/N 确认;用户确认返回 true,否则打印"已取消"并返回 false。
func ConfirmWrite(action string) bool {
	fmt.Printf("⚠ 即将真实操作你的网易云账号:%s\n输入 y 确认,其他取消: ", action)
	reader := bufio.NewReader(os.Stdin)
	line, _ := reader.ReadString('\n')
	if strings.TrimSpace(line) != "y" {
		fmt.Println("已取消")
		return false
	}
	return true
}
