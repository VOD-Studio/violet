package gorm

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	domainaudit "blog-api/internal/domain/audit"
)

// setupAuditEventDB 初始化 SQLite 临时文件库并迁移 audit_events 表。
func setupAuditEventDB(t *testing.T) *gorm.DB {
	t.Helper()
	tmpDir := t.TempDir()
	db, err := gorm.Open(sqlite.Open(tmpDir+"/test.db"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&AuditEventPO{}))
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

// ptrStr 工具：返回字符串指针
func ptrStr(s string) *string { return &s }

func sampleEvent(overrides func(*domainaudit.AuditEvent)) domainaudit.AuditEvent {
	e := domainaudit.AuditEvent{
		EventID:    uuid.New(),
		Action:     domainaudit.ActionCreate,
		Actor:      domainaudit.Actor{UserID: "user-1", UserName: "alice", IPAddress: "1.2.3.4", UserAgent: "ua-1"},
		Resource:   domainaudit.ResourceRef{Type: "post", ID: "post-1", Name: "量子计算"},
		OccurredAt: time.Now().UTC().Truncate(time.Second),
	}
	if overrides != nil {
		overrides(&e)
	}
	return e
}

func TestEventStore_AppendAndList(t *testing.T) {
	store := NewEventStore(setupAuditEventDB(t))
	ctx := context.Background()

	require.NoError(t, store.Append(ctx, sampleEvent(nil)))
	require.NoError(t, store.Append(ctx, sampleEvent(func(e *domainaudit.AuditEvent) {
		e.Action = domainaudit.ActionUpdate
		e.Resource.ID = "post-2"
	})))

	res, err := store.List(ctx, 1, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(2), res.Total)
	require.Len(t, res.Events, 2)

	// 第二个 event（后追加）按 occurred_at DESC 排第一
	e := res.Events[0]
	assert.Equal(t, domainaudit.ActionUpdate, e.Action)
	assert.Equal(t, "post-2", e.Resource.ID)
	assert.Equal(t, "alice", e.Actor.UserName)
	assert.Equal(t, "1.2.3.4", e.Actor.IPAddress)
	assert.Equal(t, "ua-1", e.Actor.UserAgent)
	assert.Equal(t, "量子计算", e.Resource.Name) // 快照字段保持
}

func TestEventStore_AppendPersistsChangesAndMetadata(t *testing.T) {
	store := NewEventStore(setupAuditEventDB(t))
	ctx := context.Background()

	in := sampleEvent(func(e *domainaudit.AuditEvent) {
		e.Action = domainaudit.ActionUpdate
		e.Changes = []domainaudit.FieldChange{
			{Field: "role", From: "user", To: "admin"},
			{Field: "is_active", From: true, To: false},
		}
		e.Metadata = map[string]any{"reason": "promotion", "ticket": "T-42"}
	})
	require.NoError(t, store.Append(ctx, in))

	res, err := store.List(ctx, 1, 10)
	require.NoError(t, err)
	require.Len(t, res.Events, 1)
	got := res.Events[0]
	require.Len(t, got.Changes, 2)
	assert.Equal(t, "role", got.Changes[0].Field)
	assert.Equal(t, "user", got.Changes[0].From)
	assert.Equal(t, "admin", got.Changes[0].To)
	assert.Equal(t, "is_active", got.Changes[1].Field)
	assert.Equal(t, true, got.Changes[1].From)
	assert.Equal(t, false, got.Changes[1].To)
	assert.Equal(t, "promotion", got.Metadata["reason"])
	assert.Equal(t, "T-42", got.Metadata["ticket"])
}

func TestEventStore_AppendEmptyChangesAndMetadata(t *testing.T) {
	store := NewEventStore(setupAuditEventDB(t))
	ctx := context.Background()

	require.NoError(t, store.Append(ctx, sampleEvent(nil)))

	res, err := store.List(ctx, 1, 10)
	require.NoError(t, err)
	require.Len(t, res.Events, 1)
	assert.Empty(t, res.Events[0].Changes)
	assert.Nil(t, res.Events[0].Metadata)
}

func TestEventStore_ListByActor(t *testing.T) {
	store := NewEventStore(setupAuditEventDB(t))
	ctx := context.Background()

	// alice 三条，bob 一条，匿名一条
	for i := 0; i < 3; i++ {
		require.NoError(t, store.Append(ctx, sampleEvent(func(e *domainaudit.AuditEvent) {
			e.Actor.UserID = "alice-uuid"
			e.Actor.UserName = "alice"
		})))
	}
	require.NoError(t, store.Append(ctx, sampleEvent(func(e *domainaudit.AuditEvent) {
		e.Actor.UserID = "bob-uuid"
		e.Actor.UserName = "bob"
	})))
	require.NoError(t, store.Append(ctx, sampleEvent(func(e *domainaudit.AuditEvent) {
		e.Actor.UserID = "" // 匿名
	})))

	res, err := store.ListByActor(ctx, "alice-uuid", 1, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(3), res.Total)
	require.Len(t, res.Events, 3)
	for _, e := range res.Events {
		assert.Equal(t, "alice-uuid", e.Actor.UserID)
	}

	// bob 一条
	res2, err := store.ListByActor(ctx, "bob-uuid", 1, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(1), res2.Total)
}

func TestEventStore_ListPaginationAndOrder(t *testing.T) {
	store := NewEventStore(setupAuditEventDB(t))
	ctx := context.Background()

	// 写 5 条，每条 occurred_at +1s
	base := time.Now().UTC().Truncate(time.Second)
	for i := 0; i < 5; i++ {
		i := i
		require.NoError(t, store.Append(ctx, sampleEvent(func(e *domainaudit.AuditEvent) {
			e.OccurredAt = base.Add(time.Duration(i) * time.Second)
			e.Resource.ID = string(rune('a' + i))
		})))
	}

	// 第一页 2 条（最新两条：e, d）
	res, err := store.List(ctx, 1, 2)
	require.NoError(t, err)
	assert.Equal(t, int64(5), res.Total)
	require.Len(t, res.Events, 2)
	assert.Equal(t, "e", res.Events[0].Resource.ID)
	assert.Equal(t, "d", res.Events[1].Resource.ID)

	// 第二页 2 条
	res2, err := store.List(ctx, 2, 2)
	require.NoError(t, err)
	require.Len(t, res2.Events, 2)
	assert.Equal(t, "c", res2.Events[0].Resource.ID)
	assert.Equal(t, "b", res2.Events[1].Resource.ID)

	// 第三页 1 条
	res3, err := store.List(ctx, 3, 2)
	require.NoError(t, err)
	assert.Len(t, res3.Events, 1)
	assert.Equal(t, "a", res3.Events[0].Resource.ID)
}

func TestEventStore_ListEmpty(t *testing.T) {
	store := NewEventStore(setupAuditEventDB(t))
	ctx := context.Background()

	res, err := store.List(ctx, 1, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(0), res.Total)
	assert.Empty(t, res.Events)
}

func TestEventStore_RoundtripEventID(t *testing.T) {
	store := NewEventStore(setupAuditEventDB(t))
	ctx := context.Background()

	want := uuid.New()
	require.NoError(t, store.Append(ctx, sampleEvent(func(e *domainaudit.AuditEvent) {
		e.EventID = want
	})))

	res, err := store.List(ctx, 1, 10)
	require.NoError(t, err)
	require.Len(t, res.Events, 1)
	assert.Equal(t, want, res.Events[0].EventID, "EventID UUID 应在往返后保持一致")
}

func TestEventStore_ActorSnapshot_PersistsAfterUserDeletion(t *testing.T) {
	// 验证 UserName 是写入时快照：即使 users 表没有该用户（这里甚至没有 users 表），
	// ListByActor 通过 actor_user_id 过滤但 actor_user_name 从 audit_events 行直接读取
	// → 删除用户后仍可追溯
	store := NewEventStore(setupAuditEventDB(t))
	ctx := context.Background()

	require.NoError(t, store.Append(ctx, sampleEvent(func(e *domainaudit.AuditEvent) {
		e.Actor.UserID = "ghost-uuid"
		e.Actor.UserName = "deleted-user" // 冗余快照
	})))

	res, err := store.ListByActor(ctx, "ghost-uuid", 1, 10)
	require.NoError(t, err)
	require.Len(t, res.Events, 1)
	assert.Equal(t, "deleted-user", res.Events[0].Actor.UserName,
		"UserName 必须是写入时快照，不依赖 users 表 JOIN")
}
