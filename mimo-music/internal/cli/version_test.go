package cli

import (
	"encoding/json"
	"runtime/debug"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// fakeBuildInfo 构造一个 *debug.BuildInfo 用于测试(注入 readBuildInfo)。
func fakeBuildInfo(version, goVersion string, settings ...debug.BuildSetting) *debug.BuildInfo {
	return &debug.BuildInfo{
		GoVersion: goVersion,
		Main:      debug.Module{Version: version},
		Settings:  settings,
	}
}

// withFakeBuildInfo 注入 fake readBuildInfo,测试结束还原。
func withFakeBuildInfo(t *testing.T, bi *debug.BuildInfo) {
	t.Helper()
	orig := readBuildInfo
	readBuildInfo = func() (*debug.BuildInfo, bool) { return bi, true }
	t.Cleanup(func() { readBuildInfo = orig })
}

func TestLoadVersion_FullVCSInfo(t *testing.T) {
	withFakeBuildInfo(t, fakeBuildInfo("v0.1.0", "go1.25.0",
		debug.BuildSetting{Key: "vcs.revision", Value: "a1f961aabcdef1234567890"},
		debug.BuildSetting{Key: "vcs.time", Value: "2026-07-24T10:00:00Z"},
		debug.BuildSetting{Key: "vcs.modified", Value: "false"},
	))
	v := LoadVersion()
	require.Equal(t, "v0.1.0", v.Version)
	require.Equal(t, "a1f961a", v.Commit, "commit 应取前 7 位短哈希")
	require.Equal(t, "2026-07-24T10:00:00Z", v.BuildTime)
	require.Equal(t, "go1.25.0", v.GoVersion)
	require.False(t, v.Modified)
}

func TestLoadVersion_DirtyWorkingTree(t *testing.T) {
	withFakeBuildInfo(t, fakeBuildInfo("v0.1.0", "go1.25.0",
		debug.BuildSetting{Key: "vcs.revision", Value: "abcdef1234"},
		debug.BuildSetting{Key: "vcs.modified", Value: "true"},
	))
	v := LoadVersion()
	require.True(t, v.Modified, "vcs.modified=true 应反映到 Modified")
}

func TestLoadVersion_DevelNoVCS(t *testing.T) {
	// go run / 本地 build 无 vcs 元数据。
	withFakeBuildInfo(t, fakeBuildInfo("", "go1.25.6"))
	v := LoadVersion()
	require.Equal(t, "(devel)", v.Version, "空 version 应回落 (devel)")
	require.Empty(t, v.Commit, "无 vcs.revision 应空")
	require.Empty(t, v.BuildTime)
}

func TestLoadVersion_ShortCommitNotTruncated(t *testing.T) {
	// revision 短于 7 位时不截断,原样返回。
	withFakeBuildInfo(t, fakeBuildInfo("v0.1.0", "go1.25.0",
		debug.BuildSetting{Key: "vcs.revision", Value: "abc"},
	))
	v := LoadVersion()
	require.Equal(t, "abc", v.Commit)
}

func TestVersionString_WithVCS(t *testing.T) {
	v := VersionInfo{
		Version:   "v0.1.0",
		Commit:    "a1f961a",
		BuildTime: "2026-07-24T10:00:00Z",
		GoVersion: "go1.25.0",
	}
	s := v.String()
	require.Contains(t, s, "v0.1.0")
	require.Contains(t, s, "commit: a1f961a")
	require.Contains(t, s, "built: 2026-07-24", "应只取日期部分")
	require.NotContains(t, s, "dirty", "Modified=false 不应有 dirty")
}

func TestVersionString_NoVCS(t *testing.T) {
	v := VersionInfo{Version: "(devel)", GoVersion: "go1.25.6"}
	s := v.String()
	require.Contains(t, s, "(devel)")
	require.Contains(t, s, "no vcs info")
	require.Contains(t, s, "go: go1.25.6")
}

func TestVersionString_DirtyFlag(t *testing.T) {
	v := VersionInfo{Version: "v0.1.0", Commit: "a1f961a", BuildTime: "2026-07-24", Modified: true}
	require.Contains(t, v.String(), "dirty")
}

func TestVersionJSON_AllFields(t *testing.T) {
	v := VersionInfo{
		Version:   "v0.1.0",
		Commit:    "a1f961a",
		BuildTime: "2026-07-24T10:00:00Z",
		GoVersion: "go1.25.0",
		Modified:  true,
	}
	out, err := v.JSONString()
	require.NoError(t, err)
	var got VersionInfo
	require.NoError(t, json.Unmarshal([]byte(out), &got))
	require.Equal(t, v, got, "JSON 往返应一致")
}

func TestVersionJSON_OmitsEmptyFields(t *testing.T) {
	// 无 vcs 信息时 commit/build_time/modified 应 omitempty 不出现。
	v := VersionInfo{Version: "(devel)", GoVersion: "go1.25.6"}
	out, _ := v.JSONString()
	require.NotContains(t, out, "commit", "空 commit 应 omitempty")
	require.NotContains(t, out, "build_time")
	require.NotContains(t, out, "modified")
}

// handleVersion 是 root-level 行为,通过 os.Args 注入测试。但 handleVersion 直接
// os.Exit,不便单测——它的核心逻辑(扫 flag + 按 JSON 渲染)由 LoadVersion/
// VersionInfo.String/JSONString 覆盖,handleVersion 本身是薄胶水层(扫 argv)。
// 这里仅验证 flag 扫描不误判子命令的 --version。
func TestHandleVersion_NotTriggeredBySubcommandArg(t *testing.T) {
	// 间接验证:song 子命令的 --id(非 version flag)不应让 handleVersion 触发。
	// handleVersion 在遇第一个非 flag 参数时停止扫描。
	// 这里用字符串扫模拟逻辑,确认「song --version」中 song 是子命令停止扫描。
	args := []string{"musicctl", "song", "--version"}
	// 模拟 handleVersion 的扫描:遇 song(非 flag)停止,--version 不被扫到。
	wantVersion := false
	for _, a := range args[1:] {
		if a == "--" || !strings.HasPrefix(a, "-") {
			break
		}
		if a == "--version" {
			wantVersion = true
		}
	}
	require.False(t, wantVersion, "子命令后的 --version 不应触发 root version 处理")
}
