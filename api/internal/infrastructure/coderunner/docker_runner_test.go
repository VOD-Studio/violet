package coderunner

import (
	"testing"

	domaincoderunner "blog-api/internal/domain/coderunner"
)

func TestBuildHostConfig(t *testing.T) {
	t.Parallel()
	limits := domaincoderunner.ResourceLimits{
		CPUCores:     1.5,
		MemoryMB:     512,
		TimeoutSecs:  10,
		OutputBytes:  1024,
		AllowNetwork: false,
	}
	hc := BuildHostConfig(limits)

	// memory = 512MB = 512*1024*1024，memorySwap 应等于 memory（禁 swap）
	wantMem := int64(512 * 1024 * 1024)
	if hc.Memory != wantMem {
		t.Errorf("Memory = %d, want %d", hc.Memory, wantMem)
	}
	if hc.MemorySwap != wantMem {
		t.Errorf("MemorySwap = %d, want %d (= Memory, 禁 swap)", hc.MemorySwap, wantMem)
	}

	// CPU quota = 1.5 * 100000，period = 100000（字段在 Resources 子结构里）
	if hc.CPUPeriod != 100000 {
		t.Errorf("CPUPeriod = %d, want 100000", hc.CPUPeriod)
	}
	if hc.CPUQuota != int64(1.5*100000) {
		t.Errorf("CPUQuota = %d, want %d", hc.CPUQuota, int64(1.5*100000))
	}

	// 安全约束
	if hc.NetworkMode != "none" {
		t.Errorf("NetworkMode = %q, want none", hc.NetworkMode)
	}
	if !hc.ReadonlyRootfs {
		t.Error("ReadonlyRootfs 应为 true")
	}
	if hc.PidsLimit == nil || *hc.PidsLimit != 128 {
		t.Errorf("PidsLimit = %v, want 128（go 编译需更多进程）", hc.PidsLimit)
	}
	// cap_drop ALL（CapDrop 是 strslice.StrSlice，底层 []string）
	foundAll := false
	for _, c := range hc.CapDrop {
		if c == "ALL" {
			foundAll = true
			break
		}
	}
	if !foundAll {
		t.Error("CapDrop 应含 ALL")
	}
	// security_opt no-new-privileges
	foundNoNewPriv := false
	for _, s := range hc.SecurityOpt {
		if s == "no-new-privileges" {
			foundNoNewPriv = true
			break
		}
	}
	if !foundNoNewPriv {
		t.Error("SecurityOpt 应含 no-new-privileges")
	}

	// tmpfs 三个挂载点
	if hc.Tmpfs == nil {
		t.Fatal("Tmpfs 不应为 nil")
	}
	codeOpts, ok := hc.Tmpfs["/code"]
	if !ok {
		t.Fatal("缺少 /code tmpfs")
	}
	if !contains(codeOpts, "mode=1777") {
		t.Errorf("/code tmpfs = %q, 应含 mode=1777（podman 兼容，不用 uid=1000）", codeOpts)
	}
	tmpOpts, ok := hc.Tmpfs["/tmp"]
	if !ok {
		t.Fatal("缺少 /tmp tmpfs")
	}
	if !contains(tmpOpts, "exec") {
		t.Errorf("/tmp tmpfs = %q, 应含 exec（编译型语言需执行编译产物）", tmpOpts)
	}
	if _, ok := hc.Tmpfs["/run"]; !ok {
		t.Error("缺少 /run tmpfs")
	}

	// AutoRemove 必须为 false（需在容器结束后读日志/退出码）
	if hc.AutoRemove {
		t.Error("AutoRemove 应为 false（否则容器过早移除无法读日志）")
	}
}

func TestBuildHostConfig_AllowNetwork(t *testing.T) {
	t.Parallel()
	limits := domaincoderunner.ResourceLimits{AllowNetwork: true}
	hc := BuildHostConfig(limits)
	if hc.NetworkMode != "bridge" {
		t.Errorf("AllowNetwork=true 时 NetworkMode = %q, want bridge", hc.NetworkMode)
	}
}

func contains(s, substr string) bool {
	for i := 0; i+len(substr) <= len(s); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
