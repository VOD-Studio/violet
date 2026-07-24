package cli

// aliases 是 musicctl 的跨级命令别名表(argv 重写实现)。
//
// 机制(git run_argv / gh expandedArgs / cargo [alias] 同款):执行路径把 args[0] 的
// 别名替换为展开序列;__complete/__completeNoDesc 补全请求路径同样重写 args[1]
// (透过别名补全可用)。别名不进命令树 → tab 补全天然不含别名(保持候选干净);
// --help 与裸跑引导里另有静态节显式列出(那属 #E help 分组 / #D onboarding)。
//
// 首发六枚固定内置,不做用户自定义(cargo #6221 的遮蔽教训)。
// 别名规范为双字符(CONTEXT.md 双字符别名段:song/search/playlist/play 多 P/S 开头,
// 单字母结构性撞前缀;whoami 是唯一例外,因 login-status 语义清晰且无前缀冲突)。
var aliases = map[string][]string{
	"pp":     {"song", "play"},
	"dl":     {"song", "download"},
	"pll":    {"playlist", "download"},
	"se":     {"search"},
	"rd":     {"recommend", "daily-songs"},
	"whoami": {"login-status"},
}

// aliasList 返回别名表的一个快照切片(供 --help 静态节列出,顺序稳定)。
// 顺序按 key 字典序,保证 --help 输出确定性。
func aliasList() []aliasEntry {
	// 固定顺序而非 map 遍历(map 迭代无序会让 --help 输出抖动)。
	order := []string{"pp", "dl", "pll", "se", "rd", "whoami"}
	out := make([]aliasEntry, 0, len(order))
	for _, a := range order {
		out = append(out, aliasEntry{Alias: a, Expands: aliases[a]})
	}
	return out
}

// aliasEntry 是 --help 静态节的一行:别名 → 展开序列。
type aliasEntry struct {
	Alias   string
	Expands []string
}

// expand 执行路径的 argv 重写:若 args[0] 命中别名,把 args[0] 替换为展开序列。
//
// 返回 (rewritten, true) 表示命中并重写;(args, false) 表示未命中,原样返回。
// 只看 args[0](执行路径的别名位置);__complete 路径另用 expandForCompletion。
//
// 纯函数,无副作用,易测。
func expand(args []string) ([]string, bool) {
	if len(args) == 0 {
		return args, false
	}
	expansion, ok := aliases[args[0]]
	if !ok {
		return args, false
	}
	// 展开:expansion + args[1:]。
	rewritten := make([]string, 0, len(expansion)+len(args)-1)
	rewritten = append(rewritten, expansion...)
	rewritten = append(rewritten, args[1:]...)
	return rewritten, true
}

// expandForCompletion 是 __complete/__completeNoDesc 补全请求路径的 argv 重写。
//
// cobra 补全协议:实际命令是 `musicctl __complete <真实 args...>`,即 args[0]="__complete"
// (或 "__completeNoDesc"),真正的命令参数从 args[1] 开始。故别名在 args[1]。
//
// 与 expand 对称:命中则把 args[1] 替换为展开序列。返回 (rewritten, true/fase)。
func expandForCompletion(args []string) ([]string, bool) {
	if len(args) < 2 {
		return args, false
	}
	// 仅对补全协议命令生效。
	if args[0] != "__complete" && args[0] != "__completeNoDesc" {
		return args, false
	}
	expansion, ok := aliases[args[1]]
	if !ok {
		return args, false
	}
	rewritten := make([]string, 0, len(args)-1+len(expansion))
	rewritten = append(rewritten, args[0]) // 保留 __complete/__completeNoDesc
	rewritten = append(rewritten, expansion...)
	rewritten = append(rewritten, args[2:]...)
	return rewritten, true
}
