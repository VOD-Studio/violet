package cli

import (
	"sort"
	"strings"
	"testing"

	"github.com/spf13/cobra"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/reflect/protoreflect"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
)

// 本文件实现 PRD-0014 #B「命令树守护测试」核心:proto ServiceDesc 全量 rpc ↔
// cobra 命令树注解双向 diff。
//
// 设计要点:
//   - rpc 真值集来自 protoreflect.FileDescriptor 反射(9 个 proto 文件),不硬编码
//     rpc 名,接口按蓝图(78 → 357)增长时自动生效。
//   - 命令侧的 rpc 声明在各命令 Annotations[kit.RpcsAnnotationKey](见 kit/annotations.go
//     与各组 annotate*Rpcs)。
//   - 双向 diff:① 命令声明的 rpc 必须真实存在(防注解拼写错);② proto 有 rpc 但无
//     命令消费 → 必须进 rpcsWithoutCliAllowlist(防新增 rpc 漏接 CLI);③ 叶子命令漏打
//     注解会被捕获(防新增命令忘标)。
//
// 与 guard_test.go 的 help 分组守护(片段 C)互补,后者只守 GroupID,本文件守 rpc 对应。

// rpcsWithoutCliAllowlist 登记「刻意不进 CLI 的 rpc」(PRD-0014 User Story 3)。
//
// musicctl 定位调试/实用工具,357 接口不无脑 1:1 进 CLI(云贝/签到/音乐人后台这类
// 大概率只登记)。「rpc 不进 CLI」是合法且受守护保护的决策,不是待消灭的债。
//
// key 是短形式 rpc 名(Service/Method),value 是不接 CLI 的理由。
// 新增 proto rpc 时:要么接 CLI 命令,要么在此登记理由,否则 TestGuard_RpcsWithoutCliAreAllowlisted 红。
var rpcsWithoutCliAllowlist = map[string]string{}

// noRpcAllowlist 登记允许「不打 rpc 注解」的叶子命令。
//
// 正常所有叶子命令都应通过 kit.AnnotateRpcs 打标(哪怕标空表示无 rpc)。cobra 自动
// 生成的 help/completion 子命令无 Annotations,在此兜底;其余叶子命令漏标一律红。
// key 是命令名(不含父路径)。
var noRpcAllowlist = map[string]string{
	"help":        "cobra 自动生成,无业务",
	"completion":  "cobra 自动生成,无业务(容器)",
	"bash":        "cobra completion 子命令,无业务",
	"zsh":         "cobra completion 子命令,无业务",
	"fish":        "cobra completion 子命令,无业务",
	"powershell":  "cobra completion 子命令,无业务",
}

// allProtoFiles 是全部 proto 文件的 FileDescriptor。新增 proto service 文件时
// 在此追加一行,反射即自动覆盖其 rpc。每个 proto 文件 NumServices 为 1。
var allProtoFiles = []protoreflect.FileDescriptor{
	mmpb.File_netease_music_v1_album_proto,
	mmpb.File_netease_music_v1_artist_proto,
	mmpb.File_netease_music_v1_auth_proto,
	mmpb.File_netease_music_v1_fm_proto,
	mmpb.File_netease_music_v1_playlist_proto,
	mmpb.File_netease_music_v1_recommend_proto,
	mmpb.File_netease_music_v1_search_proto,
	mmpb.File_netease_music_v1_song_proto,
	mmpb.File_netease_music_v1_user_proto,
}

// allRpcsFromProto 用 protoreflect 反射出全部 grpc rpc 真值集(短形式 Service/Method)。
// 动态发现,禁止硬编码 rpc 总数——接口按 357 蓝图持续增长时守护自动生效。
func allRpcsFromProto(t *testing.T) map[string]bool {
	t.Helper()
	out := map[string]bool{}
	for _, fd := range allProtoFiles {
		svcs := fd.Services()
		for i := 0; i < svcs.Len(); i++ {
			svc := svcs.Get(i)
			methods := svc.Methods()
			for j := 0; j < methods.Len(); j++ {
				// svc.Name()="SongService"、method.Name()="GetSongDetail"
				// → 短形式 "SongService/GetSongDetail",与命令注解格式一致。
				out[string(svc.Name())+"/"+string(methods.Get(j).Name())] = true
			}
		}
	}
	require.NotEmpty(t, out, "proto 反射出 0 个 rpc,说明 allProtoFiles 为空或反射失败")
	return out
}

// rpcCmd 是 rpcGuardWalk 的访问单元。
type rpcCmd struct {
	// path 是完整命令路径(如 "musicctl song play"),用于失败信息定位。
	path string
	// name 是命令名(不含父路径),用于查 noRpcAllowlist。
	name string
	// rpcs 是注解里声明的 rpc 列表(已用 kit.ParseRpcs 解析);nil 表示未打标。
	rpcs []string
	// annotated 表示是否打了 RpcsAnnotationKey(区分「标空」与「未打标」)。
	annotated bool
	// isLeaf 表示是否为叶子命令(无子命令)。容器命令(search 有子命令但自身也可执行)
	// 不参与漏标守护,但若打了注解其 rpc 仍计入消费集。
	isLeaf bool
}

// rpcGuardWalk 深度优先遍历命令树(不含 root),收集每个命令的 rpc 注解状态。
// 同时返回容器与叶子命令——rpc 消费集(正/反向 diff)取所有 annotated 的命令,
// 漏标守护只看 isLeaf 的命令。
func rpcGuardWalk(root *cobra.Command) []rpcCmd {
	var out []rpcCmd
	var walk func(c *cobra.Command, prefix string)
	walk = func(c *cobra.Command, prefix string) {
		path := prefix + c.Name()
		if c.Name() == "" { // root 自身
			path = "musicctl"
		}
		if c.Name() != "" { // 跳过 root
			rc := rpcCmd{
				path:   path,
				name:   c.Name(),
				isLeaf: len(c.Commands()) == 0,
			}
			if v, ok := c.Annotations[kit.RpcsAnnotationKey]; ok {
				rc.annotated = true
				rc.rpcs = kit.ParseRpcs(v)
			}
			out = append(out, rc)
		}
		for _, sub := range c.Commands() {
			walk(sub, path+" ")
		}
	}
	walk(root, "")
	return out
}

// TestGuard_CmdDeclaredRpcsMustExist 守护(正向 diff):命令注解声明的每个 rpc 必须
// 真实存在于 proto 反射出的 rpc 真值集。
//
// 拦截:命令注解拼错了 service/method 名(如 SongService/GetSongDetial)、proto 删了
// rpc 但命令注解没同步。失败信息指明哪个命令的哪条 rpc 非法。
func TestGuard_CmdDeclaredRpcsMustExist(t *testing.T) {
	root := NewRootCommand()
	_ = root.Execute()
	existing := allRpcsFromProto(t)

	var illegal []string
	for _, rc := range rpcGuardWalk(root) {
		for _, rpc := range rc.rpcs {
			if !existing[rpc] {
				illegal = append(illegal, rc.path+" 声明了不存在的 rpc: "+rpc)
			}
		}
	}
	sort.Strings(illegal)
	require.Empty(t, illegal,
		"以下命令注解声明的 rpc 在 proto 里不存在(注解拼错?proto 改了 rpc 名?)。"+
			"真实 rpc 集合见 allRpcsFromProto,共 %d 个:\n%s",
		len(existing), strings.Join(illegal, "\n"))
}

// TestGuard_RpcsWithoutCliAreAllowlisted 守护(反向 diff):proto 有 rpc 但无任何命令
// 消费时,必须在 rpcsWithoutCliAllowlist 显式登记理由。
//
// 拦截:proto 新增了 rpc 但 CLI 没接命令也没登记(忘接或忘登记都会红)。
// PRD-0014 明确「rpc 不进 CLI 是合法决策」,但必须刻意登记,例外不能是悄悄的遗漏。
func TestGuard_RpcsWithoutCliAreAllowlisted(t *testing.T) {
	root := NewRootCommand()
	_ = root.Execute()

	// 命令消费的全部 rpc(并集)。
	consumed := map[string]bool{}
	for _, rc := range rpcGuardWalk(root) {
		for _, rpc := range rc.rpcs {
			consumed[rpc] = true
		}
	}

	existing := allRpcsFromProto(t)
	var unregistered []string
	for rpc := range existing {
		if consumed[rpc] {
			continue
		}
		if _, allowed := rpcsWithoutCliAllowlist[rpc]; !allowed {
			unregistered = append(unregistered, rpc)
		}
	}
	sort.Strings(unregistered)
	require.Empty(t, unregistered,
		"以下 proto rpc 没有任何命令消费,也没在 rpcsWithoutCliAllowlist 登记理由。"+
			"请接 CLI 命令(并在命令注解声明),或在该 allowlist 登记不接的理由:\n%s",
		strings.Join(unregistered, "\n"))
}

// TestGuard_LeafCmdHasRpcsAnnotation 守护(漏标):叶子命令必须打 RpcsAnnotationKey 注解
// (哪怕标空表示无 rpc),或在 noRpcAllowlist 登记理由(cobra 自动生成的 help/completion)。
//
// 拦截:新增 rpc 命令忘打标(会导致反向 diff 误判该 rpc 无 CLI)。
// 容器命令(有子命令)不打标,本测试不涉及。
func TestGuard_LeafCmdHasRpcsAnnotation(t *testing.T) {
	root := NewRootCommand()
	_ = root.Execute()

	var unannotated []string
	for _, rc := range rpcGuardWalk(root) {
		if !rc.isLeaf { // 容器命令(如 search)不打标,不参与漏标守护
			continue
		}
		if rc.annotated {
			continue
		}
		if _, allowed := noRpcAllowlist[rc.name]; allowed {
			continue
		}
		unannotated = append(unannotated, rc.path)
	}
	require.Empty(t, unannotated,
		"以下叶子命令未打 RpcsAnnotationKey 注解。请用 kit.AnnotateRpcs 声明消费的 rpc"+
			"(本地命令标空串),否则双向 diff 守护无法识别它:\n%s",
		strings.Join(unannotated, "\n"))
}
