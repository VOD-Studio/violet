// Package kit
// annotations.go 定义命令树 rpc 守护的注解约定(PRD-0014 #B)。
//
// 每个 cobra 叶子命令通过 Annotations[RpcsAnnotationKey] 声明它消费的 grpc rpc,
// 守护测试据此与 proto ServiceDesc 反射出的 rpc 真值集做双向 diff(见
// internal/cli/rpc_guard_test.go)。命令名与 rpc 名非 1:1(如 fm↔GetPersonalFM、
// hot↔BrowseHot),无法靠字符串规则自动映射,故用显式注解作单一真相源。

package kit

import (
	"strings"

	"github.com/spf13/cobra"
)

// RpcsAnnotationKey 标记命令消费的 grpc rpc。
//
// 值为短形式 "Service/Method"(如 "SongService/GetSongDetail"),多 rpc 用逗号分隔
// (如 "SongService/GetSongURL,SongService/GetSongDetail")。值存在(含空串)即表示
// 命令已被审视;无此 key 的叶子命令会被漏标守护捕获。
const RpcsAnnotationKey = "musicctl/rpcs"

// ParseRpcs 把注解值拆成 rpc 列表。空串与缺失 key 都返回 nil(无 rpc,合法)。
// 逗号分隔,逐项去空白与空串(容错末尾/连续逗号)。
func ParseRpcs(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}

// AnnotateRpcs 给命令打 rpc 注解:把 rpcs 列表写入 c.Annotations[RpcsAnnotationKey]。
// rpcs 为空时写入空串(标记「已审视,无 rpc」),用于本地命令(recent/doctor/...)。
// 供各组 NewCommand 在 AddCommand 后集中打标,避免散落。
func AnnotateRpcs(c *cobra.Command, rpcs ...string) {
	if c.Annotations == nil {
		c.Annotations = map[string]string{}
	}
	c.Annotations[RpcsAnnotationKey] = strings.Join(rpcs, ",")
}
