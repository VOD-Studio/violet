package apitoken

import (
	"testing"
	"time"
)

func TestNewPAT_InteractiveDefaultTrue(t *testing.T) {
	p, _, err := NewPAT("u1", "日常", []string{ScopePostsRead}, time.Time{}, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if !p.Interactive() {
		t.Error("默认应 interactive=true（与现状行为一致）")
	}
}

func TestNewPAT_InteractiveExplicit(t *testing.T) {
	p, _, err := NewPAT("u1", "自动化脚本", []string{ScopePostsRead, ScopePostsWrite}, time.Time{}, time.Now(), WithInteractive(false))
	if err != nil {
		t.Fatal(err)
	}
	if p.Interactive() {
		t.Error("WithInteractive(false) 应生效")
	}
}

func TestReconstructPAT_Interactive(t *testing.T) {
	p := Reconstruct("id", "u1", "n", "h", []string{ScopePostsRead}, time.Time{}, time.Time{}, time.Time{}, false)
	if p.Interactive() {
		t.Error("Reconstruct 应透传 interactive=false")
	}
	// 兼容：老调用不传该参时 Go 默认 false，但语义上旧 token 均为交互式；
	// 仓储层 migration 用 DEFAULT true 兜底，领域层不补偿。
}
