# 权限树形改造 + 内置保护 + 标签/公告菜单接入 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把扁平的 RBAC 权限表改造成 menu→action 两层真树（带内置保护），补齐权限页 CRUD UI，并接入标签管理（后端补 Update）与公告管理（前端从零）两个侧边栏菜单。

**Architecture:** 后端 DDD + CQRS（permission/role）与简化 service（tag/announcement）两种范式并存——按各自领域现有风格改。permissions 表加 `parent_id/type/sort/is_builtin` 4 列，插入 13 个 menu 分组节点；权限 CRUD 路由 key 从 `{code}` 改 `{id}`；前端用 DataTable 的 `expandable` 行渲染权限树，仿 roles 页做增删改查对话框。

**Tech Stack:** Go 1.25 + chi + GORM + PostgreSQL（迁移手写 SQL）；React 19 + TanStack Router/Query + shadcn/ui + Tailwind v4 + Biome。

**对应 spec:** `docs/superpowers/specs/2026-06-30-permission-tree-rbac-menus-design.md`

**提交结构（3 个 commit，按顺序）：**
- Phase 1 → commit `feat(permission): 权限树形化 + 内置保护 + CRUD UI`
- Phase 2 → commit `feat(admin/tags): 接入标签管理`
- Phase 3 → commit `feat(admin/announcements): 接入公告管理`

---

## 文件结构总览

### Phase 1（权限系统，commit `feat(permission)`）

**后端：**
- Create: `api/migrations/035_permission_tree.up.sql` — 加 4 列 + 13 menu 节点 + 挂载 action + 标记内置
- Create: `api/migrations/035_permission_tree.down.sql` — 回滚
- Modify: `api/internal/domain/permission/entity.go` — Code 正则放宽 + IsMenu + Permission 加字段 + UpdateCode guard + ErrCannotModifyBuiltin
- Modify: `api/internal/domain/permission/entity_test.go` — 补 menu code / 内置 guard 用例
- Modify: `api/internal/domain/permission/repository.go` — 接口加 FindByID、Delete(id) 改签名
- Modify: `api/internal/infrastructure/persistence/gorm/model/rbac.go` — Permission PO 加 4 字段
- Modify: `api/internal/infrastructure/persistence/gorm/permission_repo.go` — PO↔entity 映射 + FindByID + Delete(id) + ExistsByCode 不变
- Modify: `api/internal/application/role/dto.go` — PermissionDTO 加 type/parent_id/sort/is_builtin/children
- Modify: `api/internal/application/permission/query/permission_queries.go` — FindAll 改组装树
- Modify: `api/internal/application/permission/command/permission_commands.go` — Create 接 type/parent；Update/Delete 改 ID key + 内置 guard
- Modify: `api/internal/interfaces/http/handler/role/role.go` — Update/Delete 改读 {id}；Create/Update DTO 加字段
- Modify: `api/cmd/server/main.go:389-391` — 路由 {code}→{id}
- Modify: `api/internal/openapi/paths_admin_rbac.go` — 路径参数与 schema 同步

**前端：**
- Modify: `web/src/features/admin-permissions/model/types.ts` — PermissionDTO + Request 加字段
- Modify: `web/src/features/admin-permissions/api/client.ts` — updatePermission 改 apiPatch、deletePermission 确认 apiDelete（均 {id}）
- Modify: `web/src/features/admin-permissions/api/queries.ts` — 入参顺承 id（基本不变，核对）
- Create: `web/src/features/admin-permissions/ui/CreatePermissionDialog.tsx` — 新建/编辑对话框
- Modify: `web/src/features/admin-roles/ui/RolePermissionsDialog.tsx` — 消费树，删前缀分组
- Modify: `web/src/routes/admin.permissions.tsx` — 树形展示 + 增删改查 UI

### Phase 2（标签，commit `feat(admin/tags)`）

**后端：**
- Modify: `api/internal/application/tag/service.go` — 加 Update 方法 + UpdateInput
- Modify: `api/internal/interfaces/http/handler/tag/tag.go` — 加 Update handler
- Modify: `api/cmd/server/main.go:257-266` — tag 写操作加 RequirePermission + Patch/{id}
- Modify: `api/internal/openapi/paths_tag.go` — 补 PATCH 文档

**前端：**
- Modify: `web/src/features/tags/api/mutations.ts` — 加 useUpdateTag
- Modify: `web/src/features/tags/model/types.ts` — 加 UpdateTagRequest
- Create: `web/src/features/admin-tags/ui/TagDialog.tsx` — 新建/编辑共用对话框
- Create: `web/src/routes/admin.tags.tsx` — 管理页
- Modify: `web/src/features/admin-layout/ui/AdminNavConfig.ts` — 加标签菜单项

### Phase 3（公告，commit `feat(admin/announcements)`）

**前端（后端已完整）：**
- Create: `web/src/features/admin-announcements/model/types.ts`
- Create: `web/src/features/admin-announcements/api/keys.ts`
- Create: `web/src/features/admin-announcements/api/client.ts`
- Create: `web/src/features/admin-announcements/api/queries.ts`
- Create: `web/src/features/admin-announcements/ui/AnnouncementDialog.tsx`
- Create: `web/src/routes/admin.announcements.tsx`
- Modify: `web/src/features/admin-layout/ui/AdminNavConfig.ts` — 加公告菜单项

---

# Phase 1：权限系统改造

## Task 1.1：数据库迁移（加字段 + menu 节点）

**Files:**
- Create: `api/migrations/035_permission_tree.up.sql`
- Create: `api/migrations/035_permission_tree.down.sql`

- [ ] **Step 1: 写 up 迁移**

Create `api/migrations/035_permission_tree.up.sql`:

```sql
-- 权限树形化：加 parent_id / type / sort / is_builtin
ALTER TABLE permissions
    ADD COLUMN IF NOT EXISTS parent_id INT REFERENCES permissions(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS type      VARCHAR(10) NOT NULL DEFAULT 'action',
    ADD COLUMN IF NOT EXISTS sort      INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_builtin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_permissions_parent ON permissions(parent_id);

-- 13 个 module 分组节点（menu 类型，内置，按业务域排序）
INSERT INTO permissions (code, name, type, parent_id, sort, is_builtin) VALUES
    ('post','文章','menu',NULL,1,TRUE),
    ('comment','评论','menu',NULL,2,TRUE),
    ('tag','标签','menu',NULL,3,TRUE),
    ('media','素材','menu',NULL,4,TRUE),
    ('playlist','歌单','menu',NULL,5,TRUE),
    ('song','歌曲','menu',NULL,6,TRUE),
    ('emoji','表情','menu',NULL,7,TRUE),
    ('user','用户','menu',NULL,8,TRUE),
    ('project','项目','menu',NULL,9,TRUE),
    ('settings','设置','menu',NULL,10,TRUE),
    ('role','角色','menu',NULL,11,TRUE),
    ('announcement','公告','menu',NULL,12,TRUE),
    ('admin','系统','menu',NULL,13,TRUE)
ON CONFLICT (code) DO NOTHING;

-- 把现有 action 权限挂到对应 menu 下
UPDATE permissions p
SET parent_id = m.id
FROM permissions m
WHERE m.type = 'menu'
  AND p.type = 'action'
  AND p.code LIKE m.code || ':%';

-- 所有现存 action 标记为内置
UPDATE permissions SET is_builtin = TRUE WHERE type = 'action';
```

- [ ] **Step 2: 写 down 迁移**

Create `api/migrations/035_permission_tree.down.sql`:

```sql
-- 删除本次新增的 menu 分组节点（action 的 parent_id 由 ON DELETE CASCADE 自动置空会失败，
-- 因为 parent_id 无 ON DELETE SET NULL；先解除挂载再删 menu）
UPDATE permissions SET parent_id = NULL WHERE parent_id IS NOT NULL;

DELETE FROM permissions WHERE type = 'menu';

DROP INDEX IF EXISTS idx_permissions_parent;

ALTER TABLE permissions
    DROP COLUMN IF EXISTS is_builtin,
    DROP COLUMN IF EXISTS sort,
    DROP COLUMN IF EXISTS type,
    DROP COLUMN IF EXISTS parent_id;
```

- [ ] **Step 3: 执行迁移验证**

Run: `make migrate`（或项目实际迁移命令；若需手动：`cd api && go run ./cmd/migrate up` 或按 Makefile）

Expected: 迁移成功，无报错。可用以下 SQL 抽查（通过 psql 或 DB 工具）：
- `SELECT code, type, parent_id, is_builtin FROM permissions WHERE type='menu';` 应返回 13 行。
- `SELECT count(*) FROM permissions WHERE type='action' AND parent_id IS NULL;` 应为 0（所有 action 都挂上了）。

- [ ] **Step 4: Commit**

```bash
git add api/migrations/035_permission_tree.up.sql api/migrations/035_permission_tree.down.sql
git commit -m "feat(permission): 迁移 permissions 表为树形（parent_id/type/sort/is_builtin + 13 menu 节点）"
```

---

## Task 1.2：领域模型改造（Code 放宽 + Permission 加字段 + 内置 guard）

**Files:**
- Modify: `api/internal/domain/permission/entity.go`
- Modify: `api/internal/domain/permission/repository.go`

- [ ] **Step 1: 先写失败测试（Code 放宽 + IsMenu）**

Append to `api/internal/domain/permission/entity_test.go`（在 `TestParseCode` 的 tests 切片里补两条用例）：

找到 `TestParseCode` 中的 `tests` 切片，在 `{"too long", ...}` 之前插入：

```go
        {"valid menu code (no colon)", "post", "post", false},
        {"valid menu code single char", "a", "a", false},
```

> 注意：现有用例 `{"missing colon", "postcreate", "", true}` 仍应通过——`postcreate` 是多字符无冒号，新正则要求"无冒号时整体是一个 module 段"，`postcreate` 合法？需要确认。见 Step 2 正则说明：`^[a-z]+(:[a-z][a-z-]*)?$` 会把 `postcreate` 判为**合法 menu code**。这与原测试期望 `wantErr=true` 冲突。

**修正**：把原用例 `{"missing colon", "postcreate", "", true}` 改为期望合法：

```go
        {"no colon now valid as menu", "postcreate", "postcreate", false},
```

并删除 `{"missing action", "post:", "", true}`（仍合法失败，保留）和 `{"missing module", ":create", "", true}`（仍失败，保留）——这两条不变。

在文件末尾追加 IsMenu 与内置 guard 的测试：

```go
func TestCode_IsMenu(t *testing.T) {
	menu, _ := ParseCode("post")
	action, _ := ParseCode("post:create")
	if !menu.IsMenu() {
		t.Error("post 应为 menu")
	}
	if action.IsMenu() {
		t.Error("post:create 不应为 menu")
	}
}

func TestPermission_BuiltinGuard(t *testing.T) {
	code, _ := ParseCode("post:create")
	// 内置权限
	builtin := NewPermission(1, code, "创建文章", "", nil, "action", 0, true)
	if err := builtin.UpdateCode(code); err != ErrCannotModifyBuiltin {
		t.Errorf("内置权限改 code 应返回 ErrCannotModifyBuiltin, got %v", err)
	}
	// 内置权限仍可改名/描述/parent/sort
	builtin.UpdateName("新名")
	builtin.UpdateParent(nil)
	builtin.UpdateSort(5)
	if builtin.Name() != "新名" {
		t.Error("内置权限应可改名")
	}

	// 非内置权限可改 code
	custom, _ := ParseCode("custom:do")
	nonBuiltin := NewPermission(2, custom, "自定义", "", nil, "action", 0, false)
	newCode, _ := ParseCode("custom:done")
	if err := nonBuiltin.UpdateCode(newCode); err != nil {
		t.Errorf("非内置权限改 code 不应报错, got %v", err)
	}
	if nonBuiltin.Code().String() != "custom:done" {
		t.Error("非内置权限 code 未更新")
	}
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd api && go test ./internal/domain/permission/ -run 'TestParseCode|TestCode_IsMenu|TestPermission_BuiltinGuard' -v`

Expected: FAIL —— 编译错误（`NewPermission` 签名不匹配、`IsMenu`/`UpdateCode`/`UpdateParent`/`UpdateSort`/`ErrCannotModifyBuiltin` 未定义）。

- [ ] **Step 3: 改 entity.go**

Modify `api/internal/domain/permission/entity.go`:

**3a.** 顶部 import 加 `strings`：

```go
import (
	"regexp"
	"strings"

	"blog-api/internal/domain/shared"
)
```

**3b.** 放宽正则（冒号段可选）：

```go
// permissionCodePattern 权限代码格式：
// - menu 节点：纯 module 名，如 post、user
// - action 节点：module:action，如 post:create、comment:approve
var permissionCodePattern = regexp.MustCompile(`^[a-z]+(:[a-z][a-z-]*)?$`)
```

**3c.** 加 IsMenu 方法（在 `Equal` 之后）：

```go
// IsMenu 是否为 menu 分组节点（不含冒号）
func (c Code) IsMenu() bool { return !strings.Contains(c.value, ":") }
```

**3d.** `Permission` 结构体替换为（加 4 字段）：

```go
type Permission struct {
	id          int32
	code        Code
	name        string
	description string
	parentID    *int32  // nil 表示顶层（menu）节点
	permType    string   // "menu" | "action"
	sort        int
	isBuiltin   bool
}
```

**3e.** 替换 `NewPermission` 与所有 getter/mutator（替换原 `NewPermission` 到文件末尾的 `UpdateDescription`）：

```go
// NewPermission 创建权限点
func NewPermission(id int32, code Code, name, description string, parentID *int32, permType string, sort int, isBuiltin bool) *Permission {
	return &Permission{
		id:          id,
		code:        code,
		name:        name,
		description: description,
		parentID:    parentID,
		permType:    permType,
		sort:        sort,
		isBuiltin:   isBuiltin,
	}
}

func (p *Permission) ID() int32          { return p.id }
func (p *Permission) Code() Code         { return p.code }
func (p *Permission) Name() string       { return p.name }
func (p *Permission) Description() string { return p.description }
func (p *Permission) ParentID() *int32   { return p.parentID }
func (p *Permission) Type() string       { return p.permType }
func (p *Permission) Sort() int          { return p.sort }
func (p *Permission) IsBuiltin() bool    { return p.isBuiltin }

// UpdateName 更新权限显示名称（内置也可改）
func (p *Permission) UpdateName(name string) { p.name = name }

// UpdateDescription 更新权限描述（内置也可改）
func (p *Permission) UpdateDescription(desc string) { p.description = desc }

// UpdateParent 更新父节点（内置也可改）
func (p *Permission) UpdateParent(parentID *int32) { p.parentID = parentID }

// UpdateSort 更新排序（内置也可改）
func (p *Permission) UpdateSort(sort int) { p.sort = sort }

// UpdateCode 更新权限代码——内置权限禁止
func (p *Permission) UpdateCode(c Code) error {
	if p.isBuiltin {
		return ErrCannotModifyBuiltin
	}
	p.code = c
	return nil
}
```

**3f.** 新增错误（加在文件末尾）：

```go
// 领域错误（与 repository.go 的错误分开，放 entity 便于 command 层引用）
var (
	// ErrCannotModifyBuiltin 内置权限不可改 code 或删除
	ErrCannotModifyBuiltin = shared.BadRequest("内置权限不可修改代码或删除")
)
```

- [ ] **Step 4: 改 repository.go 接口（加 FindByID、Delete 改 id 签名）**

Modify `api/internal/domain/permission/repository.go`：

把接口体替换为：

```go
// PermissionRepository 权限点仓储接口（端口）
type PermissionRepository interface {
	// FindByID 按 ID 查找权限点
	FindByID(ctx context.Context, id int32) (*Permission, error)
	// FindByCode 按代码查找权限点
	FindByCode(ctx context.Context, code Code) (*Permission, error)
	// FindAll 查找所有权限点
	FindAll(ctx context.Context) ([]*Permission, error)
	// ExistsByCode 代码是否已存在
	ExistsByCode(ctx context.Context, code Code) (bool, error)

	// Save 保存权限点（新增或更新），返回数据库 ID
	Save(ctx context.Context, p *Permission) (int32, error)
	// Delete 按 ID 删除权限点（级联删除 role_permissions）
	Delete(ctx context.Context, id int32) error

	// CountRoles 统计使用该权限点的角色数（按 ID 判断是否可删除）
	CountRoles(ctx context.Context, id int32) (int64, error)
}
```

> 接口的领域错误（`ErrNotFound` 等）保持不变。

- [ ] **Step 5: 跑测试确认通过**

Run: `cd api && go test ./internal/domain/permission/ -v`

Expected: PASS。但此时仓储实现、application、handler 还没改，`go build ./...` 会失败——这是预期的，下一步处理。仅本包测试应通过。

- [ ] **Step 6: Commit**

```bash
git add api/internal/domain/permission/
git commit -m "feat(permission): 领域模型支持树形（Code 放宽 + parent/type/sort/is_builtin + 内置 guard）"
```

---

## Task 1.3：GORM 持久层适配

**Files:**
- Modify: `api/internal/infrastructure/persistence/gorm/model/rbac.go`
- Modify: `api/internal/infrastructure/persistence/gorm/permission_repo.go`

- [ ] **Step 1: PO 加字段**

Modify `api/internal/infrastructure/persistence/gorm/model/rbac.go`，把 `Permission` 结构体替换为：

```go
// Permission 权限点表持久化模型（对应 permissions 表）
type Permission struct {
	ID          int32     `gorm:"primaryKey;autoIncrement" json:"id"`
	Code        string    `gorm:"type:varchar(50);unique;not null" json:"code"`
	Name        string    `gorm:"type:varchar(100);not null" json:"name"`
	Description string    `gorm:"type:text" json:"description"`
	ParentID    *int32    `gorm:"column:parent_id" json:"parent_id"`
	Type        string    `gorm:"type:varchar(10);not null;default:action" json:"type"`
	Sort        int       `gorm:"not null;default:0" json:"sort"`
	IsBuiltin   bool      `gorm:"not null;default:false" json:"is_builtin"`
	CreatedAt   time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
}
```

- [ ] **Step 2: 改 permission_repo.go 映射 + FindByID + Delete(id) + CountRoles(id)**

Modify `api/internal/infrastructure/persistence/gorm/permission_repo.go`：

**2a.** `permissionToPO` 替换为：

```go
func permissionToPO(p *permission.Permission) model.Permission {
	return model.Permission{
		ID:          p.ID(),
		Code:        p.Code().String(),
		Name:        p.Name(),
		Description: p.Description(),
		ParentID:    p.ParentID(),
		Type:        p.Type(),
		Sort:        p.Sort(),
		IsBuiltin:   p.IsBuiltin(),
	}
}
```

**2b.** `permissionToDomain` 替换为：

```go
func permissionToDomain(po model.Permission) (*permission.Permission, error) {
	code, err := permission.ParseCode(po.Code)
	if err != nil {
		return nil, err
	}
	return permission.NewPermission(po.ID, code, po.Name, po.Description, po.ParentID, po.Type, po.Sort, po.IsBuiltin), nil
}
```

**2c.** 在 `FindByCode` 之前插入 `FindByID`：

```go
// FindByID 按 ID 查找权限点
func (r *PermissionRepository) FindByID(ctx context.Context, id int32) (*permission.Permission, error) {
	var po model.Permission
	err := r.db.WithContext(ctx).First(&po, id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, permission.ErrNotFound
		}
		return nil, domainshared.Internal("查询权限失败", err)
	}
	return permissionToDomain(po)
}
```

**2d.** `Delete` 改为按 id（替换原 `Delete(ctx, code Code)`）：

```go
// Delete 按 ID 删除权限点（级联删除 role_permissions 关联，由数据库 ON DELETE CASCADE 保证）
func (r *PermissionRepository) Delete(ctx context.Context, id int32) error {
	result := r.db.WithContext(ctx).Delete(&model.Permission{}, id)
	if result.Error != nil {
		return domainshared.Internal("删除权限失败", result.Error)
	}
	if result.RowsAffected == 0 {
		return permission.ErrNotFound
	}
	return nil
}
```

**2e.** `CountRoles` 改为按 id（替换原 `CountRoles(ctx, code Code)`）：

```go
// CountRoles 统计使用该权限点的角色数
func (r *PermissionRepository) CountRoles(ctx context.Context, id int32) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Table("role_permissions").
		Where("permission_id = ?", id).
		Count(&count).Error
	if err != nil {
		return 0, domainshared.Internal("统计权限使用数失败", err)
	}
	return count, nil
}
```

> `ExistsByCode`、`Save`、`FindAll`、`FindByCode` 主体不变（`Save` 持久化新字段已由 `permissionToPO` 覆盖）。

- [ ] **Step 3: 跑编译**

Run: `cd api && go build ./internal/infrastructure/...`

Expected: 编译通过（仓储实现已对齐新接口；但 application/handler 还引用旧接口方法，全量 build 仍会失败，下一步处理）。

- [ ] **Step 4: Commit**

```bash
git add api/internal/infrastructure/persistence/gorm/model/rbac.go api/internal/infrastructure/persistence/gorm/permission_repo.go
git commit -m "feat(permission): GORM 持久层适配树形字段 + FindByID/Delete(id)"
```

---

## Task 1.4：应用层（DTO 扩展 + 树聚合 + CRUD guard）

**Files:**
- Modify: `api/internal/application/role/dto.go`
- Modify: `api/internal/application/permission/query/permission_queries.go`
- Modify: `api/internal/application/permission/command/permission_commands.go`

- [ ] **Step 1: 扩展 PermissionDTO**

Modify `api/internal/application/role/dto.go`，把 `PermissionDTO` 替换为：

```go
// PermissionDTO 权限读模型（支持树形：menu 节点带 children）
type PermissionDTO struct {
	ID          int32          `json:"id"`
	Code        string         `json:"code"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Type        string         `json:"type"`              // "menu" | "action"
	ParentID    *int32         `json:"parent_id"`
	Sort        int            `json:"sort"`
	IsBuiltin   bool           `json:"is_builtin"`
	Children    []PermissionDTO `json:"children,omitempty"` // 仅 menu 有
}
```

- [ ] **Step 2: 改 ListPermissionsHandler 组装树**

Modify `api/internal/application/permission/query/permission_queries.go`，把 `Handle` 方法替换为：

```go
// Handle 执行查询所有权限点，返回 menu→action 两层树
func (h *ListPermissionsHandler) Handle(ctx context.Context) ([]approle.PermissionDTO, error) {
	perms, err := h.permRepo.FindAll(ctx)
	if err != nil {
		return nil, err
	}

	// 1. 全部转 DTO，按 sort 升序、id 升序排
	dtos := make([]approle.PermissionDTO, 0, len(perms))
	byID := make(map[int32]*approle.PermissionDTO, len(perms))
	for _, p := range perms {
		dto := approle.PermissionDTO{
			ID:          p.ID(),
			Code:        p.Code().String(),
			Name:        p.Name(),
			Description: p.Description(),
			Type:        p.Type(),
			ParentID:    p.ParentID(),
			Sort:        p.Sort(),
			IsBuiltin:   p.IsBuiltin(),
		}
		dtos = append(dtos, dto)
	}
	// 排序：sort 升序，再 id 升序
	sort.Slice(dtos, func(i, j int) bool {
		if dtos[i].Sort != dtos[j].Sort {
			return dtos[i].Sort < dtos[j].Sort
		}
		return dtos[i].ID < dtos[j].ID
	})
	for i := range dtos {
		byID[dtos[i].ID] = &dtos[i]
	}

	// 2. 挂载 children：把 action 挂到父 menu 的 Children
	roots := make([]approle.PermissionDTO, 0)
	for i := range dtos {
		dto := &dtos[i]
		if dto.ParentID == nil {
			roots = append(roots, *dto)
			continue
		}
		if parent, ok := byID[*dto.ParentID]; ok {
			parent.Children = append(parent.Children, *dto)
		} else {
			// 孤立 action（父不存在），作为顶层兜底
			roots = append(roots, *dto)
		}
	}
	return roots, nil
}
```

并给文件加 `"sort"` import：

```go
import (
	"context"
	"sort"

	approle "blog-api/internal/application/role"
	"blog-api/internal/domain/permission"
)
```

- [ ] **Step 3: 改 command 层（Create 加字段，Update/Delete 改 ID + 内置 guard）**

Modify `api/internal/application/permission/command/permission_commands.go`：

**3a.** `CreatePermissionInput` 加字段：

```go
type CreatePermissionInput struct {
	Code        string
	Name        string
	Description string
	Type        string  // "menu" | "action"
	ParentID    *int32  // action 必填指向 menu；menu 为 nil
	Sort        int
}
```

**3b.** `CreatePermissionHandler.Handle` 的"构造 + 持久化"段替换为（用新 NewPermission 签名，新建一律 isBuiltin=false）：

```go
	// 3. 构造 + 持久化
	p := permission.NewPermission(0, code, in.Name, in.Description, in.ParentID, in.Type, in.Sort, false)
	id, err := h.permRepo.Save(ctx, p)
	if err != nil {
		return CreatePermissionOutput{}, err
	}
```

> CreatePermissionInput 里 Type 若为空，默认填 "action"：在构造前加一行 `if in.Type == "" { in.Type = "action" }`。

**3c.** `UpdatePermissionInput` 改为 ID key + 可选字段：

```go
type UpdatePermissionInput struct {
	ID          int32
	Code        string  // 非空且与现有不同时，尝试改 code（内置会报错）
	Name        string
	Description string
	ParentID    *int32
	Sort        *int
}
```

**3d.** `UpdatePermissionHandler.Handle` 整体替换为：

```go
func (h *UpdatePermissionHandler) Handle(ctx context.Context, in UpdatePermissionInput) error {
	// 1. 加载现有权限
	p, err := h.permRepo.FindByID(ctx, in.ID)
	if err != nil {
		return err
	}

	// 2. 改 code（非空且不同时；内置由实体 guard 拦截）
	if in.Code != "" {
		newCode, err := permission.ParseCode(in.Code)
		if err != nil {
			return err
		}
		if !newCode.Equal(p.Code()) {
			if err := p.UpdateCode(newCode); err != nil {
				return err
			}
		}
	}
	// 3. 其余字段（内置也允许）
	if in.Name != "" {
		p.UpdateName(in.Name)
	}
	if in.Description != "" {
		p.UpdateDescription(in.Description)
	}
	p.UpdateParent(in.ParentID)
	if in.Sort != nil {
		p.UpdateSort(*in.Sort)
	}

	// 4. 持久化
	_, err = h.permRepo.Save(ctx, p)
	return err
}
```

**3e.** `DeletePermissionInput` 与 `DeletePermissionHandler.Handle` 改为 ID key + 内置 guard：

```go
type DeletePermissionInput struct {
	ID int32
}

// DeletePermissionHandler 删除权限点用例
//
// 业务规则：内置权限不可删除；正在被角色使用的权限点不可删除。
type DeletePermissionHandler struct {
	permRepo permission.PermissionRepository
}

func NewDeletePermissionHandler(repo permission.PermissionRepository) *DeletePermissionHandler {
	return &DeletePermissionHandler{permRepo: repo}
}

func (h *DeletePermissionHandler) Handle(ctx context.Context, in DeletePermissionInput) error {
	// 1. 加载，内置 guard
	p, err := h.permRepo.FindByID(ctx, in.ID)
	if err != nil {
		return err
	}
	if p.IsBuiltin() {
		return permission.ErrCannotModifyBuiltin
	}

	// 2. 使用中检查
	count, err := h.permRepo.CountRoles(ctx, in.ID)
	if err != nil {
		return err
	}
	if count > 0 {
		return permission.ErrInUse
	}

	// 3. 删除
	return h.permRepo.Delete(ctx, in.ID)
}
```

- [ ] **Step 4: 跑编译**

Run: `cd api && go build ./internal/application/...`

Expected: 通过。

- [ ] **Step 5: Commit**

```bash
git add api/internal/application/role/dto.go api/internal/application/permission/
git commit -m "feat(permission): 应用层返回权限树 + CRUD 内置 guard（ID key）"
```

---

## Task 1.5：HTTP handler + 路由（{code}→{id}）

**Files:**
- Modify: `api/internal/interfaces/http/handler/role/role.go`
- Modify: `api/cmd/server/main.go`

- [ ] **Step 1: 改 handler 的 Create/Update/Delete**

Modify `api/internal/interfaces/http/handler/role/role.go`：

**1a.** `CreatePermissionRequest` 加字段：

```go
type CreatePermissionRequest struct {
	Code        string `json:"code" validate:"required"`
	Name        string `json:"name" validate:"required"`
	Description string `json:"description"`
	Type        string `json:"type"`                 // "menu" | "action"，默认 action
	ParentID    *int32 `json:"parent_id"`
	Sort        int    `json:"sort"`
}
```

**1b.** `CreatePermission` handler 调用处替换为：

```go
	out, err := h.permCreate.Handle(r.Context(), apppermcmd.CreatePermissionInput{
		Code: req.Code, Name: req.Name, Description: req.Description,
		Type: req.Type, ParentID: req.ParentID, Sort: req.Sort,
	})
```

**1c.** `UpdatePermissionRequest` 替换为：

```go
type UpdatePermissionRequest struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description"`
	ParentID    *int32 `json:"parent_id"`
	Sort        *int   `json:"sort"`
}
```

**1d.** `UpdatePermission` handler 整体替换为（读 {id}）：

```go
func (h *Handler) UpdatePermission(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}

	var req UpdatePermissionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}

	if err := h.permUpdate.Handle(r.Context(), apppermcmd.UpdatePermissionInput{
		ID: int32(id), Code: req.Code, Name: req.Name, Description: req.Description,
		ParentID: req.ParentID, Sort: req.Sort,
	}); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "权限已更新")
}
```

**1e.** `DeletePermission` handler 整体替换为（读 {id}）：

```go
func (h *Handler) DeletePermission(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}

	if err := h.permDelete.Handle(r.Context(), apppermcmd.DeletePermissionInput{ID: int32(id)}); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "权限已删除")
}
```

- [ ] **Step 2: 改路由 {code}→{id}**

Modify `api/cmd/server/main.go`，找到（约 387-392 行）：

```go
			r.Group(func(r chi.Router) {
				r.Use(middleware.SuperAdminRequired)
				r.Post("/permissions", roleH.CreatePermission)          // 创建权限
				r.Patch("/permissions/{code}", roleH.UpdatePermission)  // 更新权限
				r.Delete("/permissions/{code}", roleH.DeletePermission) // 删除权限
			})
```

替换为：

```go
			r.Group(func(r chi.Router) {
				r.Use(middleware.SuperAdminRequired)
				r.Post("/permissions", roleH.CreatePermission)        // 创建权限
				r.Patch("/permissions/{id}", roleH.UpdatePermission)  // 更新权限
				r.Delete("/permissions/{id}", roleH.DeletePermission) // 删除权限
			})
```

- [ ] **Step 3: 全量编译 + 测试**

Run: `cd api && go build ./... && go test ./...`

Expected: 编译通过，测试通过。

- [ ] **Step 4: Commit**

```bash
git add api/internal/interfaces/http/handler/role/role.go api/cmd/server/main.go
git commit -m "feat(permission): handler/路由 CRUD 改用 {id} key + 接收树形字段"
```

---

## Task 1.6：OpenAPI 文档同步

**Files:**
- Modify: `api/internal/openapi/paths_admin_rbac.go`

- [ ] **Step 1: 同步路径参数与 schema**

Modify `api/internal/openapi/paths_admin_rbac.go`：

- 把权限 PATCH/DELETE 路径参数 `{code}` 全部改为 `{id}`（全局替换 `/permissions/{code}` → `/permissions/{id}`，以及对应的 `parameters` 描述里 "权限代码" → "权限 ID"）。
- 在 `PermissionDTO` schema（若该文件定义了的话）加 `type`、`parent_id`、`sort`、`is_builtin`、`children` 字段；在 Create/Update 请求 schema 加对应字段。

> 具体行号与结构以文件实际内容为准。若该文件用代码生成 schema（如反射 struct），则改 struct 的 json tag 即自动生效，本步只需改路径参数。

- [ ] **Step 2: 校验 openapi 不破坏**

Run: `cd api && go build ./internal/openapi/... && go test ./...`

Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add api/internal/openapi/paths_admin_rbac.go
git commit -m "docs(openapi): 权限 CRUD 路径参数改 {id} + 树形字段"
```

---

## Task 1.7：前端类型 + API 客户端（修契约）

**Files:**
- Modify: `web/src/features/admin-permissions/model/types.ts`
- Modify: `web/src/features/admin-permissions/api/client.ts`

- [ ] **Step 1: 扩展 types.ts**

Modify `web/src/features/admin-permissions/model/types.ts`，整体替换为：

```ts
/**
 * admin-permissions 模块类型定义
 */

/** 权限类型 */
export type PermissionType = "menu" | "action";

/**
 * PermissionDTO - 权限数据传输对象（支持树形）
 */
export interface PermissionDTO {
    id?: number;
    code?: string;
    name?: string;
    description?: string;
    type?: PermissionType;
    parent_id?: number | null;
    sort?: number;
    is_builtin?: boolean;
    children?: PermissionDTO[];
}

/**
 * CreatePermissionRequest - 创建权限请求
 */
export interface CreatePermissionRequest {
    code: string;
    name: string;
    description?: string;
    type?: PermissionType;
    parent_id?: number | null;
    sort?: number;
}

/**
 * UpdatePermissionRequest - 更新权限请求
 */
export interface UpdatePermissionRequest {
    code?: string;
    name?: string;
    description?: string;
    parent_id?: number | null;
    sort?: number;
}
```

- [ ] **Step 2: 修 client.ts（PUT→PATCH，确认 {id}）**

Modify `web/src/features/admin-permissions/api/client.ts`：

import 行把 `apiPut` 换成 `apiPatch`：

```ts
import { apiDelete, apiGet, apiPatch, apiPost } from "@/shared/api/request";
```

`updatePermission` 替换为：

```ts
/**
 * 更新权限
 *
 * PATCH /admin/permissions/{id}
 * 需要超级管理员权限
 */
export const updatePermission = async (
    id: number,
    data: UpdatePermissionRequest,
): Promise<PermissionDTO> => {
    return apiPatch<PermissionDTO>(`/admin/permissions/${id}`, data);
};
```

`createPermission` 的入参类型已是 `CreatePermissionRequest`（含新字段），无需改函数体。`deletePermission` 保持 `apiDelete` + `{id}`（已正确）。

- [ ] **Step 3: 类型检查**

Run: `cd web && npx tsc --noEmit`

Expected: 通过（`queries.ts` 引用未变，`{id, data}` 入参仍兼容）。

- [ ] **Step 4: Commit**

```bash
git add web/src/features/admin-permissions/model/types.ts web/src/features/admin-permissions/api/client.ts
git commit -m "feat(admin/permissions): 前端类型支持树形 + 修复 update 契约（PATCH/{id}）"
```

---

## Task 1.8：新建/编辑权限对话框

**Files:**
- Create: `web/src/features/admin-permissions/ui/CreatePermissionDialog.tsx`

- [ ] **Step 1: 写对话框组件**

Create `web/src/features/admin-permissions/ui/CreatePermissionDialog.tsx`:

```tsx
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@shared/ui/dialog";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@shared/ui/select";
import { Textarea } from "@shared/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
    useAdminPermissions,
    useCreatePermission,
    useUpdatePermission,
} from "../api/queries";
import type { PermissionDTO, PermissionType } from "../model/types";

interface CreatePermissionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** 传入则编辑模式，否则新建 */
    editing?: PermissionDTO | null;
}

/** code 校验：menu 允许纯 module 名，action 要求 module:action */
const codeSchema = z
    .string()
    .min(1, "权限代码不能为空")
    .max(50, "权限代码最多 50 字符")
    .regex(/^[a-z]+(:[a-z][a-z-]*)?$/, "格式：menu 为 post；action 为 post:create");

const baseSchema = z.object({
    name: z.string().min(1, "权限名称不能为空").max(100, "名称最多 100 字符"),
    description: z.string().max(500, "描述最多 500 字符").optional().or(z.literal("")),
    sort: z.coerce.number().int().min(0, "排序为非负整数").default(0),
});

type FormValues = z.infer<typeof baseSchema> & { code: string };

export function CreatePermissionDialog({
    open,
    onOpenChange,
    editing,
}: CreatePermissionDialogProps) {
    const isEdit = !!editing;
    const createPermission = useCreatePermission();
    const updatePermission = useUpdatePermission();
    const { data: permissions = [] } = useAdminPermissions();

    const [type, setType] = useState<PermissionType>("action");
    const [parentId, setParentId] = useState<string>("");

    // 仅 menu 节点可作为父
    const menus = permissions.filter((p) => p.type === "menu");

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        watch,
        formState: { errors },
    } = useForm<FormValues>({
        resolver: zodResolver(baseSchema as never),
        defaultValues: { code: "", name: "", description: "", sort: 0 },
    });

    const codeValue = watch("code");

    // 编辑模式初始化
    useEffect(() => {
        if (open && editing) {
            setType((editing.type as PermissionType) || "action");
            setParentId(editing.parent_id != null ? String(editing.parent_id) : "");
            setValue("code", editing.code || "");
            setValue("name", editing.name || "");
            setValue("description", editing.description || "");
            setValue("sort", editing.sort || 0);
        } else if (open) {
            setType("action");
            setParentId("");
            reset({ code: "", name: "", description: "", sort: 0 });
        }
    }, [open, editing, reset, setValue]);

    // 校验 code：action 必须有冒号
    const codeError =
        !codeValue ? "权限代码不能为空" :
        type === "action" && !codeValue.includes(":") ? "action 必须为 module:action 格式" :
        !/^[a-z]+(:[a-z][a-z-]*)?$/.test(codeValue) ? "格式不合法" :
        null;

    const onSubmit = (data: FormValues) => {
        if (codeError) return;
        if (isEdit && editing?.id) {
            updatePermission.mutate(
                {
                    id: editing.id,
                    data: {
                        name: data.name,
                        description: data.description || undefined,
                        // 内置不改 code；非内置可改
                        code: editing.is_builtin ? undefined : data.code,
                        parent_id: type === "action" && parentId ? Number(parentId) : null,
                        sort: data.sort,
                    },
                },
                { onSuccess: () => onOpenChange(false) },
            );
        } else {
            createPermission.mutate(
                {
                    code: data.code,
                    name: data.name,
                    description: data.description || undefined,
                    type,
                    parent_id: type === "action" && parentId ? Number(parentId) : null,
                    sort: data.sort,
                },
                { onSuccess: () => onOpenChange(false) },
            );
        }
    };

    const isBuiltin = !!editing?.is_builtin;
    const pending = createPermission.isPending || updatePermission.isPending;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "编辑权限" : "创建权限"}</DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "修改权限定义"
                            : "新建权限点（menu 为分组容器，action 为可授权操作）"}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {/* 类型 */}
                    <div className="space-y-2">
                        <Label>类型</Label>
                        <Select
                            value={type}
                            onValueChange={(v) => setType(v as PermissionType)}
                            disabled={isBuiltin || isEdit}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="action">action（操作权限）</SelectItem>
                                <SelectItem value="menu">menu（分组容器）</SelectItem>
                            </SelectContent>
                        </Select>
                        {isBuiltin && (
                            <p className="text-muted-foreground text-xs">
                                <Badge variant="secondary">内置</Badge> 类型不可更改
                            </p>
                        )}
                    </div>

                    {/* 父节点（action 必选） */}
                    {type === "action" && (
                        <div className="space-y-2">
                            <Label>
                                所属分组 <span className="text-destructive">*</span>
                            </Label>
                            <Select
                                value={parentId}
                                onValueChange={setParentId}
                                disabled={pending}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="选择 menu 分组" />
                                </SelectTrigger>
                                <SelectContent>
                                    {menus.map((m) => (
                                        <SelectItem key={m.id} value={String(m.id)}>
                                            {m.name} ({m.code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* 代码 */}
                    <div className="space-y-2">
                        <Label htmlFor="code">
                            权限代码 <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="code"
                            placeholder={type === "action" ? "如 post:create" : "如 post"}
                            disabled={isBuiltin || pending}
                            {...register("code")}
                        />
                        {(errors.code || codeError) && (
                            <p className="text-destructive text-sm">{codeError || errors.code?.message}</p>
                        )}
                        <p className="text-muted-foreground text-xs">
                            {type === "menu"
                                ? "纯小写字母，如 post、user"
                                : "module:action 全小写，如 post:create"}
                        </p>
                    </div>

                    {/* 名称 */}
                    <div className="space-y-2">
                        <Label htmlFor="name">
                            权限名称 <span className="text-destructive">*</span>
                        </Label>
                        <Input id="name" placeholder="如：创建文章" disabled={pending} {...register("name")} />
                        {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
                    </div>

                    {/* 描述 */}
                    <div className="space-y-2">
                        <Label htmlFor="description">描述</Label>
                        <Textarea
                            id="description"
                            rows={2}
                            disabled={pending}
                            {...register("description")}
                        />
                    </div>

                    {/* 排序 */}
                    <div className="space-y-2">
                        <Label htmlFor="sort">排序</Label>
                        <Input id="sort" type="number" min={0} disabled={pending} {...register("sort")} />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={pending}
                        >
                            取消
                        </Button>
                        <Button type="submit" disabled={pending || !!codeError}>
                            {pending && <Loader2 className="mr-1 size-4 animate-spin" />}
                            {isEdit ? "保存" : "创建"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 2: 类型检查**

Run: `cd web && npx tsc --noEmit`

Expected: 通过。若 `Select` 组件路径或 props 与项目不符，对照 `web/src/shared/ui/select.tsx` 调整导入与 API。

- [ ] **Step 3: Biome 检查**

Run: `cd web && npx biome check src/features/admin-permissions/ui/CreatePermissionDialog.tsx`

Expected: 通过（按提示 `--write` 自动修格式）。

- [ ] **Step 4: Commit**

```bash
git add web/src/features/admin-permissions/ui/CreatePermissionDialog.tsx
git commit -m "feat(admin/permissions): 新建/编辑权限对话框（menu/action + 父节点 + 内置只读）"
```

---

## Task 1.9：RolePermissionsDialog 消费树

**Files:**
- Modify: `web/src/features/admin-roles/ui/RolePermissionsDialog.tsx`

- [ ] **Step 1: 用树形数据替换前缀分组**

Modify `web/src/features/admin-roles/ui/RolePermissionsDialog.tsx`：

**1a.** 删除 `groupedPermissions` 的 `useMemo`（第 50-61 行那段按 `split(":")[0]` 分组的逻辑），改为直接用后端返回的树（顶层是 menu，children 是 action）：

```tsx
    // 后端已返回树：permissions 为 menu 数组，每个 menu.children 为其 action
    const menuTree = permissions; // type=menu 的顶层节点
```

**1b.** `handleToggleGroup` 改为按 menu 的 children 计算（接收一个 menu 对象）：

```tsx
    const handleToggleGroup = (menu: typeof permissions[number]) => {
        const groupCodes = (menu.children || [])
            .map((p) => p.code)
            .filter(Boolean) as string[];
        const allSelected = groupCodes.every((code) => selectedCodes.has(code));
        setSelectedCodes((prev) => {
            const next = new Set(prev);
            if (allSelected) {
                groupCodes.forEach((code) => next.delete(code));
            } else {
                groupCodes.forEach((code) => next.add(code));
            }
            return next;
        });
    };
```

**1c.** 渲染部分（第 121 行起 `Object.entries(groupedPermissions).map(...)`）替换为遍历 `menuTree`：

```tsx
                <div className="space-y-6">
                    {menuTree.map((menu) => {
                        const actions = menu.children || [];
                        if (actions.length === 0) return null;
                        const groupCodes = actions
                            .map((p) => p.code)
                            .filter(Boolean) as string[];
                        const selectedCount = groupCodes.filter((code) =>
                            selectedCodes.has(code),
                        ).length;
                        const allSelected =
                            groupCodes.length > 0 && selectedCount === groupCodes.length;
                        const someSelected = selectedCount > 0 && selectedCount < groupCodes.length;

                        return (
                            <div key={menu.id} className="space-y-3">
                                <div className="flex items-center justify-between border-b pb-2">
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id={`group-${menu.id}`}
                                            checked={allSelected}
                                            onCheckedChange={() => handleToggleGroup(menu)}
                                            className={
                                                someSelected
                                                    ? "data-[state=checked]:bg-primary/50"
                                                    : ""
                                            }
                                        />
                                        <Label
                                            htmlFor={`group-${menu.id}`}
                                            className="font-semibold text-sm cursor-pointer"
                                        >
                                            {menu.name}
                                        </Label>
                                        <Badge variant="secondary">
                                            {selectedCount}/{groupCodes.length}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-6">
                                    {actions.map((permission) => {
                                        if (!permission.code) return null;
                                        const isChecked = selectedCodes.has(permission.code);
                                        return (
                                            <div
                                                key={permission.id}
                                                className="flex items-start gap-3 p-2 rounded hover:bg-muted/50"
                                            >
                                                <Checkbox
                                                    id={`permission-${permission.id}`}
                                                    checked={isChecked}
                                                    onCheckedChange={() =>
                                                        handleToggle(permission.code!)
                                                    }
                                                />
                                                <div className="flex-1">
                                                    <Label
                                                        htmlFor={`permission-${permission.id}`}
                                                        className="font-medium cursor-pointer"
                                                    >
                                                        {permission.name}
                                                    </Label>
                                                    <p className="text-muted-foreground text-xs mt-0.5">
                                                        {permission.description}
                                                    </p>
                                                    <code className="text-primary text-xs">
                                                        {permission.code}
                                                    </code>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
```

> `handleToggle`（单个 action 勾选）保持不变。`useMemo` import 若不再使用可移除。

- [ ] **Step 2: 类型检查**

Run: `cd web && npx tsc --noEmit`

Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add web/src/features/admin-roles/ui/RolePermissionsDialog.tsx
git commit -m "refactor(admin/roles): 角色权限对话框消费后端权限树（去前缀分组）"
```

---

## Task 1.10：权限管理页树形展示 + CRUD

**Files:**
- Modify: `web/src/routes/admin.permissions.tsx`

- [ ] **Step 1: 改页面为树形 + 增删改查**

Modify `web/src/routes/admin.permissions.tsx`，整体替换为：

```tsx
import { ConfirmDialog } from "@features/admin-shared/ui/confirm-dialog";
import type { DataTableColumn } from "@features/admin-shared/ui/data-table";
import { DataTable } from "@features/admin-shared/ui/data-table";
import { PageShell } from "@features/admin-layout/ui/PageShell";
import { useIsSuperAdmin } from "@features/auth/hooks/usePermissions";
import { PermissionGuard } from "@features/auth/ui/PermissionGuard";
import { CreatePermissionDialog } from "@features/admin-permissions/ui/CreatePermissionDialog";
import { useAdminPermissions, useDeletePermission } from "@features/admin-permissions/api/queries";
import type { PermissionDTO } from "@features/admin-permissions/model/types";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/admin/permissions")({
    component: AdminPermissionsPage,
});

function AdminPermissionsPage() {
    const isSuperAdmin = useIsSuperAdmin();
    const { data: tree = [], isLoading, error, refetch } = useAdminPermissions();
    const deletePermission = useDeletePermission();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<PermissionDTO | null>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState<PermissionDTO | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    // 展开所有 menu 默认展开
    const allMenuKeys = useMemo(
        () => new Set(tree.filter((p) => p.type === "menu").map((p) => String(p.id))),
        [tree],
    );
    const expandedKeys = expanded.size ? expanded : allMenuKeys;

    const handleEdit = (p: PermissionDTO) => {
        setEditing(p);
        setDialogOpen(true);
    };
    const handleCreate = () => {
        setEditing(null);
        setDialogOpen(true);
    };
    const handleDelete = (p: PermissionDTO) => {
        setDeleting(p);
        setDeleteOpen(true);
    };
    const confirmDelete = () => {
        if (!deleting?.id) return;
        deletePermission.mutate(deleting.id, {
            onSuccess: () => {
                setDeleteOpen(false);
                setDeleting(null);
            },
        });
    };

    // 把树压平成可展开的两层行：menu 行 + 其下 action 行（action 仅在展开时显示）
    const flatRows = useMemo(() => {
        const rows: { row: PermissionDTO; depth: number; menuId: string }[] = [];
        tree.forEach((menu) => {
            rows.push({ row: menu, depth: 0, menuId: String(menu.id) });
            const isOpen = expandedKeys.has(String(menu.id));
            if (isOpen) {
                (menu.children || []).forEach((action) => {
                    rows.push({ row: action, depth: 1, menuId: String(menu.id) });
                });
            }
        });
        return rows;
    }, [tree, expandedKeys]);

    const columns: DataTableColumn<{ row: PermissionDTO; depth: number; menuId: string }>[] = [
        {
            key: "code",
            header: "代码",
            sortable: true,
            accessorKey: "row",
            cell: (r) => (
                <div className="flex items-center gap-2" style={{ paddingLeft: r.depth * 24 }}>
                    <code className="text-primary bg-primary/10 rounded px-2 py-0.5 text-sm">
                        {r.row.code}
                    </code>
                </div>
            ),
        },
        {
            key: "name",
            header: "名称",
            accessorKey: "row",
            cell: (r) => <span className="font-medium">{r.row.name}</span>,
        },
        {
            key: "type",
            header: "类型",
            cell: (r) => (
                <Badge variant={r.row.type === "menu" ? "default" : "outline"}>
                    {r.row.type === "menu" ? "分组" : "操作"}
                </Badge>
            ),
        },
        {
            key: "description",
            header: "描述",
            accessorKey: "row",
            ellipsis: true,
            cell: (r) => r.row.description || "-",
        },
        {
            key: "builtin",
            header: "内置",
            cell: (r) =>
                r.row.is_builtin ? (
                    <Badge variant="secondary">
                        <Lock className="size-3" /> 内置
                    </Badge>
                ) : null,
        },
        {
            key: "actions_col",
            header: "操作",
            sticky: "right",
            cell: (r) => {
                const isBuiltin = !!r.row.is_builtin;
                return (
                    <div className="flex items-center gap-2">
                        <PermissionGuard permission="admin:access">
                            <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => handleEdit(r.row)}
                                title="编辑"
                            >
                                <Pencil className="size-3.5" />
                            </Button>
                        </PermissionGuard>
                        <PermissionGuard permission="admin:access">
                            <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => handleDelete(r.row)}
                                disabled={isBuiltin}
                                title={isBuiltin ? "内置权限不可删除" : "删除"}
                            >
                                <Trash2 className="size-3.5" />
                            </Button>
                        </PermissionGuard>
                    </div>
                );
            },
        },
    ];

    return (
        <PageShell
            title="权限管理"
            description="管理系统权限定义（menu 分组 + action 操作）"
            action={
                isSuperAdmin ? (
                    <Button size="sm" onClick={handleCreate}>
                        <Plus className="size-3.5" />
                        新建权限
                    </Button>
                ) : null
            }
        >
            {/* 分组折叠控件 */}
            <div className="flex items-center gap-2 text-sm">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpanded(new Set(allMenuKeys))}
                >
                    全部展开
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setExpanded(new Set())}>
                    全部折叠
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        const ids = tree
                            .filter((p) => p.type === "menu")
                            .map((p) => String(p.id));
                        setExpanded((prev) => {
                            const next = new Set(prev);
                            ids.forEach((id) =>
                                next.has(id) ? next.delete(id) : next.add(id),
                            );
                            return next;
                        });
                    }}
                >
                    切换
                </Button>
            </div>

            <DataTable
                data={flatRows}
                columns={columns}
                keyExtractor={(r) => `${r.menuId}-${r.row.id}`}
                page={1}
                pageSize={flatRows.length}
                total={flatRows.length}
                onPageChange={() => {}}
                selectable={false}
                loading={isLoading}
                error={error ? new Error(error.message) : null}
                onRetry={() => refetch()}
                storageKey="admin-permissions-columns"
                caption="权限列表"
                emptyTitle="暂无权限"
                emptyDescription="系统中还没有定义任何权限"
            />

            <CreatePermissionDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />

            <ConfirmDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                onConfirm={confirmDelete}
                title="确认删除权限"
                description={`确定要删除权限 ${deleting?.name}（${deleting?.code}）吗？`}
                confirmLabel="删除"
                loading={deletePermission.isPending}
            />
        </PageShell>
    );
}
```

> 说明：此处不用 DataTable 自带的 `expandable`（它按单行 id 展开，而我们的 menu/action 是不同行），而是手动把树压平成"带 depth 缩进"的行，用顶部按钮统一控制展开。这样最贴合两层树且改动集中。`accessorKey: "row"` 取整个对象，cell 自行解析。

- [ ] **Step 2: 确认 ConfirmDialog / useIsSuperAdmin 路径**

Run: `cd web && ls src/features/admin-shared/ui/confirm-dialog src/features/auth/hooks/usePermissions.ts`

Expected: 两者都存在。若 `useIsSuperAdmin` 不在 `usePermissions.ts`，按实际路径调整 import。

- [ ] **Step 3: 类型检查 + Biome**

Run: `cd web && npx tsc --noEmit && npx biome check src/routes/admin.permissions.tsx`

Expected: 通过。

- [ ] **Step 4: Commit**

```bash
git add web/src/routes/admin.permissions.tsx
git commit -m "feat(admin/permissions): 权限页树形展示 + 增删改查（内置不可删）"
```

---

# Phase 2：标签管理接入

## Task 2.1：后端标签 Update（service + handler + 路由）

**Files:**
- Modify: `api/internal/application/tag/service.go`
- Modify: `api/internal/interfaces/http/handler/tag/tag.go`
- Modify: `api/cmd/server/main.go`

- [ ] **Step 1: service 加 Update**

Modify `api/internal/application/tag/service.go`，在 `Create` 之后插入：

```go
// UpdateInput 更新标签入参
type UpdateInput struct {
	ID   int32
	Name string
}

// Update 更新标签（重算 slug；若 slug 冲突则追加短 uuid）
func (s *Service) Update(ctx context.Context, in UpdateInput) (TagDTO, error) {
	t, err := s.repo.FindByID(ctx, in.ID)
	if err != nil {
		return TagDTO{}, err
	}
	newSlug := GenerateSlug(in.Name)
	// slug 变化且已被其他标签占用，追加短 uuid 避免冲突
	if newSlug != t.Slug() {
		exists, err := s.repo.ExistsBySlug(ctx, newSlug)
		if err != nil {
			return TagDTO{}, err
		}
		if exists {
			newSlug = newSlug + "-" + uuid.New().String()[:6]
		}
	}
	updated := domaintag.NewTag(t.ID(), in.Name, newSlug)
	if _, err := s.repo.Save(ctx, updated); err != nil {
		return TagDTO{}, err
	}
	return toDTO(updated), nil
}
```

> `uuid` 已在文件顶部 import（`GenerateSlug` 用到）。`Save` 的 ID!=0 分支已支持更新。

- [ ] **Step 2: handler 加 Update**

Modify `api/internal/interfaces/http/handler/tag/tag.go`，在 `Create` 之后、`Delete` 之前插入：

```go
// updateTagRequest 更新标签请求
type updateTagRequest struct {
	Name string `json:"name" validate:"required"`
}

// Update 更新标签（后台）
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	var req updateTagRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.Update(r.Context(), apptag.UpdateInput{ID: int32(id), Name: req.Name})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}
```

> handler 现未注入 validator；若需校验，构造时加 `validate: validator.New()`（参照 content handler）。本步先用 `if req.Name == ""` 简单兜底，或在 handler 顶部直接判空返回 400。最简：把 `validate:"required"` 留作文档，运行时加一行：

```go
	if req.Name == "" {
		response.RespondError(w, r, apptag.ErrNameExists) // 复用为 400 不合适
		return
	}
```

**修正**：用 shared.BadRequest。import 加 `domainshared "blog-api/internal/domain/shared"`，判空：

```go
	if req.Name == "" {
		response.RespondError(w, r, domainshared.BadRequest("标签名不能为空"))
		return
	}
```

- [ ] **Step 3: 路由加 RequirePermission + Patch/{id}**

Modify `api/cmd/server/main.go`（约 257-266 行），把 tag Route 块替换为：

```go
		// 标签（DDD tagContainer）
		tagH := tagContainer.TagHandler
		v1.Route("/tags", func(r chi.Router) {
			r.Get("/", tagH.List) // 标签列表（公开）

			r.Group(func(r chi.Router) {
				r.Use(middleware.Auth(tokenValidator, middleware.WithAccessCookie(cfg.Cookie.AccessName)))
				r.Use(middleware.AdminRequired)
				r.With(middleware.RequirePermission(permissionChecker, "tag:create")).
					Post("/", tagH.Create) // 创建标签
				r.With(middleware.RequirePermission(permissionChecker, "tag:update")).
					Patch("/{id}", tagH.Update) // 编辑标签（新增）
				r.With(middleware.RequirePermission(permissionChecker, "tag:delete")).
					Delete("/{id}", tagH.Delete) // 删除标签
			})
		})
```

> `permission` 与 `permissionChecker` 在该作用域已存在（其他路由在用）。

- [ ] **Step 4: 编译 + 测试**

Run: `cd api && go build ./... && go test ./...`

Expected: 通过。

- [ ] **Step 5: Commit**

```bash
git add api/internal/application/tag/service.go api/internal/interfaces/http/handler/tag/tag.go api/cmd/server/main.go
git commit -m "feat(tag): 后端补 Update 接口 + tag 写操作细粒度权限"
```

---

## Task 2.2：OpenAPI 标签 Update 文档

**Files:**
- Modify: `api/internal/openapi/paths_tag.go`

- [ ] **Step 1: 补 PATCH /tags/{id} 文档**

Modify `api/internal/openapi/paths_tag.go`，仿照现有 POST/DELETE 的写法，加一条 `PATCH /api/v1/tags/{id}` 路径项：请求体 `{name: string}`，响应 `TagDTO`，并补 `tag:update` 权限说明。

> 具体结构对照该文件已有 POST 块复制改写。

- [ ] **Step 2: 编译**

Run: `cd api && go build ./internal/openapi/...`

Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add api/internal/openapi/paths_tag.go
git commit -m "docs(openapi): 补标签 Update 接口文档"
```

---

## Task 2.3：前端标签 data layer + 对话框 + 页面 + 侧边栏

**Files:**
- Modify: `web/src/features/tags/model/types.ts`
- Modify: `web/src/features/tags/api/mutations.ts`
- Create: `web/src/features/admin-tags/ui/TagDialog.tsx`
- Create: `web/src/routes/admin.tags.tsx`
- Modify: `web/src/features/admin-layout/ui/AdminNavConfig.ts`

- [ ] **Step 1: types.ts 加 UpdateTagRequest**

Modify `web/src/features/tags/model/types.ts`，在文件末尾追加：

```ts
/**
 * UpdateTagRequest - 更新标签请求体
 */
export interface UpdateTagRequest {
    /** 标签名，必填 */
    name: string;
}
```

- [ ] **Step 2: mutations.ts 加 useUpdateTag**

Modify `web/src/features/tags/api/mutations.ts`：

import 行加 `apiPatch`：

```ts
import { apiDelete, apiPatch, apiPost } from "@shared/api/request";
```

并 import `UpdateTagRequest`：

```ts
import type { CreateTag, Tag, UpdateTagRequest } from "../model/types";
```

在 `useDeleteTag` 之前追加：

```ts
/**
 * useUpdateTag - 更新标签 mutation
 *
 * 对接 PATCH /api/v1/tags/{id}，成功后 invalidate 标签列表。
 */
export const useUpdateTag = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, body }: { id: number; body: UpdateTagRequest }) =>
            apiPatch<Tag>(`/tags/${id}`, body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: tagKeys.lists() });
        },
    });
};
```

- [ ] **Step 3: 写 TagDialog（新建/编辑共用）**

Create `web/src/features/admin-tags/ui/TagDialog.tsx`:

```tsx
import { Button } from "@shared/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@shared/ui/dialog";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useCreateTag, useUpdateTag } from "@features/tags/api/mutations";
import type { Tag } from "@features/tags/model/types";

const tagSchema = z.object({
    name: z.string().min(1, "标签名不能为空").max(50, "标签名最多 50 字符"),
});
type TagForm = z.infer<typeof tagSchema>;

interface TagDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editing?: Tag | null;
}

export function TagDialog({ open, onOpenChange, editing }: TagDialogProps) {
    const isEdit = !!editing;
    const createTag = useCreateTag();
    const updateTag = useUpdateTag();
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<TagForm>({
        resolver: zodResolver(tagSchema),
        defaultValues: { name: "" },
    });

    useEffect(() => {
        if (open) {
            reset({ name: editing?.name || "" });
        }
    }, [open, editing, reset]);

    const onSubmit = (data: TagForm) => {
        if (isEdit && editing?.id) {
            updateTag.mutate(
                { id: editing.id, body: { name: data.name } },
                { onSuccess: () => onOpenChange(false) },
            );
        } else {
            createTag.mutate({ name: data.name }, { onSuccess: () => onOpenChange(false) });
        }
    };

    const pending = createTag.isPending || updateTag.isPending;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "编辑标签" : "创建标签"}</DialogTitle>
                    <DialogDescription>
                        {isEdit ? "修改标签名称（slug 将自动重算）" : "新建一个标签"}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="tag-name">
                            标签名 <span className="text-destructive">*</span>
                        </Label>
                        <Input id="tag-name" disabled={pending} {...register("name")} />
                        {errors.name && (
                            <p className="text-destructive text-sm">{errors.name.message}</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={pending}
                        >
                            取消
                        </Button>
                        <Button type="submit" disabled={pending}>
                            {pending && <Loader2 className="mr-1 size-4 animate-spin" />}
                            {isEdit ? "保存" : "创建"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 4: 写标签管理页**

Create `web/src/routes/admin.tags.tsx`:

```tsx
import { ConfirmDialog } from "@features/admin-shared/ui/confirm-dialog";
import type { DataTableColumn } from "@features/admin-shared/ui/data-table";
import { DataTable } from "@features/admin-shared/ui/data-table";
import { PageShell } from "@features/admin-layout/ui/PageShell";
import { TagDialog } from "@features/admin-tags/ui/TagDialog";
import { useTags } from "@features/tags/api/queries";
import { useDeleteTag } from "@features/tags/api/mutations";
import type { Tag } from "@features/tags/model/types";
import { Button } from "@shared/ui/button";
import { PermissionGuard } from "@features/auth/ui/PermissionGuard";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/admin/tags")({
    component: AdminTagsPage,
});

function AdminTagsPage() {
    const { data: tags = [], isLoading, error, refetch } = useTags();
    const deleteTag = useDeleteTag();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Tag | null>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState<Tag | null>(null);

    const handleEdit = (t: Tag) => {
        setEditing(t);
        setDialogOpen(true);
    };
    const handleCreate = () => {
        setEditing(null);
        setDialogOpen(true);
    };
    const handleDelete = (t: Tag) => {
        setDeleting(t);
        setDeleteOpen(true);
    };
    const confirmDelete = () => {
        if (!deleting?.id) return;
        deleteTag.mutate(deleting.id, {
            onSuccess: () => {
                setDeleteOpen(false);
                setDeleting(null);
            },
        });
    };

    const columns: DataTableColumn<Tag>[] = [
        {
            key: "name",
            header: "标签名",
            sortable: true,
            cell: (row) => <span className="font-medium">{row.name}</span>,
        },
        {
            key: "slug",
            header: "Slug",
            cell: (row) => (
                <code className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-xs">
                    {row.slug}
                </code>
            ),
        },
        {
            key: "actions_col",
            header: "操作",
            sticky: "right",
            cell: (row) => (
                <div className="flex items-center gap-2">
                    <PermissionGuard permission="tag:update">
                        <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => handleEdit(row)}
                            title="编辑"
                        >
                            <Pencil className="size-3.5" />
                        </Button>
                    </PermissionGuard>
                    <PermissionGuard permission="tag:delete">
                        <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => handleDelete(row)}
                            title="删除"
                        >
                            <Trash2 className="size-3.5" />
                        </Button>
                    </PermissionGuard>
                </div>
            ),
        },
    ];

    return (
        <PageShell
            title="标签管理"
            description="管理文章标签"
            action={
                <PermissionGuard permission="tag:create">
                    <Button size="sm" onClick={handleCreate}>
                        <Plus className="size-3.5" />
                        创建标签
                    </Button>
                </PermissionGuard>
            }
        >
            <DataTable<Tag>
                data={tags}
                columns={columns}
                keyExtractor={(row) => String(row.id)}
                page={1}
                pageSize={tags.length}
                total={tags.length}
                onPageChange={() => {}}
                selectable={false}
                loading={isLoading}
                error={error ? new Error(error.message) : null}
                onRetry={() => refetch()}
                storageKey="admin-tags-columns"
                caption="标签列表"
                emptyTitle="暂无标签"
                emptyDescription="还没有创建任何标签"
            />
            <TagDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
            <ConfirmDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                onConfirm={confirmDelete}
                title="确认删除标签"
                description={`确定要删除标签 ${deleting?.name} 吗？`}
                confirmLabel="删除"
                loading={deleteTag.isPending}
            />
        </PageShell>
    );
}
```

> 核对：`useTags` 在 `@features/tags/api/queries`，`useDeleteTag` 在 `@features/tags/api/mutations`（现状只有 mutations 有删除 hook）。两者均存在。

- [ ] **Step 5: 侧边栏加标签项**

Modify `web/src/features/admin-layout/ui/AdminNavConfig.ts`：

import 行加 `Tag`：

```ts
import { Images, LayoutDashboard, Shield, Smile, Tag, UserCog, Users } from "lucide-react";
```

`ADMIN_NAV_ITEMS` 数组在"权限管理"之后加一项（顺序：概览/用户/角色/权限/标签/素材/表情）：

```ts
    { label: "标签管理", to: "/admin/tags", icon: Tag },
```

- [ ] **Step 6: 类型检查 + Biome + 生成路由**

Run: `cd web && npx tsc --noEmit && npx biome check src/features/tags src/features/admin-tags src/routes/admin.tags.tsx src/features/admin-layout/ui/AdminNavConfig.ts`

> TanStack Router 文件路由会在 dev/build 时自动生成 `routeTree.gen.ts`。若 tsc 报 `admin.tags` 路由未注册，先跑 `npm run dev` 一次触发生成，或执行项目对应的 codegen 命令。

Expected: 通过。

- [ ] **Step 7: Commit**

```bash
git add web/src/features/tags web/src/features/admin-tags web/src/routes/admin.tags.tsx web/src/features/admin-layout/ui/AdminNavConfig.ts web/src/routeTree.gen.ts
git commit -m "feat(admin/tags): 接入标签管理（data layer + 页面 + 侧边栏）"
```

---

# Phase 3：公告管理接入

## Task 3.1：公告 data layer（types + keys + client + queries）

**Files:**
- Create: `web/src/features/admin-announcements/model/types.ts`
- Create: `web/src/features/admin-announcements/api/keys.ts`
- Create: `web/src/features/admin-announcements/api/client.ts`
- Create: `web/src/features/admin-announcements/api/queries.ts`

> 字段对齐后端 `application/announcement/service.go` 的 `AnnouncementDTO`：`id, title, content, type, is_active, start_time?, end_time?, created_at`。type 枚举：`info|warning|success|error`。时间字段为 RFC3339 字符串。

- [ ] **Step 1: types.ts**

Create `web/src/features/admin-announcements/model/types.ts`:

```ts
/**
 * admin-announcements 模块类型定义
 * 对齐后端 application/announcement.AnnouncementDTO
 */

export type AnnouncementType = "info" | "warning" | "success" | "error";

export interface AnnouncementDTO {
    id: number;
    title: string;
    content: string;
    type: AnnouncementType;
    is_active: boolean;
    /** RFC3339 字符串，可选 */
    start_time?: string;
    /** RFC3339 字符串，可选 */
    end_time?: string;
    created_at: string;
}

export interface CreateAnnouncementRequest {
    title: string;
    content: string;
    type: AnnouncementType;
    is_active?: boolean;
    start_time?: string;
    end_time?: string;
}

export interface UpdateAnnouncementRequest {
    title: string;
    content: string;
    type: AnnouncementType;
    is_active?: boolean;
    start_time?: string;
    end_time?: string;
}
```

- [ ] **Step 2: keys.ts**

Create `web/src/features/admin-announcements/api/keys.ts`:

```ts
export const announcementKeys = {
    all: ["announcements"] as const,
    lists: () => [...announcementKeys.all, "list"] as const,
    list: () => [...announcementKeys.lists()] as const,
    detail: (id: number) => [...announcementKeys.all, "detail", id] as const,
};
```

- [ ] **Step 3: client.ts**

Create `web/src/features/admin-announcements/api/client.ts`:

```ts
/**
 * admin-announcements API 客户端
 */
import { apiDelete, apiGet, apiPatch, apiPost } from "@/shared/api/request";
import type {
    AnnouncementDTO,
    CreateAnnouncementRequest,
    UpdateAnnouncementRequest,
} from "../model/types";

const BASE = "/admin/announcements";

export const listAnnouncements = async (): Promise<AnnouncementDTO[]> =>
    apiGet<AnnouncementDTO[]>(BASE);

export const getAnnouncement = async (id: number): Promise<AnnouncementDTO> =>
    apiGet<AnnouncementDTO>(`${BASE}/${id}`);

export const createAnnouncement = async (
    body: CreateAnnouncementRequest,
): Promise<{ id: number }> => apiPost<{ id: number }>(BASE, body);

export const updateAnnouncement = async (
    id: number,
    body: UpdateAnnouncementRequest,
): Promise<void> => apiPatch<void>(`${BASE}/${id}`, body);

export const deleteAnnouncement = async (id: number): Promise<void> =>
    apiDelete<void>(`${BASE}/${id}`);
```

- [ ] **Step 4: queries.ts**

Create `web/src/features/admin-announcements/api/queries.ts`:

```ts
/**
 * admin-announcements TanStack Query Hooks
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "./client";
import { announcementKeys } from "./keys";
import type { CreateAnnouncementRequest, UpdateAnnouncementRequest } from "../model/types";

export const useAdminAnnouncements = () =>
    useQuery({
        queryKey: announcementKeys.list(),
        queryFn: () => api.listAnnouncements(),
    });

export const useCreateAnnouncement = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: CreateAnnouncementRequest) => api.createAnnouncement(body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: announcementKeys.lists() });
            toast.success("公告创建成功");
        },
        onError: (e: Error) => toast.error(`创建公告失败：${e.message}`),
    });
};

export const useUpdateAnnouncement = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, body }: { id: number; body: UpdateAnnouncementRequest }) =>
            api.updateAnnouncement(id, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: announcementKeys.lists() });
            toast.success("公告更新成功");
        },
        onError: (e: Error) => toast.error(`更新公告失败：${e.message}`),
    });
};

export const useDeleteAnnouncement = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => api.deleteAnnouncement(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: announcementKeys.lists() });
            toast.success("公告删除成功");
        },
        onError: (e: Error) => toast.error(`删除公告失败：${e.message}`),
    });
};
```

- [ ] **Step 5: 类型检查**

Run: `cd web && npx tsc --noEmit`

Expected: 通过。

- [ ] **Step 6: Commit**

```bash
git add web/src/features/admin-announcements
git commit -m "feat(admin/announcements): 公告管理 data layer（types/keys/client/queries）"
```

---

## Task 3.2：公告对话框 + 页面 + 侧边栏

**Files:**
- Create: `web/src/features/admin-announcements/ui/AnnouncementDialog.tsx`
- Create: `web/src/routes/admin.announcements.tsx`
- Modify: `web/src/features/admin-layout/ui/AdminNavConfig.ts`

- [ ] **Step 1: 写 AnnouncementDialog**

Create `web/src/features/admin-announcements/ui/AnnouncementDialog.tsx`:

```tsx
import { Button } from "@shared/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@shared/ui/dialog";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@shared/ui/select";
import { Switch } from "@shared/ui/switch";
import { Textarea } from "@shared/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
    useCreateAnnouncement,
    useUpdateAnnouncement,
} from "../api/queries";
import type { AnnouncementDTO, AnnouncementType } from "../model/types";

const schema = z.object({
    title: z.string().min(1, "标题不能为空").max(200, "标题最多 200 字符"),
    content: z.string().min(1, "内容不能为空"),
});
type FormValues = z.infer<typeof schema>;

interface AnnouncementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editing?: AnnouncementDTO | null;
}

const TYPE_OPTIONS: { value: AnnouncementType; label: string }[] = [
    { value: "info", label: "信息" },
    { value: "warning", label: "警告" },
    { value: "success", label: "成功" },
    { value: "error", label: "错误" },
];

export function AnnouncementDialog({ open, onOpenChange, editing }: AnnouncementDialogProps) {
    const isEdit = !!editing;
    const createAnn = useCreateAnnouncement();
    const updateAnn = useUpdateAnnouncement();

    const [type, setType] = useState<AnnouncementType>("info");
    const [isActive, setIsActive] = useState(true);
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { title: "", content: "" },
    });

    useEffect(() => {
        if (open) {
            reset({
                title: editing?.title || "",
                content: editing?.content || "",
            });
            setType(editing?.type || "info");
            setIsActive(editing?.is_active ?? true);
            setStartTime(editing?.start_time ? editing.start_time.slice(0, 16) : "");
            setEndTime(editing?.end_time ? editing.end_time.slice(0, 16) : "");
        }
    }, [open, editing, reset]);

    const toRFC3339 = (local: string) => {
        if (!local) return undefined;
        // local 是 datetime-local 格式 "YYYY-MM-DDTHH:mm"，补秒+时区
        const d = new Date(local);
        return isNaN(d.getTime()) ? undefined : d.toISOString();
    };

    const onSubmit = (data: FormValues) => {
        const payload = {
            title: data.title,
            content: data.content,
            type,
            is_active: isActive,
            start_time: toRFC3339(startTime),
            end_time: toRFC3339(endTime),
        };
        if (isEdit && editing?.id) {
            updateAnn.mutate(
                { id: editing.id, body: payload },
                { onSuccess: () => onOpenChange(false) },
            );
        } else {
            createAnn.mutate(payload, { onSuccess: () => onOpenChange(false) });
        }
    };

    const pending = createAnn.isPending || updateAnn.isPending;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "编辑公告" : "创建公告"}</DialogTitle>
                    <DialogDescription>
                        {isEdit ? "修改公告内容与生效设置" : "新建一条站点公告"}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="ann-title">
                            标题 <span className="text-destructive">*</span>
                        </Label>
                        <Input id="ann-title" disabled={pending} {...register("title")} />
                        {errors.title && (
                            <p className="text-destructive text-sm">{errors.title.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="ann-type">类型</Label>
                        <Select value={type} onValueChange={(v) => setType(v as AnnouncementType)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {TYPE_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="ann-content">
                            内容 <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                            id="ann-content"
                            rows={4}
                            disabled={pending}
                            {...register("content")}
                        />
                        {errors.content && (
                            <p className="text-destructive text-sm">{errors.content.message}</p>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <Switch checked={isActive} onCheckedChange={setIsActive} id="ann-active" />
                        <Label htmlFor="ann-active">启用</Label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="ann-start">生效开始（可选）</Label>
                            <Input
                                id="ann-start"
                                type="datetime-local"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                disabled={pending}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ann-end">生效结束（可选）</Label>
                            <Input
                                id="ann-end"
                                type="datetime-local"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                disabled={pending}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={pending}
                        >
                            取消
                        </Button>
                        <Button type="submit" disabled={pending}>
                            {pending && <Loader2 className="mr-1 size-4 animate-spin" />}
                            {isEdit ? "保存" : "创建"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 2: 写公告管理页**

Create `web/src/routes/admin.announcements.tsx`:

```tsx
import { ConfirmDialog } from "@features/admin-shared/ui/confirm-dialog";
import type { DataTableColumn } from "@features/admin-shared/ui/data-table";
import { DataTable } from "@features/admin-shared/ui/data-table";
import { PageShell } from "@features/admin-layout/ui/PageShell";
import { AnnouncementDialog } from "@features/admin-announcements/ui/AnnouncementDialog";
import {
    useAdminAnnouncements,
    useDeleteAnnouncement,
} from "@features/admin-announcements/api/queries";
import type { AnnouncementDTO, AnnouncementType } from "@features/admin-announcements/model/types";
import { PermissionGuard } from "@features/auth/ui/PermissionGuard";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/admin/announcements")({
    component: AdminAnnouncementsPage,
});

const TYPE_LABEL: Record<AnnouncementType, string> = {
    info: "信息",
    warning: "警告",
    success: "成功",
    error: "错误",
};

function formatTime(s?: string): string {
    if (!s) return "—";
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleString("zh-CN");
}

function AdminAnnouncementsPage() {
    const { data: announcements = [], isLoading, error, refetch } = useAdminAnnouncements();
    const deleteAnn = useDeleteAnnouncement();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<AnnouncementDTO | null>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState<AnnouncementDTO | null>(null);

    const handleEdit = (a: AnnouncementDTO) => {
        setEditing(a);
        setDialogOpen(true);
    };
    const handleCreate = () => {
        setEditing(null);
        setDialogOpen(true);
    };
    const handleDelete = (a: AnnouncementDTO) => {
        setDeleting(a);
        setDeleteOpen(true);
    };
    const confirmDelete = () => {
        if (!deleting?.id) return;
        deleteAnn.mutate(deleting.id, {
            onSuccess: () => {
                setDeleteOpen(false);
                setDeleting(null);
            },
        });
    };

    const columns: DataTableColumn<AnnouncementDTO>[] = [
        {
            key: "title",
            header: "标题",
            sortable: true,
            cell: (row) => <span className="font-medium">{row.title}</span>,
        },
        {
            key: "type",
            header: "类型",
            cell: (row) => <Badge variant="outline">{TYPE_LABEL[row.type]}</Badge>,
        },
        {
            key: "range",
            header: "生效区间",
            cell: (row) => (
                <span className="text-muted-foreground text-sm">
                    {formatTime(row.start_time)} ~ {formatTime(row.end_time)}
                </span>
            ),
            ellipsis: true,
        },
        {
            key: "is_active",
            header: "状态",
            cell: (row) => (
                <Badge variant={row.is_active ? "default" : "secondary"}>
                    {row.is_active ? "启用" : "停用"}
                </Badge>
            ),
        },
        {
            key: "actions_col",
            header: "操作",
            sticky: "right",
            cell: (row) => (
                <div className="flex items-center gap-2">
                    <PermissionGuard permission="announcement:manage">
                        <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => handleEdit(row)}
                            title="编辑"
                        >
                            <Pencil className="size-3.5" />
                        </Button>
                    </PermissionGuard>
                    <PermissionGuard permission="announcement:manage">
                        <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => handleDelete(row)}
                            title="删除"
                        >
                            <Trash2 className="size-3.5" />
                        </Button>
                    </PermissionGuard>
                </div>
            ),
        },
    ];

    return (
        <PageShell
            title="公告管理"
            description="管理站点公告"
            action={
                <PermissionGuard permission="announcement:manage">
                    <Button size="sm" onClick={handleCreate}>
                        <Plus className="size-3.5" />
                        创建公告
                    </Button>
                </PermissionGuard>
            }
        >
            <DataTable<AnnouncementDTO>
                data={announcements}
                columns={columns}
                keyExtractor={(row) => String(row.id)}
                page={1}
                pageSize={announcements.length}
                total={announcements.length}
                onPageChange={() => {}}
                selectable={false}
                loading={isLoading}
                error={error ? new Error(error.message) : null}
                onRetry={() => refetch()}
                storageKey="admin-announcements-columns"
                caption="公告列表"
                emptyTitle="暂无公告"
                emptyDescription="还没有创建任何公告"
            />
            <AnnouncementDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
            <ConfirmDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                onConfirm={confirmDelete}
                title="确认删除公告"
                description={`确定要删除公告 ${deleting?.title} 吗？`}
                confirmLabel="删除"
                loading={deleteAnn.isPending}
            />
        </PageShell>
    );
}
```

- [ ] **Step 3: 侧边栏加公告项**

Modify `web/src/features/admin-layout/ui/AdminNavConfig.ts`：

import 行加 `Megaphone`：

```ts
import { Images, LayoutDashboard, Megaphone, Shield, Smile, Tag, UserCog, Users } from "lucide-react";
```

`ADMIN_NAV_ITEMS` 数组加（放在标签之后、素材之前；顺序：概览/用户/角色/权限/标签/公告/素材/表情）：

```ts
    { label: "公告管理", to: "/admin/announcements", icon: Megaphone },
```

- [ ] **Step 4: 类型检查 + Biome + 路由生成**

Run: `cd web && npx tsc --noEmit && npx biome check src/features/admin-announcements src/routes/admin.announcements.tsx src/features/admin-layout/ui/AdminNavConfig.ts`

> 若 tsc 报 `admin.announcements` 路由未注册，跑一次 dev 触发 `routeTree.gen.ts` 生成。

Expected: 通过。

- [ ] **Step 5: Commit**

```bash
git add web/src/features/admin-announcements web/src/routes/admin.announcements.tsx web/src/features/admin-layout/ui/AdminNavConfig.ts web/src/routeTree.gen.ts
git commit -m "feat(admin/announcements): 接入公告管理（对话框 + 页面 + 侧边栏）"
```

---

## 完成验证

- [ ] **后端全量**：`cd api && go build ./... && go test ./...`
- [ ] **前端全量**：`cd web && npx tsc --noEmit && npx biome check .`
- [ ] **手动验证（建议）**：
  - 权限页：menu 行可展开/折叠；新建 action 选父 menu 成功；编辑内置权限 code 置灰；删除内置按钮禁用。
  - 角色权限对话框：按 menu 分组显示，勾选/全选正常。
  - 标签页：新建/编辑/删除正常，编辑后 slug 自动重算。
  - 公告页：新建（含生效区间）→ 列表显示 → 编辑 → 删除。
  - 侧边栏：标签管理、公告管理 两项出现并高亮正确。

---

## 计划自检（spec 覆盖核对）

| Spec 要求 | 对应 Task |
|-----------|----------|
| 权限表加 parent_id/type/sort/is_builtin + 13 menu 节点 | 1.1 |
| Code 正则放宽 + IsMenu + 内置 guard | 1.2 |
| GORM PO/repo 适配 + FindByID + Delete(id) | 1.3 |
| PermissionDTO 树形 + ListPermissionsHandler 组装树 | 1.4 |
| CRUD command 改 ID key + 内置 guard | 1.4 |
| handler/路由 {code}→{id} | 1.5 |
| OpenAPI 同步 | 1.6 |
| 前端 types + client 修契约（PATCH/{id}） | 1.7 |
| 权限增删改查对话框 | 1.8 |
| RolePermissionsDialog 消费树 | 1.9 |
| 权限页树形展示 + CRUD | 1.10 |
| 标签后端 Update + 细粒度权限 | 2.1 |
| 标签 OpenAPI | 2.2 |
| 标签前端 data layer + 页面 + 侧边栏 | 2.3 |
| 公告前端 data layer | 3.1 |
| 公告对话框 + 页面 + 侧边栏 | 3.2 |

无遗漏。类型/命名一致性已在各 Task 内对齐（NewPermission 8 参签名、UpdateCode/UpdateParent/UpdateSort、PermissionType、UpdateInput/UpdateTagRequest 等）。
