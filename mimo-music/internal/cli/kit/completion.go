package kit

import (
	"strconv"
	"strings"

	"github.com/spf13/cobra"
)

// MountCompletion 在 root 构造后一次树遍历统一挂载参数补全。
//
// 表驱动(flag 名 → 数据源):
//   - "id"(单值歌曲 ID)→ 召回池候选(带「歌名 - 艺人」描述列),按 frecency 排序。
//   - "level"/"area"/"op" 等 → 固定枚举。
//
// 新命令(A 类 rpc 1:1 接入)带同名 flag 时自动获得补全,零登记。个别命令异构需求
// 可在 MountCompletion 后就地 RegisterFlagCompletionFunc 覆盖——本函数检测已注册
// 的 flag 会跳过,尊重命令就地覆盖。
//
// **补全绝不触发网络**:--id 候选全部来自召回池(内存优先,磁盘兜底),枚举是静态值
// (CONTEXT.md 补全只走缓存段)。
//
// 调用点:NewRootCommand 末尾(root 构造后、return 前)。
func MountCompletion(root *cobra.Command, k *Kit) {
	// 表:flag 名 → 补全函数。
	// level/area/op 的合法值在命令各处硬编码(helptext「1=standard...」/strToArea case),
	// 这里集中登记,与命令定义解耦但保持一致。
	flagCompleters := map[string]func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective){
		"id":    completeID(k),
		"level": completeEnum("1", "2", "3", "4"),
		"area":  completeEnum("ALL", "ZH", "EA", "KR", "JP"),
		"op":    completeEnum("add", "del"),
	}
	// 遍历命令树,给每个命令的对应 flag 挂补全(已注册的跳过,尊重就地覆盖)。
	walk(root, func(cmd *cobra.Command) {
		for flagName, fn := range flagCompleters {
			if cmd.Flags().Lookup(flagName) == nil {
				continue
			}
			if _, registered := cmd.GetFlagCompletionFunc(flagName); registered {
				continue
			}
			_ = cmd.RegisterFlagCompletionFunc(flagName, fn)
		}
	})
}

// walk 深度优先遍历命令树(含 root)。
func walk(cmd *cobra.Command, visit func(*cobra.Command)) {
	visit(cmd)
	for _, sub := range cmd.Commands() {
		walk(sub, visit)
	}
}

// completeID 返回召回池候选的补全函数。候选格式「<id>\t<歌名> - <艺人>」,
// 按 frecency 排序;补全绝不触发网络(召回池本地读)。空池返回空候选(不报错)。
func completeID(k *Kit) func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
	return func(cmd *cobra.Command, _ []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		pool := k.RecallPool()
		if pool == nil {
			return nil, cobra.ShellCompDirectiveNoFileComp
		}
		ranked, err := pool.TopN(50) // 补全上限 50,避免候选过长
		if err != nil {
			return nil, cobra.ShellCompDirectiveNoFileComp
		}
		var comps []string
		for _, r := range ranked {
			idStr := strconv.FormatInt(r.Event.ID, 10)
			// toComplete 前缀过滤(用户已敲的数字)。
			if toComplete != "" && !strings.HasPrefix(idStr, toComplete) {
				continue
			}
			desc := r.Event.Name
			if r.Event.Artist != "" {
				if desc == "" {
					desc = r.Event.Artist
				} else {
					desc = desc + " - " + r.Event.Artist
				}
			}
			if desc == "" {
				comps = append(comps, idStr)
			} else {
				comps = append(comps, idStr+"\t"+desc)
			}
		}
		return comps, cobra.ShellCompDirectiveNoFileComp
	}
}

// completeEnum 返回固定枚举补全函数,toComplete 前缀过滤。
func completeEnum(values ...string) func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
	return func(_ *cobra.Command, _ []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		var comps []string
		for _, v := range values {
			if toComplete == "" || strings.HasPrefix(v, toComplete) {
				comps = append(comps, v)
			}
		}
		return comps, cobra.ShellCompDirectiveNoFileComp
	}
}
