# B站表情「重新拉取」HTTP 接口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在后台表情管理页提供「重新拉取 B站表情」按钮,异步全量重新拉取并按分组名增量合并(upsert),前端轮询任务状态直到完成。

**Architecture:** 方案 B(职责分离)。upsert 落仓储层(持久化语义本属此);seed service 实现 `Reseeder` 端口只管下载+upsert;`EmojiService.Refetch` 管编排(加锁→异步→状态);`RefetchStatusStore` 独立端口 + Redis 实现;权限点 `emoji:refetch` 走 RBAC。前后端分离提交。

**Tech Stack:** Go 1.25、GORM、Chi、Redis(go-redis/v9)、testify/mock、sqlite 集成测试;React 19、TanStack Query、sonner(toast)、Biome。

**Spec:** `docs/superpowers/specs/2026-07-09-bilibili-emoji-refetch-design.md`

---

## 关键背景(实现者必读)

1. **现有代码位置**(均已在前序技术债修复中改造完成):
   - seed service:`api/internal/service/emoji_seed_service.go`,依赖 `domainemoji.EmojiGroupRepository` + `bilibili.Client` + `bilibili.Downloader`
   - 仓储接口:`api/internal/domain/emoji/repository.go`(15 个方法,含 Task 4 新增的 Count/FindGroupsNeedingCover/UpdateCoverURL)
   - GORM 仓储实现:`api/internal/infrastructure/persistence/gorm/media_repo.go`(同包有 `setupTestDB` + `setupEmojiTestDB` 范式)
   - EmojiService:`api/internal/application/media/service.go`(`EmojiService` 结构体 L70,`NewEmojiService` L82)
   - media handler:`api/internal/interfaces/http/handler/media/media.go`(`Handler` 结构体 L24,`NewHandler` L30)
   - media 装配:`api/internal/app/media_container.go`(`NewMediaContainer` L20)
   - emoji 路由组:`api/cmd/server/main.go` L495-509
   - permissionChecker:`api/cmd/server/main.go` L111 已构造,emoji 路由组当前未用它(缺口)
   - 主程序 seed 装配:`api/cmd/server/main.go` L150-161(已改异步)

2. **错误机制**:`domain/shared/error.go` 提供 `Conflict(message string) *DomainError`(L106),emoji 的 `ErrNameExists` 已用。`response.RespondError` 自动把 `*DomainError` 翻译成 HTTP 状态码(Conflict→409)。

3. **Redis 客户端类型**:`*redis.Client`(`github.com/redis/go-redis/v9`),main.go L70 `redisClient := redis.NewClient(redisOpt)`。system 模块的 `redisStore` 最小接口范式见 `api/internal/application/system/sampler.go` L22-24。

4. **前端约定**:用 `pnpm`(非 npm);toast 用 `sonner` 的 `toast.success/error`;API helper `apiGet/apiPost/apiPatch/apiDelete` 在 `web/src/shared/api/request.ts`,自动拆信封;query key 工厂 `web/src/features/admin-emojis/api/keys.ts`;Biome 格式化(`make web-format`/`make web-lint`),类型检查 `make web-typecheck`。

5. **提交规范**(AGENTS.md):中文 Conventional Commits;body 用 bullet points;**前后端分离提交**;公共组件单独提交;重构与功能分离。每个 Task 末尾给了 commit 命令。

6. **验证命令**:
   - 后端编译/测试:`cd api && go build ./... && go test ./... && go vet ./...`
   - 数据库迁移:`make migrate`(本计划新增 migration)
   - 前端:`cd web && pnpm run typecheck`(或 `make web-typecheck`)+ `make web-format`

7. **migration 编号**:现有最新是 `056_*`,本计划从 `057` 开始(先确认实际最新号,见 Task 7 Step 1)。

---

## File Structure

### 后端新建
- `api/internal/domain/emoji/refetch_status.go` — RefetchStatus / RefetchProgress / RefetchStatusStore 端口 + 状态常量
- `api/internal/infrastructure/emoji/refetch_status_store.go` — RefetchStatusStore 的 Redis 实现
- `api/internal/infrastructure/emoji/refetch_status_store_test.go` — Redis store 测试(用 miniredis 或 mock)
- `api/migrations/057_add_emoji_refetch_permission.{up,down}.sql` — 权限点种子

### 后端修改
- `api/internal/domain/emoji/repository.go` — 加 `UpsertByName` / `UpsertEmojiByName`
- `api/internal/infrastructure/persistence/gorm/media_repo.go` — 实现两个 upsert 方法
- `api/internal/infrastructure/persistence/gorm/media_repo_test.go` — 加 upsert 测试
- `api/internal/application/media/service.go` — 加 `ReseedRunner` 接口;`EmojiService` 加 `reseeder`/`statusStore` 字段 + `Refetch`/`GetRefetchStatus` 方法
- `api/internal/service/emoji_seed_service.go` — 加 `ReseedBilibiliEmojis` 方法(走 upsert)
- `api/internal/interfaces/http/handler/media/media.go` — 加 `RefetchBilibiliEmojis`/`GetRefetchStatus` handler
- `api/internal/app/media_container.go` — `NewMediaContainer` 签名扩展(reseeder + statusStore)
- `api/cmd/server/main.go` — 构造 refetchStatusStore;调 NewMediaContainer 传参;emoji 路由组加 refetch 路由 + 权限中间件
- `api/internal/domain/permission/entity.go` — 加 `EmojiRefetch` 常量

### 前端新建
- `web/src/features/admin-emojis/ui/RefetchBilibiliButton.tsx` — 重新拉取按钮组件(含 confirm + 进度)

### 前端修改
- `web/src/features/admin-emojis/api/keys.ts` — 加 `refetchStatus` key
- `web/src/features/admin-emojis/api/mutations.ts` — 加 `useRefetchBilibiliEmojis`
- `web/src/features/admin-emojis/api/queries.ts` — 加 `useRefetchStatus`(轮询)
- `web/src/features/admin-emojis/model/types.ts` — 加 `RefetchStatus` 类型
- `web/src/routes/admin.emojis.tsx` — PageShell.action 接入 RefetchBilibiliButton

---

## Task 1:仓储层 upsert 方法(TDD)

**目标**:给 `EmojiGroupRepository` 加 `UpsertByName` 和 `UpsertEmojiByName`,按 name 合并,不删除历史数据。

**Files:**
- Modify: `api/internal/domain/emoji/repository.go`
- Modify: `api/internal/infrastructure/persistence/gorm/media_repo.go`
- Modify: `api/internal/infrastructure/persistence/gorm/media_repo_test.go`

### UpsertByName

- [ ] **Step 1: 写失败测试 — UpsertByName 新建**

追加到 `api/internal/infrastructure/persistence/gorm/media_repo_test.go`:
```go
func TestUpsertByName_CreateNew(t *testing.T) {
	repo := setupEmojiTestDB(t)
	g, _ := emoji.NewEmojiGroup(0, "new-pkg", emoji.SourceBilibili)
	g.SetCoverURL("https://example.com/c.png")
	g.SetSortOrder(3)
	g.SetEnabled(true)

	id, err := repo.UpsertByName(context.Background(), g)
	require.NoError(t, err)
	assert.Greater(t, id, int32(0))

	loaded, _ := repo.FindByID(context.Background(), id)
	assert.Equal(t, "new-pkg", loaded.Name())
	assert.Equal(t, "bilibili", loaded.Source())
	assert.Equal(t, "https://example.com/c.png", loaded.CoverURL())
	assert.Equal(t, 3, loaded.SortOrder())
	assert.True(t, loaded.IsEnabled())
}
```

- [ ] **Step 2: 运行确认失败**

Run: `cd api && go test ./internal/infrastructure/persistence/gorm/ -run TestUpsertByName_CreateNew -v`
Expected: 编译失败 `repo.UpsertByName undefined`。

- [ ] **Step 3: 接口加方法**

`api/internal/domain/emoji/repository.go` 接口内(`UpdateCoverURL` 后)加:
```go
	// UpsertByName 按名称+来源合并分组：存在则更新（cover/sort/enabled），不存在则新建。
	// 用于 B站表情重新拉取的增量合并，不删除历史分组。返回分组 ID。
	UpsertByName(ctx context.Context, g *EmojiGroup) (int32, error)
	// UpsertEmojiByName 按 groupID+name 合并表情：存在则更新，不存在则新建。返回表情 ID。
	UpsertEmojiByName(ctx context.Context, e Emoji) (int32, error)
```

- [ ] **Step 4: GORM 实现 UpsertByName**

`api/internal/infrastructure/persistence/gorm/media_repo.go` 在 `UpdateCoverURL` 后加:
```go
// UpsertByName 按名称+来源合并分组：存在则更新，不存在则新建。
func (r *EmojiGroupRepository) UpsertByName(ctx context.Context, g *emoji.EmojiGroup) (int32, error) {
	var existing model.EmojiGroup
	err := r.db.WithContext(ctx).
		Where("name = ? AND source = ?", g.Name(), g.Source()).
		First(&existing).Error
	if err == nil {
		// 存在则更新 cover/sort/enabled
		updates := r.db.WithContext(ctx).Model(&model.EmojiGroup{}).
			Where("id = ?", existing.ID).
			Updates(map[string]any{
				"cover_url":  g.CoverURL(),
				"sort_order": g.SortOrder(),
				"is_enabled": g.IsEnabled(),
			})
		if updates.Error != nil {
			return 0, domainshared.Internal("upsert 更新表情分组失败", updates.Error)
		}
		return existing.ID, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, domainshared.Internal("upsert 查询表情分组失败", err)
	}
	// 不存在则新建
	po := emojiGroupToPO(g)
	if err := r.db.WithContext(ctx).Create(&po).Error; err != nil {
		return 0, domainshared.Internal("upsert 创建表情分组失败", err)
	}
	return po.ID, nil
}
```

- [ ] **Step 5: 运行转绿**

Run: `cd api && go test ./internal/infrastructure/persistence/gorm/ -run TestUpsertByName_CreateNew -v`
Expected: PASS。

- [ ] **Step 6: 写失败测试 — UpsertByName 已存在则更新**

追加到 `media_repo_test.go`:
```go
func TestUpsertByName_UpdateExisting(t *testing.T) {
	repo := setupEmojiTestDB(t)
	// 先建一个
	g1, _ := emoji.NewEmojiGroup(0, "pkg", emoji.SourceBilibili)
	g1.SetCoverURL("https://old.com/c.png")
	id, _ := repo.UpsertByName(context.Background(), g1)

	// 同 name+source 再 upsert，应更新而非新建
	g2, _ := emoji.NewEmojiGroup(0, "pkg", emoji.SourceBilibili)
	g2.SetCoverURL("/uploads/emojis/new.png")
	g2.SetSortOrder(9)
	g2.SetEnabled(false)
	id2, err := repo.UpsertByName(context.Background(), g2)
	require.NoError(t, err)
	assert.Equal(t, id, id2, "同 name 应返回同一 ID")

	loaded, _ := repo.FindByID(context.Background(), id)
	assert.Equal(t, "/uploads/emojis/new.png", loaded.CoverURL())
	assert.Equal(t, 9, loaded.SortOrder())
	assert.False(t, loaded.IsEnabled())

	// 确认没有产生重复行
	n, _ := repo.Count(context.Background())
	assert.Equal(t, int64(1), n)
}
```

- [ ] **Step 7: 运行确认通过**

Run: `cd api && go test ./internal/infrastructure/persistence/gorm/ -run TestUpsertByName_UpdateExisting -v`
Expected: PASS(Step 4 的实现已覆盖此场景)。

- [ ] **Step 8: 写失败测试 — UpsertByName 同名不同 source 不冲突**

追加到 `media_repo_test.go`:
```go
func TestUpsertByName_SameNameDifferentSource(t *testing.T) {
	repo := setupEmojiTestDB(t)
	gBili, _ := emoji.NewEmojiGroup(0, "pkg", emoji.SourceBilibili)
	idBili, _ := repo.UpsertByName(context.Background(), gBili)

	gCustom, _ := emoji.NewEmojiGroup(0, "pkg", emoji.SourceCustom)
	idCustom, err := repo.UpsertByName(context.Background(), gCustom)
	require.NoError(t, err)

	assert.NotEqual(t, idBili, idCustom, "同名不同来源应各自独立")
	n, _ := repo.Count(context.Background())
	assert.Equal(t, int64(2), n)
}
```

- [ ] **Step 9: 运行确认通过**

Run: `cd api && go test ./internal/infrastructure/persistence/gorm/ -run TestUpsertByName_SameNameDifferentSource -v`
Expected: PASS。

### UpsertEmojiByName

- [ ] **Step 10: 写失败测试 — UpsertEmojiByName 新建+更新**

追加到 `media_repo_test.go`:
```go
func TestUpsertEmojiByName_Upsert(t *testing.T) {
	repo := setupEmojiTestDB(t)
	// 先建分组
	g, _ := emoji.NewEmojiGroup(0, "pkg", emoji.SourceBilibili)
	groupID, _ := repo.Save(context.Background(), g)

	// 新建表情
	e1 := emoji.NewEmoji(0, groupID, "[e]", "/uploads/e1.png")
	id1, err := repo.UpsertEmojiByName(context.Background(), e1)
	require.NoError(t, err)
	assert.Greater(t, id1, int32(0))

	// 同 groupID+name 再 upsert，应更新
	e2 := emoji.NewEmoji(0, groupID, "[e]", "/uploads/e2.png")
	e2.Update("[e]", "/uploads/e2.png", "", "/uploads/e2.gif", "https://bili/e.png", 5)
	id2, err := repo.UpsertEmojiByName(context.Background(), e2)
	require.NoError(t, err)
	assert.Equal(t, id1, id2)

	loaded, _ := repo.FindEmojiByID(context.Background(), id1)
	assert.Equal(t, "/uploads/e2.png", loaded.URL())
	assert.Equal(t, "/uploads/e2.gif", loaded.GifURL())
}
```

- [ ] **Step 11: 运行确认失败**

Run: `cd api && go test ./internal/infrastructure/persistence/gorm/ -run TestUpsertEmojiByName_Upsert -v`
Expected: 编译失败 `repo.UpsertEmojiByName undefined`。

- [ ] **Step 12: GORM 实现 UpsertEmojiByName**

`media_repo.go` 在 `UpsertByName` 后加:
```go
// UpsertEmojiByName 按 groupID+name 合并表情：存在则更新，不存在则新建。
func (r *EmojiGroupRepository) UpsertEmojiByName(ctx context.Context, e emoji.Emoji) (int32, error) {
	var existing model.Emoji
	err := r.db.WithContext(ctx).
		Where("group_id = ? AND name = ?", e.GroupID(), e.Name()).
		First(&existing).Error
	if err == nil {
		updates := r.db.WithContext(ctx).Model(&model.Emoji{}).
			Where("id = ?", existing.ID).
			Updates(map[string]any{
				"url":        e.URL(),
				"source_url": e.SourceURL(),
				"gif_url":    e.GifURL(),
				"sort_order": e.SortOrder(),
			})
		if updates.Error != nil {
			return 0, domainshared.Internal("upsert 更新表情失败", updates.Error)
		}
		return existing.ID, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, domainshared.Internal("upsert 查询表情失败", err)
	}
	po := model.Emoji{
		GroupID: e.GroupID(), Name: e.Name(), URL: e.URL(),
		SourceURL: e.SourceURL(), GifURL: e.GifURL(),
		TextContent: e.TextContent(), SortOrder: e.SortOrder(),
	}
	if err := r.db.WithContext(ctx).Create(&po).Error; err != nil {
		return 0, domainshared.Internal("upsert 创建表情失败", err)
	}
	return po.ID, nil
}
```

- [ ] **Step 13: 运行转绿 + 全量仓储测试**

Run: `cd api && go test ./internal/infrastructure/persistence/gorm/ -run 'TestUpsert' -v`
Expected: 全部 PASS(5 个新测试 + 已有)。

- [ ] **Step 14: 确认接口断言通过**

Run: `cd api && go build ./internal/infrastructure/persistence/gorm/`
Expected: 编译成功(证明两方法都已实现,L229 断言)。

- [ ] **Step 15: 提交**

```bash
cd api && git add internal/domain/emoji/repository.go internal/infrastructure/persistence/gorm/media_repo.go internal/infrastructure/persistence/gorm/media_repo_test.go
git commit -m "$(cat <<'EOF'
feat(api): EmojiGroupRepository 支持 upsert 增量合并

- 新增 UpsertByName 按 name+source 合并分组（存在更新，不存在新建）
- 新增 UpsertEmojiByName 按 groupID+name 合并表情
- 用于 B站表情重新拉取，不删除历史分组
- 补 sqlite 集成测试覆盖新建/更新/同名异源场景
EOF
)"
```

---

## Task 2:RefetchStatusStore 端口与 Redis 实现

**目标**:定义任务状态存储端口,实现 Redis 版本(含并发锁)。

**Files:**
- Create: `api/internal/domain/emoji/refetch_status.go`
- Create: `api/internal/infrastructure/emoji/refetch_status_store.go`
- Create: `api/internal/infrastructure/emoji/refetch_status_store_test.go`

- [ ] **Step 1: 创建领域端口**

`api/internal/domain/emoji/refetch_status.go`:
```go
package emoji

import (
	"context"
	"time"
)

// 重新拉取任务状态
const (
	RefetchStateRunning = "running"
	RefetchStateDone    = "done"
	RefetchStateFailed  = "failed"
	RefetchStateIdle    = "idle" // 无任务
)

// RefetchProgress 重新拉取进度（seed 执行过程中回调上报）
type RefetchProgress struct {
	GroupsDone  int `json:"groups_done"`
	GroupsTotal int `json:"groups_total"`
}

// RefetchStatus 重新拉取任务状态快照（前端轮询读取）
type RefetchStatus struct {
	State      string     `json:"state"`
	StartedAt  *time.Time `json:"started_at,omitempty"`
	FinishedAt *time.Time `json:"finished_at,omitempty"`
	GroupsDone int        `json:"groups_done"`
	GroupsTotal int       `json:"groups_total"`
	Error      string     `json:"error,omitempty"`
}

// RefetchStatusStore 重新拉取任务状态存储端口。
// 实现须保证 Acquire 的原子性与并发安全（Redis SET NX）。
type RefetchStatusStore interface {
	// Acquire 原子抢锁：已有任务运行返回 shared.Conflict（→ 409），
	// 否则标记 running 并开始计时。
	Acquire(ctx context.Context) error
	// SetProgress 更新进度。
	SetProgress(ctx context.Context, p RefetchProgress) error
	// SetDone 标记成功完成。
	SetDone(ctx context.Context) error
	// SetFailed 标记失败，记录错误信息。
	SetFailed(ctx context.Context, errMsg string) error
	// Get 读取当前状态（无任务返回 StateIdle）。
	Get(ctx context.Context) (*RefetchStatus, error)
}
```

- [ ] **Step 2: 确认是否有 miniredis 依赖**

Run: `cd api && grep "miniredis\|alicebob" go.mod || echo "无 miniredis"`
若输出"无 miniredis":安装 `cd api && go get github.com/alicebob/miniredis/v2@latest`。

> miniredis 是进程内 Redis mock,用于测试,无需真实 Redis。项目若已有则跳过。

- [ ] **Step 3: 创建 Redis 实现**

`api/internal/infrastructure/emoji/refetch_status_store.go`:
```go
// Package emoji 提供表情模块的基础设施实现（Redis 状态存储等）。
package emoji

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	domainemoji "blog-api/internal/domain/emoji"
	domainshared "blog-api/internal/domain/shared"
)

const (
	refetchStatusKey = "emoji:refetch:status"
	refetchLockKey   = "emoji:refetch:lock"
	refetchLockTTL   = 1 * time.Hour // 进程崩溃兜底过期
)

// RedisRefetchStatusStore RefetchStatusStore 的 Redis 实现。
type RedisRefetchStatusStore struct {
	rdb *redis.Client
}

// NewRefetchStatusStore 创建 Redis 状态存储。
func NewRefetchStatusStore(rdb *redis.Client) *RedisRefetchStatusStore {
	return &RedisRefetchStatusStore{rdb: rdb}
}

// Acquire 原子抢锁。锁已被持有返回 shared.Conflict。
func (s *RedisRefetchStatusStore) Acquire(ctx context.Context) error {
	ok, err := s.rdb.SetNX(ctx, refetchLockKey, "locked", refetchLockTTL).Result()
	if err != nil {
		return domainshared.Internal("抢夺重新拉取锁失败", err)
	}
	if !ok {
		return domainshared.Conflict("已有重新拉取任务在运行")
	}
	now := time.Now()
	status := domainemoji.RefetchStatus{
		State:      domainemoji.RefetchStateRunning,
		StartedAt:  &now,
		GroupsDone: 0,
	}
	body, _ := json.Marshal(status)
	if err := s.rdb.Set(ctx, refetchStatusKey, body, 0).Err(); err != nil {
		s.rdb.Del(ctx, refetchLockKey)
		return domainshared.Internal("写入重新拉取状态失败", err)
	}
	return nil
}

func (s *RedisRefetchStatusStore) SetProgress(ctx context.Context, p domainemoji.RefetchProgress) error {
	status, err := s.get(ctx)
	if err != nil {
		return err
	}
	if status == nil {
		return nil // 无运行中任务，忽略
	}
	status.GroupsDone = p.GroupsDone
	status.GroupsTotal = p.GroupsTotal
	return s.set(ctx, status)
}

func (s *RedisRefetchStatusStore) SetDone(ctx context.Context) error {
	now := time.Now()
	status, _ := s.get(ctx)
	if status == nil {
		status = &domainemoji.RefetchStatus{}
	}
	status.State = domainemoji.RefetchStateDone
	status.FinishedAt = &now
	if err := s.set(ctx, status); err != nil {
		return err
	}
	return s.rdb.Del(ctx, refetchLockKey).Err()
}

func (s *RedisRefetchStatusStore) SetFailed(ctx context.Context, errMsg string) error {
	now := time.Now()
	status, _ := s.get(ctx)
	if status == nil {
		status = &domainemoji.RefetchStatus{}
	}
	status.State = domainemoji.RefetchStateFailed
	status.FinishedAt = &now
	status.Error = errMsg
	if err := s.set(ctx, status); err != nil {
		return err
	}
	return s.rdb.Del(ctx, refetchLockKey).Err()
}

func (s *RedisRefetchStatusStore) Get(ctx context.Context) (*domainemoji.RefetchStatus, error) {
	status, err := s.get(ctx)
	if err != nil {
		return nil, err
	}
	if status == nil {
		return &domainemoji.RefetchStatus{State: domainemoji.RefetchStateIdle}, nil
	}
	return status, nil
}

func (s *RedisRefetchStatusStore) get(ctx context.Context) (*domainemoji.RefetchStatus, error) {
	body, err := s.rdb.Get(ctx, refetchStatusKey).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, domainshared.Internal("读取重新拉取状态失败", err)
	}
	var status domainemoji.RefetchStatus
	if err := json.Unmarshal(body, &status); err != nil {
		return nil, fmt.Errorf("解析重新拉取状态失败: %w", err)
	}
	return &status, nil
}

func (s *RedisRefetchStatusStore) set(ctx context.Context, status *domainemoji.RefetchStatus) error {
	body, _ := json.Marshal(status)
	return s.rdb.Set(ctx, refetchStatusKey, body, 0).Err()
}
```

- [ ] **Step 4: 写测试**

`api/internal/infrastructure/emoji/refetch_status_store_test.go`:
```go
package emoji

import (
	"context"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainemoji "blog-api/internal/domain/emoji"
)

func newTestStore(t *testing.T) (*RedisRefetchStatusStore, *miniredis.Miniredis) {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	return NewRefetchStatusStore(rdb), mr
}

func TestGet_IdleWhenEmpty(t *testing.T) {
	store, _ := newTestStore(t)
	status, err := store.Get(context.Background())
	require.NoError(t, err)
	assert.Equal(t, domainemoji.RefetchStateIdle, status.State)
}

func TestAcquire_ThenConflict(t *testing.T) {
	store, _ := newTestStore(t)
	// 第一次抢锁成功
	require.NoError(t, store.Acquire(context.Background()))
	status, _ := store.Get(context.Background())
	assert.Equal(t, domainemoji.RefetchStateRunning, status.State)
	assert.NotNil(t, status.StartedAt)

	// 第二次抢锁应返回 Conflict
	err := store.Acquire(context.Background())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "已有重新拉取任务在运行")
}

func TestSetProgress(t *testing.T) {
	store, _ := newTestStore(t)
	require.NoError(t, store.Acquire(context.Background()))

	require.NoError(t, store.SetProgress(context.Background(), domainemoji.RefetchProgress{GroupsDone: 3, GroupsTotal: 10}))
	status, _ := store.Get(context.Background())
	assert.Equal(t, 3, status.GroupsDone)
	assert.Equal(t, 10, status.GroupsTotal)
}

func TestSetDone_ReleasesLock(t *testing.T) {
	store, _ := newTestStore(t)
	require.NoError(t, store.Acquire(context.Background()))

	require.NoError(t, store.SetDone(context.Background()))
	status, _ := store.Get(context.Background())
	assert.Equal(t, domainemoji.RefetchStateDone, status.State)
	assert.NotNil(t, status.FinishedAt)

	// 锁已释放，可再次 Acquire
	require.NoError(t, store.Acquire(context.Background()))
}

func TestSetFailed_ReleasesLock(t *testing.T) {
	store, _ := newTestStore(t)
	require.NoError(t, store.Acquire(context.Background()))

	require.NoError(t, store.SetFailed(context.Background(), "boom"))
	status, _ := store.Get(context.Background())
	assert.Equal(t, domainemoji.RefetchStateFailed, status.State)
	assert.Equal(t, "boom", status.Error)

	require.NoError(t, store.Acquire(context.Background()))
}

func TestAcquire_LockExpires(t *testing.T) {
	store, mr := newTestStore(t)
	require.NoError(t, store.Acquire(context.Background()))

	// 模拟锁过期（快进时间）
	mr.FastForward(refetchLockTTL + 1)

	// 锁过期后可再次 Acquire
	require.NoError(t, store.Acquire(context.Background()))
}
```

- [ ] **Step 5: 运行测试**

Run: `cd api && go test ./internal/infrastructure/emoji/ -v`
Expected: 6 个测试全 PASS。

- [ ] **Step 6: 提交**

```bash
cd api && go mod tidy
git add internal/domain/emoji/refetch_status.go internal/infrastructure/emoji/ go.mod go.sum
git commit -m "$(cat <<'EOF'
feat(api): 新增表情重新拉取任务状态存储

- domain/emoji 新增 RefetchStatus/RefetchProgress/RefetchStatusStore 端口
- infrastructure/emoji 实现 RedisRefetchStatusStore
- Acquire 用 SET NX EX 抢锁防并发，1h 过期兜底进程崩溃
- SetDone/SetFailed 释放锁，支持重试
- 用 miniredis 补并发抢锁、状态流转、锁过期 6 个测试
EOF
)"
```

---

## Task 3:seed service 加 ReseedBilibiliEmojis(走 upsert)

**目标**:给 `EmojiSeedService` 加 `ReseedBilibiliEmojis` 方法,全量重新拉取并 upsert(不走 Count 分支),带进度回调。

**Files:**
- Modify: `api/internal/service/emoji_seed_service.go`
- Modify: `api/internal/service/emoji_seed_service_test.go`

- [ ] **Step 1: 阅读 importBilibiliEmojis 现状**

Run: `cd api && sed -n '85,217p' internal/service/emoji_seed_service.go`
理解现有 `importBilibiliEmojis` 的并发下载 + 写库结构(Task 3 技术债修复后已是 errgroup 度 8 + 下载/写库分离)。`ReseedBilibiliEmojis` 要复用这套下载逻辑,但把 `repo.Save`/`repo.SaveEmoji` 换成 `repo.UpsertByName`/`repo.UpsertEmojiByName`。

- [ ] **Step 2: 加 ReseedBilibiliEmojis 方法**

在 `api/internal/service/emoji_seed_service.go` 的 `importBilibiliEmojis` 后追加:
```go
// ReseedBilibiliEmojis 全量重新拉取 B站表情并按 name 增量合并（upsert）。
// 与 SeedBilibiliEmojis 的区别：永远走全量 upsert，不看分组计数；
// 不删除任何分组（B站不再返回的历史分组保留）。
// progress 回调每完成一个分组上报进度，可为 nil。
func (s *EmojiSeedService) ReseedBilibiliEmojis(ctx context.Context, progress func(domainemoji.RefetchProgress)) error {
	log.Info().Str("operation", "ReseedBilibiliEmojis").Msg("开始重新拉取 B站表情（upsert）")

	packages, err := s.client.FetchEmojis(ctx, s.apiType)
	if err != nil {
		return fmt.Errorf("获取 B站表情失败: %w", err)
	}
	log.Info().Int("packages", len(packages)).Msg("获取到表情包组")

	if progress != nil {
		progress(domainemoji.RefetchProgress{GroupsTotal: len(packages)})
	}

	done := 0
	for i, pkg := range packages {
		if pkg.Text == "" || len(pkg.Emote) == 0 {
			done++
			if progress != nil {
				progress(domainemoji.RefetchProgress{GroupsDone: done, GroupsTotal: len(packages)})
			}
			continue
		}

		// 封面下载
		coverURL, err := s.downloadCoverImage(ctx, pkg)
		if err != nil {
			log.Warn().Err(err).Str("group", pkg.Text).Msg("下载分组封面失败，使用远程 URL 兜底")
			coverURL = bilibili.PackageCoverURL(pkg)
		}

		// upsert 分组
		g, err := domainemoji.NewEmojiGroup(0, pkg.Text, domainemoji.SourceBilibili)
		if err != nil {
			log.Printf("警告: 构造分组 %s 失败: %v", pkg.Text, err)
			done++
			continue
		}
		g.SetCoverURL(coverURL)
		g.SetSortOrder(i + 1)
		g.SetEnabled(true)
		groupID, err := s.repo.UpsertByName(ctx, g)
		if err != nil {
			log.Printf("警告: upsert 分组 %s 失败: %v", pkg.Text, err)
			done++
			continue
		}

		// 并发下载表情图（复用 importBilibiliEmojis 的 errgroup 逻辑）
		emojis := s.downloadPackageEmojis(ctx, pkg, groupID)
		for _, de := range emojis {
			domainEmoji := domainemoji.NewEmoji(0, groupID, de.emote.Text, de.url)
			domainEmoji.Update(de.emote.Text, de.url, "", de.gifURL, de.sourceURL, de.sortOrder)
			if _, err := s.repo.UpsertEmojiByName(ctx, domainEmoji); err != nil {
				log.Printf("警告: upsert 表情 %s 失败: %v", de.emote.Text, err)
			}
		}

		done++
		if progress != nil {
			progress(domainemoji.RefetchProgress{GroupsDone: done, GroupsTotal: len(packages)})
		}
	}

	log.Info().Int("packages", done).Msg("重新拉取完成")
	return nil
}
```

- [ ] **Step 3: 抽取 downloadPackageEmojis 辅助方法**

为避免 `ReseedBilibiliEmojis` 与 `importBilibiliEmojis` 的下载逻辑重复,把并发下载部分抽成独立方法。在 `importBilibiliEmojis` 后加:
```go
// downloadedEmoji 单个表情的下载结果
type downloadedEmoji struct {
	emote     bilibili.Emote
	url       string // 本地路径，颜文字为文本本身
	gifURL    string
	sourceURL string
	sortOrder int
}

// downloadPackageEmojis 并发下载一个包内所有表情图（并发度 8），返回按原序排序的结果。
// 纯下载不写库，供 importBilibiliEmojis 和 ReseedBilibiliEmojis 复用。
func (s *EmojiSeedService) downloadPackageEmojis(ctx context.Context, pkg bilibili.Package, groupID int32) []downloadedEmoji {
	eg, _ := errgroup.WithContext(ctx)
	eg.SetLimit(8)
	var mu sync.Mutex
	results := make([]downloadedEmoji, 0, len(pkg.Emote))

	for j, emote := range pkg.Emote {
		if emote.Text == "" {
			continue
		}
		eg.Go(func() error {
			isTextEmoji := emote.URL == "" || emote.URL == emote.Text
			var urlValue, gifUrlValue, sourceUrlValue string
			if isTextEmoji {
				urlValue = emote.Text
			} else {
				localStaticPath, err := s.downloader.Download(emote.URL)
				if err != nil {
					log.Printf("警告: 下载表情 %s 静态图失败: %v", emote.Text, err)
					return nil
				}
				urlValue = localStaticPath
				sourceUrlValue = emote.URL
				if emote.GifURL != "" {
					if localGifPath, err := s.downloader.Download(emote.GifURL); err == nil {
						gifUrlValue = localGifPath
					} else {
						log.Printf("警告: 下载表情 %s 动图失败: %v", emote.Text, err)
					}
				}
			}
			mu.Lock()
			results = append(results, downloadedEmoji{
				emote: emote, url: urlValue, gifURL: gifUrlValue,
				sourceURL: sourceUrlValue, sortOrder: j + 1,
			})
			mu.Unlock()
			return nil
		})
	}
	_ = eg.Wait()

	sort.Slice(results, func(i, k int) bool {
		return results[i].sortOrder < results[k].sortOrder
	})
	return results
}
```

- [ ] **Step 4: import 增加领域包**

确认 `emoji_seed_service.go` 顶部 import 是否已有 `domainemoji "blog-api/internal/domain/emoji"`。前序 Task 5 已加,确认存在。

- [ ] **Step 5: 写测试**

追加到 `api/internal/service/emoji_seed_service_test.go`:
```go
func TestReseedBilibiliEmojis_UpsertNotSave(t *testing.T) {
	repo := new(mocks.MockEmojiGroupRepository)
	// 关键：验证走 UpsertByName 而非 Save
	repo.On("UpsertByName", mock.Anything, mock.Anything).Return(int32(1), nil)
	repo.On("UpsertEmojiByName", mock.Anything, mock.Anything).Return(int32(1), nil)

	srv := imgServer(t)
	defer srv.Close()

	svc := &EmojiSeedService{
		repo:       repo,
		downloader: bilibili.NewDownloader(t.TempDir(), "/uploads/"),
	}

	packages := []bilibili.Package{{
		Text: "pkg", URL: srv.URL + "/c.png", Type: 1,
		Emote: []bilibili.Emote{{Text: "[e]", URL: srv.URL + "/e.png"}},
	}}

	var lastProgress domainemoji.RefetchProgress
	err := svc.ReseedBilibiliEmojis(context.Background(), func(p domainemoji.RefetchProgress) {
		lastProgress = p
	})
	require.NoError(t, err)
	repo.AssertNumberOfCalls(t, "UpsertByName", 1)
	repo.AssertNumberOfCalls(t, "UpsertEmojiByName", 1)
	repo.AssertNotCalled(t, "Save")
	assert.Equal(t, 1, lastProgress.GroupsDone)
	assert.Equal(t, 1, lastProgress.GroupsTotal)
}
```

- [ ] **Step 6: 编译 + 测试**

Run: `cd api && go build ./internal/service/ && go test ./internal/service/ -run TestReseed -v`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
cd api && git add internal/service/emoji_seed_service.go internal/service/emoji_seed_service_test.go
git commit -m "$(cat <<'EOF'
feat(api): EmojiSeedService 支持全量重新拉取（upsert）

- 新增 ReseedBilibiliEmojis 走 UpsertByName/UpsertEmojiByName 增量合并
- 不看分组计数，永远全量 upsert，不删除历史分组
- 抽取 downloadPackageEmojis 复用并发下载逻辑
- progress 回调上报分组进度
- 补测试验证走 upsert 而非 save + 进度回调
EOF
)"
```

---

## Task 4:应用层 Refetch 用例 + EmojiService 改造

**目标**:`EmojiService` 加 `ReseedRunner` 接口依赖和 `Refetch`/`GetRefetchStatus` 方法,编排加锁→异步→状态。

**Files:**
- Modify: `api/internal/application/media/service.go`

- [ ] **Step 1: 阅读 EmojiService 现状**

Run: `cd api && sed -n '70,90p' internal/application/media/service.go`
当前结构体字段 `repo/emojiDir/urlPrefix`,`NewEmojiService(repo, emojiDir, urlPrefix)`。

- [ ] **Step 2: 加 ReseedRunner 接口 + 扩展结构体**

在 `service.go` 的 `EmojiService` 结构体定义前加接口,并扩展结构体与构造函数:
```go
// ReseedRunner 执行 B站表情重新拉取（由 EmojiSeedService 实现，打破对 service 包的依赖）。
type ReseedRunner interface {
	Reseed(ctx context.Context, progress func(domainemoji.RefetchProgress)) error
}
```

结构体改为:
```go
// EmojiService 表情用例服务
type EmojiService struct {
	repo        domainemoji.EmojiGroupRepository
	emojiDir    string
	urlPrefix   string
	reseeder    ReseedRunner                  // 重新拉取执行器
	statusStore domainemoji.RefetchStatusStore // 重新拉取任务状态
}
```

构造函数改为:
```go
// NewEmojiService 构造表情服务。
//
// emojiDir 为表情文件物理存储目录，urlPrefix 为上传 URL 前缀，二者解耦。
// reseeder/statusStore 用于「重新拉取」功能，可为 nil（禁用该功能）。
func NewEmojiService(
	repo domainemoji.EmojiGroupRepository,
	emojiDir, urlPrefix string,
	reseeder ReseedRunner,
	statusStore domainemoji.RefetchStatusStore,
) *EmojiService {
	return &EmojiService{
		repo: repo, emojiDir: emojiDir, urlPrefix: urlPrefix,
		reseeder: reseeder, statusStore: statusStore,
	}
}
```

- [ ] **Step 3: 加 Refetch / GetRefetchStatus 方法**

在 `service.go` 的 EmojiService 方法区(其他 emoji 方法后)加:
```go
// Refetch 异步触发 B站表情重新拉取。立即返回当前状态(running)。
// 已有任务运行返回 shared.Conflict（→ 409）。
func (s *EmojiService) Refetch(ctx context.Context) (*domainemoji.RefetchStatus, error) {
	if s.reseeder == nil || s.statusStore == nil {
		return nil, domainshared.BadRequest("重新拉取功能未配置")
	}
	if err := s.statusStore.Acquire(ctx); err != nil {
		return nil, err
	}
	// 异步执行，不继承请求 ctx（请求结束后任务继续）
	go func() {
		progress := func(p domainemoji.RefetchProgress) {
			if err := s.statusStore.SetProgress(context.Background(), p); err != nil {
				log.Warn().Err(err).Msg("上报重新拉取进度失败")
			}
		}
		if err := s.reseeder.Reseed(context.Background(), progress); err != nil {
			log.Error().Err(err).Msg("重新拉取失败")
			_ = s.statusStore.SetFailed(context.Background(), err.Error())
			return
		}
		_ = s.statusStore.SetDone(context.Background())
	}()
	return s.statusStore.Get(ctx)
}

// GetRefetchStatus 读取重新拉取任务状态（供前端轮询）。
func (s *EmojiService) GetRefetchStatus(ctx context.Context) (*domainemoji.RefetchStatus, error) {
	if s.statusStore == nil {
		return &domainemoji.RefetchStatus{State: domainemoji.RefetchStateIdle}, nil
	}
	return s.statusStore.Get(ctx)
}
```

> import 确认:`service.go` 顶部需有 `log` 包(zerolog)。检查是否已 import,没有则加 `"github.com/rs/zerolog/log"`。

- [ ] **Step 4: 适配 NewEmojiService 的现有调用方**

`media_container.go` L29 当前是 `emojiSvc := appmedia.NewEmojiService(emojiRepo, emojiDir, urlPrefix)`。Task 5 会改造它,本步骤先让它编译通过——临时传 nil:
```go
emojiSvc := appmedia.NewEmojiService(emojiRepo, emojiDir, urlPrefix, nil, nil)
```
（Task 5 Step 会替换为真实依赖。这只是过渡,不会提交这个临时状态。)

Run: `cd api && go build ./...`
Expected: 编译通过。

- [ ] **Step 5: 写测试**

创建 `api/internal/application/media/emoji_refetch_test.go`:
```go
package media

import (
	"context"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	domainemoji "blog-api/internal/domain/emoji"
)

// fakeReseeder 记录是否被调用
type fakeReseeder struct {
	called atomic.Bool
}

func (f *fakeReseeder) Reseed(ctx context.Context, progress func(domainemoji.RefetchProgress)) error {
	f.called.Store(true)
	return nil
}

func TestRefetch_RunsAsyncAndSetsDone(t *testing.T) {
	store := new(mockRefetchStore)
	store.On("Acquire", mock.Anything).Return(nil)
	store.On("SetProgress", mock.Anything, mock.Anything).Return(nil)
	store.On("SetDone", mock.Anything).Return(nil)
	store.On("Get", mock.Anything).Return(&domainemoji.RefetchStatus{State: domainemoji.RefetchStateRunning}, nil)

	runner := &fakeReseeder{}
	svc := &EmojiService{reseeder: runner, statusStore: store}

	status, err := svc.Refetch(context.Background())
	require.NoError(t, err)
	assert.Equal(t, domainemoji.RefetchStateRunning, status.State)

	// 等待 goroutine 执行（异步）
	// poll 最多 1s
	for i := 0; i < 100 && !runner.called.Load(); i++ {
	}
	require.True(t, runner.called.Load(), "Reseed 应被调用")
	store.AssertCalled(t, "SetDone", mock.Anything)
}

func TestRefetch_AlreadyRunningReturnsConflict(t *testing.T) {
	store := new(mockRefetchStore)
	store.On("Acquire", mock.Anything).Return(domainshared.Conflict("已有重新拉取任务在运行"))

	svc := &EmojiService{reseeder: &fakeReseeder{}, statusStore: store}
	_, err := svc.Refetch(context.Background())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "已有重新拉取任务在运行")
	store.AssertNotCalled(t, "SetDone")
}
```

需补一个 mock store。在同目录加 `emoji_refetch_test.go` 顶部或单独定义:
```go
// mockRefetchStore RefetchStatusStore 的 mock
type mockRefetchStore struct{ mock.Mock }

func (m *mockRefetchStore) Acquire(ctx context.Context) error {
	return m.Called(ctx).Error(0)
}
func (m *mockRefetchStore) SetProgress(ctx context.Context, p domainemoji.RefetchProgress) error {
	return m.Called(ctx, p).Error(0)
}
func (m *mockRefetchStore) SetDone(ctx context.Context) error {
	return m.Called(ctx).Error(0)
}
func (m *mockRefetchStore) SetFailed(ctx context.Context, errMsg string) error {
	return m.Called(ctx, errMsg).Error(0)
}
func (m *mockRefetchStore) Get(ctx context.Context) (*domainemoji.RefetchStatus, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domainemoji.RefetchStatus), args.Error(1)
}
```

> import 需含 `domainshared "blog-api/internal/domain/shared"`。

- [ ] **Step 6: 运行测试**

Run: `cd api && go test ./internal/application/media/ -run TestRefetch -v`
Expected: 2 个测试 PASS。

> 注意异步测试的时序:`for i := 0; i < 100 && !runner.called.Load(); i++ {}` 可能太快。改为带短暂 sleep 的轮询:
> ```go
> for i := 0; i < 100; i++ {
>     if runner.called.Load() { break }
>     time.Sleep(10 * time.Millisecond)
> }
> ```

- [ ] **Step 7: 提交**

```bash
cd api && git add internal/application/media/service.go internal/application/media/emoji_refetch_test.go
git commit -m "$(cat <<'EOF'
feat(api): EmojiService 新增重新拉取用例编排

- 新增 ReseedRunner 接口打破对 service 包依赖
- EmojiService 加 reseeder/statusStore 依赖
- Refetch 异步触发：Acquire 抢锁 → goroutine 执行 → SetDone/SetFailed
- GetRefetchStatus 读取状态供前端轮询
- 补 mock store 测试覆盖正常执行与并发冲突
EOF
)"
```

---

## Task 5:media handler + 装配 + 路由鉴权

**目标**:handler 加两个方法;container 装配注入 reseeder + statusStore;main.go 加路由 + 权限中间件;新建权限点 migration。

**Files:**
- Modify: `api/internal/interfaces/http/handler/media/media.go`
- Modify: `api/internal/app/media_container.go`
- Modify: `api/cmd/server/main.go`
- Create: `api/migrations/057_add_emoji_refetch_permission.{up,down}.sql`
- Modify: `api/internal/domain/permission/entity.go`

- [ ] **Step 1: 确认 migration 最新编号**

Run: `cd api && ls migrations/ | grep -oE '^[0-9]+' | sort -n | tail -1`
确认最大编号(假设是 056,本计划用 057;若不同则替换)。

- [ ] **Step 2: 创建权限点 migration**

`api/migrations/057_add_emoji_refetch_permission.up.sql`:
```sql
INSERT INTO permissions (code, name, description, type) VALUES
    ('emoji:refetch', '重新拉取表情', '触发 B站表情全量重新拉取', 'action')
ON CONFLICT (code) DO NOTHING;
```

`api/migrations/057_add_emoji_refetch_permission.down.sql`:
```sql
DELETE FROM permissions WHERE code = 'emoji:refetch';
```

- [ ] **Step 3: 加权限常量**

`api/internal/domain/permission/entity.go` 在 emoji 权限常量区(entity.go:91-93 附近)加:
```go
	EmojiRefetch = Code("emoji:refetch") // 重新拉取 B站表情
```

- [ ] **Step 4: 运行迁移**

Run: `cd /Users/issuser/Developer/xfy/mimo-blog && make migrate`
确认 `057` 应用成功。

- [ ] **Step 5: handler 加两个方法**

`api/internal/interfaces/http/handler/media/media.go` 在 emoji 方法区末尾加:
```go
// RefetchBilibiliEmojis POST /admin/emojis/bilibili/refetch
// 异步触发 B站表情重新拉取，返回 202 + 当前状态。已在运行返回 409。
func (h *Handler) RefetchBilibiliEmojis(w http.ResponseWriter, r *http.Request) {
	status, err := h.emojiSvc.Refetch(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.WriteJSON(w, http.StatusAccepted, status)
}

// GetRefetchStatus GET /admin/emojis/bilibili/refetch/status
func (h *Handler) GetRefetchStatus(w http.ResponseWriter, r *http.Request) {
	status, err := h.emojiSvc.GetRefetchStatus(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, status)
}
```

- [ ] **Step 6: 改造 NewMediaContainer 装配**

`api/internal/app/media_container.go` 的 `NewMediaContainer` 签名扩展,接收 reseeder + statusStore,传给 `NewEmojiService`。

当前 L20:
```go
func NewMediaContainer(db *gorm.DB, emojiDir, chunkDir, uploadDir, urlPrefix string) *MediaContainer {
```
改为:
```go
func NewMediaContainer(
	db *gorm.DB,
	rdb *redis.Client,
	emojiDir, chunkDir, uploadDir, urlPrefix string,
	reseeder appmedia.ReseedRunner,
	statusStore domainemoji.RefetchStatusStore,
) *MediaContainer {
```
L29 `emojiSvc` 行改为:
```go
emojiSvc := appmedia.NewEmojiService(emojiRepo, emojiDir, urlPrefix, reseeder, statusStore)
```
import 增加 `"github.com/redis/go-redis/v9"`、`domainemoji "blog-api/internal/domain/emoji"`(redis 实际在 main.go 传入,container 内若不用 rdb 则可不加 redis import——但签名要收。若 container 内不直接用 rdb,改为不在 container 收 rdb,只收 reseeder + statusStore 更干净):

> **修正**:container 不需要 rdb(statusStore 已是成品),签名应为:
> ```go
> func NewMediaContainer(
> 	db *gorm.DB, emojiDir, chunkDir, uploadDir, urlPrefix string,
> 	reseeder appmedia.ReseedRunner, statusStore domainemoji.RefetchStatusStore,
> ) *MediaContainer {
> ```

- [ ] **Step 7: 改造 main.go 装配**

`api/cmd/server/main.go` L150 区域。当前:
```go
mediaContainer := app.NewMediaContainer(gormDB, emojiDir, chunkDir, uploadRoot, urlPrefix)
emojiRepo := gormrepo.NewEmojiGroupRepository(gormDB)
emojiSeedService := service.NewEmojiSeedService(emojiRepo, emojiDir, urlPrefix, cfg.BilibiliCookie, cfg.BilibiliAPIType)
```
调整为(顺序:先 repo → seedService → statusStore → container):
```go
emojiRepo := gormrepo.NewEmojiGroupRepository(gormDB)
emojiSeedService := service.NewEmojiSeedService(emojiRepo, emojiDir, urlPrefix, cfg.BilibiliCookie, cfg.BilibiliAPIType)
refetchStatusStore := infraemoji.NewRefetchStatusStore(redisClient)
mediaContainer := app.NewMediaContainer(gormDB, emojiDir, chunkDir, uploadRoot, urlPrefix, emojiSeedService, refetchStatusStore)
```
import 增加 `infraemoji "blog-api/internal/infrastructure/emoji"`。

- [ ] **Step 8: emoji 路由组加 refetch 路由 + 权限**

`api/cmd/server/main.go` L495 的 `r.Route("/emojis", ...)` 内,在末尾(emoji 图片上传注释前)加:
```go
				// B站表情重新拉取（需 emoji:refetch 权限）
				r.With(middleware.RequirePermission(permissionChecker, "emoji:refetch")).
					Post("/bilibili/refetch", mediaH.RefetchBilibiliEmojis)
				r.With(middleware.RequirePermission(permissionChecker, "emoji:refetch")).
					Get("/bilibili/refetch/status", mediaH.GetRefetchStatus)
```
确认 `middleware` 和 `permissionChecker` 在此作用域可见(同文件已有大量 `middleware.RequirePermission(permissionChecker, ...)` 用例,如 L269)。

- [ ] **Step 9: 全量编译**

Run: `cd api && go build ./...`
Expected: 编译通过。

- [ ] **Step 10: 全量测试**

Run: `cd api && go test ./... && go vet ./...`
Expected: 全绿。

- [ ] **Step 11: 提交(分两个 commit:权限点与路由/装配分离)**

Commit 1 — 权限点:
```bash
cd api && git add migrations/057_add_emoji_refetch_permission.up.sql migrations/057_add_emoji_refetch_permission.down.sql internal/domain/permission/entity.go
git commit -m "$(cat <<'EOF'
feat(api): 新增 emoji:refetch 权限点

- migration 种子插入 emoji:refetch 权限码
- permission domain 加 EmojiRefetch 常量
EOF
)"
```

Commit 2 — handler/装配/路由:
```bash
cd api && git add internal/interfaces/http/handler/media/media.go internal/app/media_container.go cmd/server/main.go
git commit -m "$(cat <<'EOF'
feat(api): 接入 B站表情重新拉取 HTTP 接口

- media handler 加 RefetchBilibiliEmojis（202）/GetRefetchStatus
- NewMediaContainer 注入 reseeder + statusStore
- main.go 构造 refetchStatusStore 并装配
- emoji 路由组加 /bilibili/refetch 与 status 路由
- 两路由均挂 RequirePermission(emoji:refetch)
EOF
)"
```

---

## Task 6:前端类型与 API 层

**目标**:前端加 RefetchStatus 类型、refetch mutation、status 轮询 query。

**Files:**
- Modify: `web/src/features/admin-emojis/model/types.ts`
- Modify: `web/src/features/admin-emojis/api/keys.ts`
- Modify: `web/src/features/admin-emojis/api/mutations.ts`
- Modify: `web/src/features/admin-emojis/api/queries.ts`

- [ ] **Step 1: 加 RefetchStatus 类型**

`web/src/features/admin-emojis/model/types.ts` 末尾加:
```ts
/** B站表情重新拉取任务状态 */
export interface RefetchStatus {
    state: "idle" | "running" | "done" | "failed";
    started_at?: string;
    finished_at?: string;
    groups_done: number;
    groups_total: number;
    error?: string;
}
```

- [ ] **Step 2: 加 query key**

`web/src/features/admin-emojis/api/keys.ts` 的 `adminEmojiKeys` 工厂内加:
```ts
    refetchStatus: () => [...adminEmojiKeys.all, "refetch-status"] as const,
```

- [ ] **Step 3: 加 useRefetchBilibiliEmojis mutation**

`web/src/features/admin-emojis/api/mutations.ts` 末尾加:
```ts
/** useRefetchBilibiliEmojis - 触发 B站表情重新拉取，POST /admin/emojis/bilibili/refetch */
export const useRefetchBilibiliEmojis = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => apiPost<void>("/admin/emojis/bilibili/refetch"),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: adminEmojiKeys.refetchStatus() });
        },
    });
};
```

- [ ] **Step 4: 加 useRefetchStatus 轮询 query**

`web/src/features/admin-emojis/api/queries.ts` 末尾加:
```ts
/** useRefetchStatus - 轮询重新拉取任务状态，仅 running 时每 2s 轮询 */
export const useRefetchStatus = () =>
    useQuery({
        queryKey: adminEmojiKeys.refetchStatus(),
        queryFn: () => apiGet<RefetchStatus>("/admin/emojis/bilibili/refetch/status"),
        refetchInterval: (query) => {
            const data = query.state.data;
            if (!data) return false;
            return data.state === "running" ? 2000 : false;
        },
    });
```
import 确认:文件顶部加 `RefetchStatus` 类型 import 和 `adminEmojiKeys` import(若未引入)。

- [ ] **Step 5: 类型检查 + 格式化**

Run: `cd /Users/issuser/Developer/xfy/mimo-blog && make web-typecheck && make web-format`
Expected: 无类型错误。

- [ ] **Step 6: 提交**

```bash
cd web && git add src/features/admin-emojis/model/types.ts src/features/admin-emojis/api/keys.ts src/features/admin-emojis/api/mutations.ts src/features/admin-emojis/api/queries.ts
git commit -m "$(cat <<'EOF'
feat(web): 表情重新拉取 API 层

- 加 RefetchStatus 类型
- 加 refetchStatus query key
- 加 useRefetchBilibiliEmojis mutation 触发拉取
- 加 useRefetchStatus 轮询查询，仅 running 时 2s 轮询
EOF
)"
```

---

## Task 7:前端 RefetchBilibiliButton 组件 + 页面接入

**目标**:新建按钮组件(含 confirm + 进度展示 + 完成/失败 toast),接入 admin.emojis 页面 PageShell.action。

**Files:**
- Create: `web/src/features/admin-emojis/ui/RefetchBilibiliButton.tsx`
- Modify: `web/src/routes/admin.emojis.tsx`

- [ ] **Step 1: 阅读 admin.emojis.tsx 的 PageShell.action 区**

Run: `cd web && sed -n '140,155p' src/routes/admin.emojis.tsx`
理解现有 action 区结构(创建分组按钮)。确认现有 confirm/dialog 组件用法。

- [ ] **Step 2: 确认 confirm 弹窗方案**

Run: `cd web && grep -rn "window.confirm\|ConfirmDialog\|AlertDialog" src/ | head`
查看项目是否有 ConfirmDialog 组件。若无,用 `window.confirm`(最简,符合 YAGNI)。

- [ ] **Step 3: 创建 RefetchBilibiliButton 组件**

`web/src/features/admin-emojis/ui/RefetchBilibiliButton.tsx`:
```tsx
import { useEffect } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@shared/ui/button";
import { useRefetchBilibiliEmojis } from "../api/mutations";
import { useRefetchStatus } from "../api/queries";
import { adminEmojiKeys } from "../api/keys";

/** RefetchBilibiliButton 重新拉取 B站表情按钮（含确认、进度、完成刷新） */
export const RefetchBilibiliButton = () => {
    const qc = useQueryClient();
    const { data: status } = useRefetchStatus();
    const refetch = useRefetchBilibiliEmojis();

    const isRunning = status?.state === "running";
    const isFailed = status?.state === "failed";

    // 失败时 toast（仅状态切到 failed 时触发一次）
    useEffect(() => {
        if (isFailed && status?.error) {
            toast.error(`重新拉取失败: ${status.error}`);
        }
    }, [isFailed, status?.error]);

    // 完成时刷新分组列表 + toast
    useEffect(() => {
        if (status?.state === "done") {
            qc.invalidateQueries({ queryKey: adminEmojiKeys.adminGroupList() });
            toast.success("B站表情重新拉取完成");
        }
    }, [status?.state, qc]);

    const handleClick = () => {
        if (
            !window.confirm(
                "将按名称合并 B站表情，你的自定义分组和历史数据不受影响。已下架的 B站表情不会被删除。是否继续？",
            )
        ) {
            return;
        }
        refetch.mutate(undefined, {
            onError: (err) => {
                const msg = err.message.includes("已有") ? "任务进行中，请等待" : err.message;
                toast.error(msg);
            },
        });
    };

    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isRunning || refetch.isPending}
            onClick={handleClick}
        >
            {isRunning ? (
                <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : (
                <RefreshCw className="mr-1 size-3.5" />
            )}
            {isRunning
                ? `拉取中 ${status?.groups_done ?? 0}/${status?.groups_total ?? 0}`
                : "重新拉取"}
        </Button>
    );
};
```

> 确认 `@shared/ui/button` 的 Button 组件存在且支持 `variant`/`size` props(Run: `cd web && ls src/shared/ui/button*`)。若 Button 路径不同则调整 import。

- [ ] **Step 4: 接入 admin.emojis.tsx 页面**

`web/src/routes/admin.emojis.tsx` 的 `PageShell action`(L145 附近)区,在现有"创建分组"按钮旁加:
```tsx
import { RefetchBilibiliButton } from "@/features/admin-emojis/ui/RefetchBilibiliButton";
// ...
<PageShell
    action={
        <div className="flex items-center gap-2">
            <RefetchBilibiliButton />
            {/* 现有的创建分组按钮 */}
        </div>
    }
>
```

> 确认 `@/` 别名指向 `src/`(检查 `web/tsconfig.json`/`vite.config.ts`)。若用相对路径则调整。

- [ ] **Step 5: 类型检查 + 格式化**

Run: `cd /Users/issuser/Developer/xfy/mimo-blog && make web-typecheck && make web-format`
Expected: 无错误。

- [ ] **Step 6: 提交(分两个 commit:组件与页面接入分离)**

Commit 1 — 组件:
```bash
cd web && git add src/features/admin-emojis/ui/RefetchBilibiliButton.tsx
git commit -m "$(cat <<'EOF'
feat(web): 新增 B站表情重新拉取按钮组件

- RefetchBilibiliButton 含确认弹窗、进度展示、完成/失败 toast
- running 时按钮禁用 + 显示 done/total 进度
- 完成后自动刷新分组列表
- 并发冲突(409)提示任务进行中
EOF
)"
```

Commit 2 — 接入:
```bash
cd web && git add src/routes/admin.emojis.tsx
git commit -m "$(cat <<'EOF'
feat(web): 后台表情页接入重新拉取按钮

- PageShell.action 接入 RefetchBilibiliButton
EOF
)"
```

---

## Self-Review

### Spec 覆盖
- [x] upsert 增量合并 → Task 1(UpsertByName/UpsertEmojiByName)
- [x] RefetchStatusStore 端口 + Redis 实现 → Task 2
- [x] seed service Reseed(走 upsert,不走 Count) → Task 3
- [x] EmojiService.Refetch 编排(加锁→异步→状态) → Task 4
- [x] RBAC 权限点 emoji:refetch → Task 5(migration + 路由中间件)
- [x] 现有 emoji 写路由补细粒度权限 → **未覆盖**(spec 提及但范围可选;本计划聚焦新功能,补权限单列为可选后续,见下方)
- [x] handler + 装配 + 路由 → Task 5
- [x] 前端 API 层 → Task 6
- [x] 前端按钮 + 进度 + 接入 → Task 7
- [x] 异步 + 状态轮询 → Task 2(store)+ Task 4(编排)+ Task 6(轮询 query)
- [x] 并发保护(Redis SET NX) → Task 2(Acquire)
- [x] 保留历史分组(不删除) → Task 1(upsert 不 delete)+ Task 3(不 delete)

### 显式排除(已在 spec 说明)
- 给现有 9 条 emoji 写路由补细粒度权限(spec 提及"顺手修缺口",但本计划聚焦新功能,避免 scope 蔓延;可作为独立后续提交)
- SSE/WebSocket(用轮询)
- 历史审计日志(只留最后一次状态)

### 类型一致性核对
- `domainemoji.RefetchStatus` / `RefetchProgress`:Task 2 定义,Task 3/4/5 全部引用此命名 ✓
- `RefetchStatusStore.Acquire(ctx) error`:Task 2 定义返回 `shared.Conflict`,Task 4 测试 mock 一致 ✓
- `ReseedRunner.Reseed(ctx, func(RefetchProgress)) error`:Task 4 定义,Task 3 的 `ReseedBilibiliEmojis` 签名匹配(`func(domainemoji.RefetchProgress)`)✓
- `NewEmojiService(repo, emojiDir, urlPrefix, reseeder, statusStore)`:Task 4 定义,Task 5 装配调用一致 ✓
- `NewMediaContainer(db, emojiDir, chunkDir, uploadDir, urlPrefix, reseeder, statusStore)`:Task 5 定义,main.go 调用一致 ✓
- `infraemoji.NewRefetchStatusStore(redisClient)`:Task 2 定义,Task 5 main.go 引用一致 ✓

### 风险点
1. **Task 3 复用 downloadPackageEmojis**:抽取后需确认 `importBilibiliEmojis` 也改用该辅助方法(避免两份并发逻辑)。实现时把 `importBilibiliEmojis` 内层循环也替换为调 `downloadPackageEmojis`。
2. **Task 4 异步测试时序**:用带 sleep 的轮询替代空循环,避免 flaky。
3. **Task 5 migration 编号**:实际执行时先查最新号,057 可能需调整。
4. **Task 7 Button 组件路径**:实现时先确认 `@shared/ui/button` 确切路径和 props。

---

## 执行顺序总览

| 顺序 | Task | 提交数 | 层 | 说明 |
|---|---|---|---|---|
| 1 | 仓储 upsert | 1 | 后端 domain+infra | TDD,纯新增方法 |
| 2 | RefetchStatusStore | 1 | 后端 domain+infra | 端口+Redis实现+miniredis测试 |
| 3 | seed Reseed | 1 | 后端 service | 走 upsert + 进度回调 |
| 4 | EmojiService Refetch | 1 | 后端 application | 编排+mock测试 |
| 5 | handler/装配/路由/权限 | 2 | 后端 interfaces+app+cmd | 含 migration |
| 6 | 前端 API 层 | 1 | 前端 api | 类型+mutation+query |
| 7 | 前端按钮+接入 | 2 | 前端 ui | 组件+页面 |

总计 9 个 commit,前后端分离,每个独立可 revert。
