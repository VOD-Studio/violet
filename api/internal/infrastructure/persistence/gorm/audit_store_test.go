package gorm

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	domainaudit "blog-api/internal/domain/audit"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// setupAuditTestDB 初始化 SQLite 临时文件库并迁移 audit_logs 与 users 表。
//
// audit_logs 的 List/ListByUser 通过 LEFT JOIN users 取 user_name，
// 因此必须迁移 users 表（测试中可不插入数据，UserName 留空，断言不依赖它）。
func setupAuditTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	tmpDir := t.TempDir()
	tmpFile := tmpDir + "/test.db"
	db, err := gorm.Open(sqlite.Open(tmpFile), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&AuditLog{}, &model.User{}))
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func ptrString(s string) *string { return &s }

// appendAudit 便捷写入一条审计日志。
func appendAudit(t *testing.T, store *AuditStore, entry domainaudit.AuditLog) {
	t.Helper()
	require.NoError(t, store.Append(context.Background(), entry))
}

func TestAuditStore_AppendAndList(t *testing.T) {
	store := NewAuditStore(setupAuditTestDB(t))
	ctx := context.Background()

	actions := []string{"create", "update", "delete"}
	for i, a := range actions {
		appendAudit(t, store, domainaudit.AuditLog{
			UserID:     ptrString("11111111-1111-1111-1111-111111111111"),
			Action:     a,
			Resource:   "post",
			ResourceID: "1",
			IPAddress:  "127.0.0.1",
			Detail:     map[string]any{"index": i},
		})
	}

	// 第一页 2 条
	page1, err := store.List(ctx, 1, 2)
	require.NoError(t, err)
	assert.Equal(t, int64(3), page1.Total)
	require.Len(t, page1.Logs, 2)

	// 第二页 1 条
	page2, err := store.List(ctx, 2, 2)
	require.NoError(t, err)
	assert.Equal(t, int64(3), page2.Total)
	require.Len(t, page2.Logs, 1)

	// 合并两页，验证三条日志内容齐全（顺序按 created_at DESC，时间相近故不依赖顺序）
	byAction := make(map[string]domainaudit.AuditLog, 3)
	for _, l := range append(append([]domainaudit.AuditLog{}, page1.Logs...), page2.Logs...) {
		byAction[l.Action] = l
	}
	require.Len(t, byAction, 3)
	for _, a := range actions {
		l, ok := byAction[a]
		require.True(t, ok, "missing action %q", a)
		assert.Equal(t, "post", l.Resource)
		assert.Equal(t, "1", l.ResourceID)
		assert.Equal(t, "127.0.0.1", l.IPAddress)
		require.NotNil(t, l.Detail)
	}
}

func TestAuditStore_ListByUser(t *testing.T) {
	store := NewAuditStore(setupAuditTestDB(t))
	ctx := context.Background()

	user1 := "11111111-1111-1111-1111-111111111111"
	user2 := "22222222-2222-2222-2222-222222222222"

	// user1 两条，user2 一条，一条匿名（UserID=nil）
	appendAudit(t, store, domainaudit.AuditLog{UserID: ptrString(user1), Action: "login", Resource: "user"})
	appendAudit(t, store, domainaudit.AuditLog{UserID: ptrString(user1), Action: "create", Resource: "post"})
	appendAudit(t, store, domainaudit.AuditLog{UserID: ptrString(user2), Action: "update", Resource: "post"})
	appendAudit(t, store, domainaudit.AuditLog{Action: "logout", Resource: "user"})

	res, err := store.ListByUser(ctx, user1, 1, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(2), res.Total)
	require.Len(t, res.Logs, 2)
	for _, l := range res.Logs {
		require.NotNil(t, l.UserID)
		assert.Equal(t, user1, *l.UserID)
	}

	// user2 只有一条
	res2, err := store.ListByUser(ctx, user2, 1, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(1), res2.Total)
	require.Len(t, res2.Logs, 1)
}

func TestAuditStore_List_Empty(t *testing.T) {
	store := NewAuditStore(setupAuditTestDB(t))
	ctx := context.Background()

	res, err := store.List(ctx, 1, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(0), res.Total)
	assert.Empty(t, res.Logs)
}
