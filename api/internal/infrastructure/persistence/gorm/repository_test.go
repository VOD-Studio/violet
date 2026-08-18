package gorm

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"blog-api/internal/domain/permission"
	"blog-api/internal/domain/role"
	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/user"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// setupTestDB 初始化内存 SQLite 数据库并 AutoMigrate 所有表
//
// 使用 SQLite 而非 testcontainers/PostgreSQL：
//   - 优点：零外部依赖（无需 Docker）、毫秒级启动、可在 CI 无容器环境运行
//   - 局限：无法测试 PostgreSQL 特有语法（如 SERIAL、JSONB）
//   - 折中：GORM AutoMigrate 在 SQLite 下用 INTEGER PRIMARY KEY 替代 SERIAL，
//     逻辑一致；PostgreSQL 特性由生产 migration 保证，此处只验证 repository 逻辑
func setupTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	// 用临时文件数据库（非内存库），彻底避免 SQLite 内存库多连接数据隔离问题
	// 文件库所有连接共享同一数据文件，事务可见性可靠
	tmpFile := filepath.Join(t.TempDir(), "test.db")
	db, err := gorm.Open(sqlite.Open(tmpFile), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	err = db.AutoMigrate(&model.User{}, &model.Role{}, &model.Permission{}, &model.RolePermission{})
	require.NoError(t, err)

	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

// seedPermissions 插入权限点种子数据
// permCodes 把权限代码字符串解析为 permission.Code
func permCodes(codes ...string) []permission.Code {
	out := make([]permission.Code, 0, len(codes))
	for _, c := range codes {
		code, err := permission.ParseCode(c)
		if err != nil {
			panic(err)
		}
		out = append(out, code)
	}
	return out
}

func seedPermissions(t *testing.T, db *gorm.DB, codes ...string) {
	t.Helper()
	for _, code := range permCodes(codes...) {
		perm := model.Permission{Code: code.String(), Name: code.String() + " 权限", Description: "测试权限", Type: "action"}
		require.NoError(t, db.Create(&perm).Error)
	}
}

// seedPermissionsWithIDs 插入权限种子数据，返回 code→id 映射
func seedPermissionsWithIDs(t *testing.T, db *gorm.DB, codes ...string) map[string]int32 {
	t.Helper()
	m := make(map[string]int32)
	for _, code := range permCodes(codes...) {
		perm := model.Permission{Code: code.String(), Name: code.String() + " 权限", Description: "测试权限", Type: "action"}
		require.NoError(t, db.Create(&perm).Error)
		m[code.String()] = perm.ID
	}
	return m
}

// seedRole 插入角色种子数据
func seedRole(t *testing.T, db *gorm.DB, name, desc string) model.Role {
	t.Helper()
	rl := model.Role{Name: name, Description: desc}
	require.NoError(t, db.Create(&rl).Error)
	return rl
}

// ============================================================
// UserRepository 集成测试
// ============================================================

func TestUserRepository_SaveAndFind(t *testing.T) {
	db := setupTestDB(t)
	repo := NewUserRepository(db)
	ctx := context.Background()

	// 构造领域用户
	email, _ := user.ParseEmail("test@example.com")
	username, _ := user.ParseUsername("testuser")
	hash := user.NewPasswordHash("$2a$10$hashedpassword")
	u := user.NewUser(shared.NewID(), email, username, hash)

	// Save
	require.NoError(t, repo.Save(ctx, u))

	// FindByID
	found, err := repo.FindByID(ctx, u.GetID())
	require.NoError(t, err)
	assert.Equal(t, u.Email().String(), found.Email().String())
	assert.Equal(t, u.Username().String(), found.Username().String())
	assert.Equal(t, u.Role(), found.Role())
	assert.True(t, found.IsActive())

	// FindByEmail
	found2, err := repo.FindByEmail(ctx, email)
	require.NoError(t, err)
	assert.Equal(t, u.GetID(), found2.GetID())
}

func TestUserRepository_ExistsChecks(t *testing.T) {
	db := setupTestDB(t)
	repo := NewUserRepository(db)
	ctx := context.Background()

	email, _ := user.ParseEmail("exists@example.com")
	username, _ := user.ParseUsername("existsuser")
	hash := user.NewPasswordHash("$2a$10$hash")
	u := user.NewUser(shared.NewID(), email, username, hash)
	require.NoError(t, repo.Save(ctx, u))

	// 邮箱已存在
	exists, err := repo.ExistsByEmail(ctx, email)
	require.NoError(t, err)
	assert.True(t, exists)

	// 用户名已存在
	exists, err = repo.ExistsByUsername(ctx, username)
	require.NoError(t, err)
	assert.True(t, exists)

	// 不存在的邮箱
	otherEmail, _ := user.ParseEmail("nobody@example.com")
	exists, err = repo.ExistsByEmail(ctx, otherEmail)
	require.NoError(t, err)
	assert.False(t, exists)
}

func TestUserRepository_FindByID_NotFound(t *testing.T) {
	db := setupTestDB(t)
	repo := NewUserRepository(db)
	ctx := context.Background()

	_, err := repo.FindByID(ctx, shared.MustParseID(uuid.New().String()))
	assert.ErrorIs(t, err, user.ErrNotFound)
}

func TestUserRepository_Delete(t *testing.T) {
	db := setupTestDB(t)
	repo := NewUserRepository(db)
	ctx := context.Background()

	email, _ := user.ParseEmail("del@example.com")
	username, _ := user.ParseUsername("deluser")
	u := user.NewUser(shared.NewID(), email, username, user.NewPasswordHash("hash"))
	require.NoError(t, repo.Save(ctx, u))

	require.NoError(t, repo.Delete(ctx, u.GetID()))

	_, err := repo.FindByID(ctx, u.GetID())
	assert.ErrorIs(t, err, user.ErrNotFound)
}

func TestUserRepository_Count(t *testing.T) {
	db := setupTestDB(t)
	repo := NewUserRepository(db)
	ctx := context.Background()

	// 初始 0
	count, err := repo.Count(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(0), count)

	// 插入 2 个
	for _, name := range []string{"user1", "user2"} {
		email, _ := user.ParseEmail(name + "@example.com")
		username, _ := user.ParseUsername(name)
		u := user.NewUser(shared.NewID(), email, username, user.NewPasswordHash("hash"))
		require.NoError(t, repo.Save(ctx, u))
	}

	count, err = repo.Count(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(2), count)
}

// ============================================================
// RoleRepository 集成测试
// ============================================================

func TestRoleRepository_SaveAndFind(t *testing.T) {
	db := setupTestDB(t)
	repo := NewRoleRepository(db)
	ctx := context.Background()

	// 先种权限点
	seedPermissions(t, db, "post:create", "post:delete")

	name, _ := role.ParseRoleName("editor")
	rl := role.NewRole(0, name, "内容编辑")

	roleID, err := repo.Save(ctx, rl)
	require.NoError(t, err)
	require.NotZero(t, roleID)

	// SavePermissions
	require.NoError(t, repo.SavePermissions(ctx, roleID, []string{"post:create", "post:delete"}))

	// FindByID 应含权限
	found, err := repo.FindByID(ctx, roleID)
	require.NoError(t, err)
	assert.Equal(t, "editor", found.Name().String())
	assert.Len(t, found.PermissionCodes(), 2)
	assert.True(t, found.HasPermission("post:create"))
}

func TestRoleRepository_FindByName_NotFound(t *testing.T) {
	db := setupTestDB(t)
	repo := NewRoleRepository(db)
	ctx := context.Background()

	name, _ := role.ParseRoleName("nonexistent")
	_, err := repo.FindByName(ctx, name)
	assert.ErrorIs(t, err, role.ErrNotFound)
}

func TestRoleRepository_FindAll(t *testing.T) {
	db := setupTestDB(t)
	repo := NewRoleRepository(db)
	ctx := context.Background()

	seedRole(t, db, "admin", "管理员")
	seedRole(t, db, "user", "普通用户")
	seedRole(t, db, "editor", "编辑")

	roles, err := repo.FindAll(ctx)
	require.NoError(t, err)
	assert.Len(t, roles, 3)
}

func TestRoleRepository_ExistsByName(t *testing.T) {
	db := setupTestDB(t)
	repo := NewRoleRepository(db)
	ctx := context.Background()

	seedRole(t, db, "admin", "管理员")

	name, _ := role.ParseRoleName("admin")
	exists, err := repo.ExistsByName(ctx, name)
	require.NoError(t, err)
	assert.True(t, exists)

	name2, _ := role.ParseRoleName("editor")
	exists2, err := repo.ExistsByName(ctx, name2)
	require.NoError(t, err)
	assert.False(t, exists2)
}

func TestRoleRepository_Delete(t *testing.T) {
	db := setupTestDB(t)
	repo := NewRoleRepository(db)
	ctx := context.Background()

	rl := seedRole(t, db, "temp", "临时角色")

	require.NoError(t, repo.Delete(ctx, rl.ID))

	_, err := repo.FindByID(ctx, rl.ID)
	assert.ErrorIs(t, err, role.ErrNotFound)
}

func TestRoleRepository_CountUsers(t *testing.T) {
	db := setupTestDB(t)
	roleRepo := NewRoleRepository(db)
	userRepo := NewUserRepository(db)
	ctx := context.Background()

	// 创建角色
	rl := seedRole(t, db, "editor", "编辑")

	// 创建 2 个用户关联该角色
	for i := 0; i < 2; i++ {
		email, _ := user.ParseEmail("u" + string(rune('1'+i)) + "@example.com")
		username, _ := user.ParseUsername("user" + string(rune('1'+i)))
		u := user.NewUser(shared.NewID(), email, username, user.NewPasswordHash("hash"))
		require.NoError(t, userRepo.Save(ctx, u))
		// 用户角色以 role 字符串列为来源（DDD 后 role_id 外键废弃），用原生 SQL 写 role
		require.NoError(t, db.Exec("UPDATE users SET role = ? WHERE id = ?", rl.Name, u.GetID().UUID()).Error)
	}

	count, err := roleRepo.CountUsers(ctx, rl.ID)
	require.NoError(t, err)
	assert.Equal(t, int64(2), count)
}

func TestRoleRepository_CountUsersByIDs(t *testing.T) {
	db := setupTestDB(t)
	roleRepo := NewRoleRepository(db)
	userRepo := NewUserRepository(db)
	ctx := context.Background()

	editor := seedRole(t, db, "editor", "编辑")
	admin := seedRole(t, db, "admin2", "自定义角色")
	seedRole(t, db, "empty", "无用户角色")

	// editor 2 个用户，admin2 1 个用户
	seedUserWithRole(t, db, userRepo, ctx, "e1@example.com", "user_e1", editor.Name)
	seedUserWithRole(t, db, userRepo, ctx, "e2@example.com", "user_e2", editor.Name)
	seedUserWithRole(t, db, userRepo, ctx, "a1@example.com", "user_a1", admin.Name)

	counts, err := roleRepo.CountUsersByIDs(ctx, []int32{editor.ID, admin.ID})
	require.NoError(t, err)
	assert.Equal(t, map[int32]int64{editor.ID: 2, admin.ID: 1}, counts)

	// 空入参返回空 map，不产生查询
	empty, err := roleRepo.CountUsersByIDs(ctx, nil)
	require.NoError(t, err)
	assert.Empty(t, empty)
}

// seedUserWithRole 创建用户并把角色写入 users.role 字符串列（DDD 后 role_id 外键废弃）
func seedUserWithRole(t *testing.T, db *gorm.DB, userRepo *UserRepository, ctx context.Context, emailStr, usernameStr, roleName string) {
	t.Helper()
	email, err := user.ParseEmail(emailStr)
	require.NoError(t, err)
	username, err := user.ParseUsername(usernameStr)
	require.NoError(t, err)
	u := user.NewUser(shared.NewID(), email, username, user.NewPasswordHash("hash"))
	require.NoError(t, userRepo.Save(ctx, u))
	require.NoError(t, db.Exec("UPDATE users SET role = ? WHERE id = ?", roleName, u.GetID().UUID()).Error)
}

func TestRoleRepository_SavePermissions_InvalidCode(t *testing.T) {
	db := setupTestDB(t)
	repo := NewRoleRepository(db)
	ctx := context.Background()

	seedPermissions(t, db, "post:create")
	rl := seedRole(t, db, "editor", "编辑")

	// 不存在的权限代码应报错
	err := repo.SavePermissions(ctx, rl.ID, []string{"post:create", "nonexistent:code"})
	assert.Error(t, err)
}

// ============================================================
// PermissionRepository 集成测试
// ============================================================

func TestPermissionRepository_SaveAndFind(t *testing.T) {
	db := setupTestDB(t)
	repo := NewPermissionRepository(db)
	ctx := context.Background()

	code, _ := permission.ParseCode("test:action")
	p := permission.NewPermission(0, code, "测试权限", "测试描述", nil, "action", 0, false)

	_, err := repo.Save(ctx, p)
	require.NoError(t, err)

	// FindByCode
	found, err := repo.FindByCode(ctx, code)
	require.NoError(t, err)
	assert.Equal(t, "测试权限", found.Name())
	assert.Equal(t, "test:action", found.Code().String())
}

func TestPermissionRepository_FindAll(t *testing.T) {
	db := setupTestDB(t)
	repo := NewPermissionRepository(db)
	ctx := context.Background()

	seedPermissions(t, db, "post:create", "post:delete", "comment:approve")

	perms, err := repo.FindAll(ctx)
	require.NoError(t, err)
	assert.Len(t, perms, 3)
}

func TestPermissionRepository_ExistsByCode(t *testing.T) {
	db := setupTestDB(t)
	repo := NewPermissionRepository(db)
	ctx := context.Background()

	seedPermissions(t, db, "post:create")

	code, _ := permission.ParseCode("post:create")
	exists, err := repo.ExistsByCode(ctx, code)
	require.NoError(t, err)
	assert.True(t, exists)

	code2, _ := permission.ParseCode("post:delete")
	exists2, err := repo.ExistsByCode(ctx, code2)
	require.NoError(t, err)
	assert.False(t, exists2)
}

func TestPermissionRepository_Delete(t *testing.T) {
	db := setupTestDB(t)
	repo := NewPermissionRepository(db)
	ctx := context.Background()

	ids := seedPermissionsWithIDs(t, db, "post:create")
	id := ids["post:create"]

	require.NoError(t, repo.Delete(ctx, id))

	_, err := repo.FindByID(ctx, id)
	assert.ErrorIs(t, err, permission.ErrNotFound)
}

func TestPermissionRepository_Delete_NotFound(t *testing.T) {
	db := setupTestDB(t)
	repo := NewPermissionRepository(db)
	ctx := context.Background()

	err := repo.Delete(ctx, 99999)
	assert.ErrorIs(t, err, permission.ErrNotFound)
}

func TestPermissionRepository_CountRoles(t *testing.T) {
	db := setupTestDB(t)
	permRepo := NewPermissionRepository(db)
	roleRepo := NewRoleRepository(db)
	ctx := context.Background()

	// 种权限和角色
	ids := seedPermissionsWithIDs(t, db, "post:create")
	rl := seedRole(t, db, "editor", "编辑")

	// 角色关联权限
	require.NoError(t, roleRepo.SavePermissions(ctx, rl.ID, []string{"post:create"}))

	// 应有 1 个角色使用该权限
	count, err := permRepo.CountRoles(ctx, ids["post:create"])
	require.NoError(t, err)
	assert.Equal(t, int64(1), count)
}
