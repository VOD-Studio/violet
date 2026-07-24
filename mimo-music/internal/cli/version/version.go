package version

import (
	"encoding/json"
	"fmt"
	"runtime/debug"
)

// VersionInfo 是 musicctl 的构建信息,经 debug.ReadBuildInfo() 读取。
//
// go install 安装时自动嵌入 module version + vcs revision/time;非 install 构建
// (如 go run / 本地 go build 无 vcs)则 version 为 (devel)、vcs 字段缺失。
// doctor(#41)的「版本」检查项复用本类型与读取函数。
type VersionInfo struct {
	Version   string `json:"version"`             // module version(go install 嵌入,否则 (devel))
	Commit    string `json:"commit,omitempty"`    // vcs.revision(短哈希)
	BuildTime string `json:"build_time,omitempty"` // vcs.time(RFC3339)
	GoVersion string `json:"go_version"`          // 编译用的 Go 版本
	Modified  bool   `json:"modified,omitempty"`   // vcs.modified:工作区有未提交改动
}

// readBuildInfo 是 debug.ReadBuildInfo 的可注入替身(测试用)。
var readBuildInfo = debug.ReadBuildInfo

// LoadVersion 从 build info 读取版本信息。
//
// 主信息来源:
//   - info.Main.Version:module version(go install 时为语义版本,否则 (devel))。
//   - info.Settings 里的 vcs.revision / vcs.time / vcs.modified(需 vcs 元数据)。
//   - info.GoVersion:编译用的 Go 版本。
//
// commit 取短哈希(前 7 位,与 git 默认一致)。
func LoadVersion() VersionInfo {
	info, ok := readBuildInfo()
	v := VersionInfo{GoVersion: info.GoVersion}
	if !ok {
		// 无 build info(理论上不会,main 包总有)——返回最小可用值。
		v.Version = "(unknown)"
		return v
	}
	v.Version = info.Main.Version
	if v.Version == "" {
		v.Version = "(devel)"
	}
	// vcs 信息在 Settings 里(键值对)。
	settings := map[string]string{}
	for _, s := range info.Settings {
		settings[s.Key] = s.Value
	}
	if rev, ok := settings["vcs.revision"]; ok && len(rev) > 7 {
		v.Commit = rev[:7]
	} else if ok {
		v.Commit = rev
	}
	v.BuildTime = settings["vcs.time"]
	v.Modified = settings["vcs.modified"] == "true"
	return v
}

// String 渲染人类可读的单行版本信息(供 cobra Version 模板用)。
// 例:`musicctl v0.1.0 (commit: 4a8047b, built: 2026-07-24, go: go1.25.0)`
// 无 vcs 信息时:`musicctl (devel, no vcs info)`
func (v VersionInfo) String() string {
	if v.Commit == "" {
		modified := ""
		if v.Modified {
			modified = ", dirty"
		}
		return fmt.Sprintf("musicctl %s (no vcs info%s, go: %s)", v.Version, modified, v.GoVersion)
	}
	dirty := ""
	if v.Modified {
		dirty = ", dirty"
	}
	buildTime := v.BuildTime
	if len(buildTime) >= 10 {
		buildTime = buildTime[:10] // 只取日期部分(去掉时间)
	}
	return fmt.Sprintf("musicctl %s (commit: %s, built: %s%s, go: %s)",
		v.Version, v.Commit, buildTime, dirty, v.GoVersion)
}

// JSONString 渲染结构化 JSON(--json 模式用)。
func (v VersionInfo) JSONString() (string, error) {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return "", err
	}
	return string(b), nil
}
