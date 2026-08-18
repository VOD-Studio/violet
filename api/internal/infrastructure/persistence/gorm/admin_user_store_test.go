package gorm

import (
	"context"
	"fmt"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/user"
	"blog-api/internal/domain/useradmin"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// setupAdminUserTestDB 初始化 SQLite 临时文件库并迁移 users 表。
func setupAdminUserTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	tmpFile := filepath.Join(t.TempDir(), "test.db")
	db, err := gorm.Open(sqlite.Open(tmpFile), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}))
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

// newAdminTestUser 构造唯一邮箱/用户名的领域用户（默认 role=user, active）。
func newAdminTestUser(t *testing.T, seq int) *user.User {
	t.Helper()
	email, err := user.ParseEmail(fmt.Sprintf("admin%d@example.com", seq))
	require.NoError(t, err)
	username, err := user.ParseUsername(fmt.Sprintf("adminuser%d", seq))
	require.NoError(t, err)
	hash := user.NewPasswordHash("$2a$10$dummyhashforadmintest")
	return user.NewUser(shared.NewID(), email, username, hash)
}

// seedAdminUserPO 直接插入 PO，精确控制 role/is_active/created_at（分页与筛选测试用）。
func seedAdminUserPO(t *testing.T, db *gorm.DB, seq int, role string, isActive bool, createdAt time.Time) model.User {
	t.Helper()
	po := model.User{
		BaseModel:    model.BaseModel{ID: uuid.New(), CreatedAt: createdAt, UpdatedAt: createdAt},
		Username:     fmt.Sprintf("seed%d", seq),
		Email:        fmt.Sprintf("seed%d@example.com", seq),
		PasswordHash: "$2a$10$dummy",
		Role:         role,
		IsActive:     isActive,
	}
	require.NoError(t, db.Create(&po).Error)
	return po
}

func TestAdminUserStore_SaveAndFindByID(t *testing.T) {
	db := setupAdminUserTestDB(t)
	store := NewAdminUserStore(db)
	ctx := context.Background()

	u := newAdminTestUser(t, 1)
	require.NoError(t, store.Save(ctx, u))

	found, err := store.FindByID(ctx, u.GetID())
	require.NoError(t, err)
	require.NotNil(t, found)
	assert.Equal(t, u.GetID(), found.GetID())
	assert.Equal(t, u.Email().String(), found.Email().String())
	assert.Equal(t, u.Username().String(), found.Username().String())
	assert.Equal(t, u.Role(), found.Role())
	assert.True(t, found.IsActive())
}

func TestAdminUserStore_FindByIDs(t *testing.T) {
	db := setupAdminUserTestDB(t)
	store := NewAdminUserStore(db)
	ctx := context.Background()

	users := []*user.User{newAdminTestUser(t, 1), newAdminTestUser(t, 2), newAdminTestUser(t, 3)}
	for _, u := range users {
		require.NoError(t, store.Save(ctx, u))
	}

	// 空切片 → 空结果
	got, err := store.FindByIDs(ctx, nil)
	require.NoError(t, err)
	assert.Empty(t, got)

	// 部分查询（含一个不存在的 ID，静默跳过）
	queryIDs := []shared.ID{users[0].GetID(), users[1].GetID(), shared.NewID()}
	got, err = store.FindByIDs(ctx, queryIDs)
	require.NoError(t, err)
	assert.Len(t, got, 2)

	gotIDs := map[shared.ID]bool{}
	for _, u := range got {
		gotIDs[u.GetID()] = true
	}
	assert.True(t, gotIDs[users[0].GetID()])
	assert.True(t, gotIDs[users[1].GetID()])
}

func TestAdminUserStore_List_Pagination(t *testing.T) {
	db := setupAdminUserTestDB(t)
	store := NewAdminUserStore(db)
	ctx := context.Background()

	// 直接插 PO，用递增 created_at 保证分页顺序确定（FindPage 按 created_at DESC, id DESC）
	base := time.Date(2025, 1, 1, 12, 0, 0, 0, time.UTC)
	seeded := make([]model.User, 5)
	for i := range 5 {
		seeded[i] = seedAdminUserPO(t, db, i, "user", true, base.Add(time.Duration(i)*time.Second))
	}

	// page 1, limit 2 → 最新 2 条（seeded[4]、seeded[3]）
	res, err := store.FindPage(ctx, useradmin.ListFilter{}, shared.PageQuery{Page: 1, Limit: 2})
	require.NoError(t, err)
	assert.Equal(t, int64(5), res.Total)
	require.Len(t, res.Items, 2)
	assert.Equal(t, seeded[4].ID, res.Items[0].GetID().UUID())
	assert.Equal(t, seeded[3].ID, res.Items[1].GetID().UUID())

	// page 3, limit 2 → 仅剩 1 条（seeded[0]）
	res, err = store.FindPage(ctx, useradmin.ListFilter{}, shared.PageQuery{Page: 3, Limit: 2})
	require.NoError(t, err)
	assert.Equal(t, int64(5), res.Total)
	require.Len(t, res.Items, 1)
	assert.Equal(t, seeded[0].ID, res.Items[0].GetID().UUID())

	// page 超出范围 → 空页，total 不变
	res, err = store.FindPage(ctx, useradmin.ListFilter{}, shared.PageQuery{Page: 10, Limit: 2})
	require.NoError(t, err)
	assert.Equal(t, int64(5), res.Total)
	assert.Empty(t, res.Items)
}

func TestAdminUserStore_List_Filter(t *testing.T) {
	db := setupAdminUserTestDB(t)
	store := NewAdminUserStore(db)
	ctx := context.Background()

	base := time.Date(2025, 1, 1, 12, 0, 0, 0, time.UTC)
	seedAdminUserPO(t, db, 0, "user", true, base)
	seedAdminUserPO(t, db, 1, "user", false, base.Add(time.Second))
	seedAdminUserPO(t, db, 2, "admin", true, base.Add(2*time.Second))
	seedAdminUserPO(t, db, 3, "admin", false, base.Add(3*time.Second))
	seedAdminUserPO(t, db, 4, "user", true, base.Add(4*time.Second))

	// 按 role 筛选
	res, err := store.FindPage(ctx, useradmin.ListFilter{Role: "admin"}, shared.PageQuery{Page: 1, Limit: 100})
	require.NoError(t, err)
	assert.Equal(t, int64(2), res.Total)
	for _, u := range res.Items {
		assert.Equal(t, user.Role("admin"), u.Role())
	}

	// 按 is_active 筛选
	inactive := false
	res, err = store.FindPage(ctx, useradmin.ListFilter{IsActive: &inactive}, shared.PageQuery{Page: 1, Limit: 100})
	require.NoError(t, err)
	assert.Equal(t, int64(2), res.Total)
	for _, u := range res.Items {
		assert.False(t, u.IsActive())
	}

	// 复合筛选 role=user AND is_active=true
	active := true
	res, err = store.FindPage(ctx, useradmin.ListFilter{Role: "user", IsActive: &active}, shared.PageQuery{Page: 1, Limit: 100})
	require.NoError(t, err)
	assert.Equal(t, int64(2), res.Total)
}

func TestAdminUserStore_BatchUpdateStatus(t *testing.T) {
	db := setupAdminUserTestDB(t)
	store := NewAdminUserStore(db)
	ctx := context.Background()

	u1 := newAdminTestUser(t, 1)
	u2 := newAdminTestUser(t, 2)
	u3 := newAdminTestUser(t, 3)
	for _, u := range []*user.User{u1, u2, u3} {
		require.NoError(t, store.Save(ctx, u))
	}

	n, err := store.BatchUpdateStatus(ctx, []shared.ID{u1.GetID(), u2.GetID()}, false)
	require.NoError(t, err)
	assert.Equal(t, int64(2), n)

	// u1、u2 已禁用
	for _, uid := range []shared.ID{u1.GetID(), u2.GetID()} {
		got, err := store.FindByID(ctx, uid)
		require.NoError(t, err)
		assert.False(t, got.IsActive())
	}
	// u3 未受影响，仍 active
	got3, err := store.FindByID(ctx, u3.GetID())
	require.NoError(t, err)
	assert.True(t, got3.IsActive())

	// 不存在的 ID 不计入受影响行数
	n, err = store.BatchUpdateStatus(ctx, []shared.ID{shared.NewID()}, false)
	require.NoError(t, err)
	assert.Equal(t, int64(0), n)
}

func TestAdminUserStore_BatchUpdateRole(t *testing.T) {
	db := setupAdminUserTestDB(t)
	store := NewAdminUserStore(db)
	ctx := context.Background()

	u1 := newAdminTestUser(t, 1)
	u2 := newAdminTestUser(t, 2)
	for _, u := range []*user.User{u1, u2} {
		require.NoError(t, store.Save(ctx, u))
	}

	n, err := store.BatchUpdateRole(ctx, []shared.ID{u1.GetID(), u2.GetID()}, "author")
	require.NoError(t, err)
	assert.Equal(t, int64(2), n)

	for _, uid := range []shared.ID{u1.GetID(), u2.GetID()} {
		got, err := store.FindByID(ctx, uid)
		require.NoError(t, err)
		assert.Equal(t, user.RoleAuthor, got.Role())
	}
}

func TestAdminUserStore_Delete(t *testing.T) {
	db := setupAdminUserTestDB(t)
	store := NewAdminUserStore(db)
	ctx := context.Background()

	u := newAdminTestUser(t, 1)
	require.NoError(t, store.Save(ctx, u))

	// 删除成功
	require.NoError(t, store.Delete(ctx, u.GetID()))

	// FindByID 不存在 → nil 用户 + ErrNotFound
	got, err := store.FindByID(ctx, u.GetID())
	assert.Nil(t, got)
	assert.ErrorIs(t, err, user.ErrNotFound)

	// 重复删除 → ErrNotFound
	err = store.Delete(ctx, u.GetID())
	assert.ErrorIs(t, err, user.ErrNotFound)
}
