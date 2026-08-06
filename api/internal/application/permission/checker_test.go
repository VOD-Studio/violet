package permission

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"

	"blog-api/internal/application/mocks"
	domainrole "blog-api/internal/domain/role"
	domainshared "blog-api/internal/domain/shared"
)

// mustRoleName 构造测试用角色名，忽略校验错误。
func mustRoleName(s string) domainrole.RoleName {
	n, _ := domainrole.ParseRoleName(s)
	return n
}

// fakeChangedEvent 构造一个最小 DomainEvent，仅满足 HandleRolePermissionsChanged 签名。
// handler 不读 payload，事件名不参与断言，故用任意实现即可。
type fakeChangedEvent struct {
	domainshared.BaseEvent
}

// reconstructRole 重建一个带权限码的角色聚合（不记录事件，适合测试造数）。
func reconstructRole(name string, codes []string) *domainrole.Role {
	return domainrole.ReconstructRole(1, mustRoleName(name), "", codes, time.Time{}, time.Time{})
}

// TestChecker_SuperadminBypass 内置超管通配放行：拥有所有权限，无需查缓存。
func TestChecker_SuperadminBypass(t *testing.T) {
	repo := new(mocks.MockRoleRepository)
	// FindAll 不应被调用（超管短路）
	repo.AssertNotCalled(t, "FindAll")
	c := NewChecker(repo, time.Minute)

	if !c.HasPermission("any-role", true, "anything", "everything") {
		t.Fatal("内置超管应通配放行所有权限码")
	}
}

// TestChecker_DelegatedSuperadminRoleBypass superadmin 角色通配放行：
// 被委派超管（isBuiltinSuperAdmin=false 但 role=superadmin）同样拥有所有权限，
// 无需查缓存。锁住「superadmin 语义化」这一变更。
func TestChecker_DelegatedSuperadminRoleBypass(t *testing.T) {
	repo := new(mocks.MockRoleRepository)
	repo.AssertNotCalled(t, "FindAll")
	c := NewChecker(repo, time.Minute)

	if !c.HasPermission(domainrole.SuperadminRole, false, "anything", "everything") {
		t.Fatal("superadmin 角色应通配放行所有权限码")
	}
}

// TestChecker_NoCodesRequired 无权限码要求视为通过（仅做角色层校验的场景）。
func TestChecker_NoCodesRequired(t *testing.T) {
	repo := new(mocks.MockRoleRepository)
	c := NewChecker(repo, time.Minute)

	if !c.HasPermission("some-role", false) {
		t.Fatal("无权限码要求应直接通过")
	}
}

// TestChecker_NormalAllowDeny 非超管按缓存中的权限码判断放行/拒绝。
func TestChecker_NormalAllowDeny(t *testing.T) {
	repo := new(mocks.MockRoleRepository)
	repo.On("FindAll", mock.Anything).Return([]*domainrole.Role{
		reconstructRole("editor", []string{"post:view", "post:create"}),
	}, nil)
	c := NewChecker(repo, time.Minute)

	// 放行：拥有全部所需权限码
	if !c.HasPermission("editor", false, "post:view", "post:create") {
		t.Fatal("拥有全部权限码应放行")
	}
	// 拒绝：缺一个权限码
	if c.HasPermission("editor", false, "post:view", "post:delete") {
		t.Fatal("缺少任一权限码应拒绝")
	}
	repo.AssertNumberOfCalls(t, "FindAll", 1) // 缓存命中，只查一次
}

// TestChecker_EventTriggersReload 事件触发缓存重载——锁住本次修复的核心断链修复。
//
// 场景：第一次查询加载旧权限（不含 post:delete）→ 角色权限变更发事件 →
// 缓存被清空 → 第二次查询重新加载新权限（含 post:delete）。
// 修复前：事件无订阅方，第二次查询仍命中旧缓存，post:delete 判定错误（拒绝）。
func TestChecker_EventTriggersReload(t *testing.T) {
	repo := new(mocks.MockRoleRepository)

	// 第一次 FindAll 返回旧权限（不含 post:delete）
	oldPerms := []*domainrole.Role{
		reconstructRole("editor", []string{"post:view"}),
	}
	// 第二次 FindAll 返回新权限（含 post:delete）
	newPerms := []*domainrole.Role{
		reconstructRole("editor", []string{"post:view", "post:delete"}),
	}

	repo.On("FindAll", mock.Anything).Return(oldPerms, nil).Once()
	repo.On("FindAll", mock.Anything).Return(newPerms, nil).Once()

	c := NewChecker(repo, time.Hour) // 长 TTL，确保不靠过期触发重载

	// 初始：editor 无 post:delete 权限
	if c.HasPermission("editor", false, "post:delete") {
		t.Fatal("初始状态 editor 不应有 post:delete 权限")
	}

	// 模拟角色权限变更事件到达（修复前此调用链断裂）
	if err := c.HandleRolePermissionsChanged(context.Background(), fakeChangedEvent{}); err != nil {
		t.Fatalf("事件处理不应出错: %v", err)
	}

	// 事件后：缓存已清，重新加载，editor 现在有 post:delete 权限
	if !c.HasPermission("editor", false, "post:delete") {
		t.Fatal("事件触发重载后 editor 应有 post:delete 权限；若失败说明事件链未接通")
	}

	repo.AssertNumberOfCalls(t, "FindAll", 2) // 初始 + 事件后各一次
}

// TestChecker_RefreshClearsCache Refresh 手动清缓存，下次查询重新加载。
func TestChecker_RefreshClearsCache(t *testing.T) {
	repo := new(mocks.MockRoleRepository)
	repo.On("FindAll", mock.Anything).Return([]*domainrole.Role{
		reconstructRole("editor", []string{"post:view"}),
	}, nil)
	c := NewChecker(repo, time.Hour)

	_ = c.HasPermission("editor", false, "post:view") // 加载缓存
	c.Refresh()                                       // 清缓存
	_ = c.HasPermission("editor", false, "post:view") // 应重新加载

	repo.AssertNumberOfCalls(t, "FindAll", 2)
}
