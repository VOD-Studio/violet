# B站表情「重新拉取」HTTP 接口 Design Spec

## Goal

在后台表情管理页(`/admin/emojis`)提供「重新拉取 B站表情」按钮,点击后异步全量重新拉取 B站表情面板,按分组名增量合并(upsert)到数据库,前端轮询任务状态直到完成。

## 决策记录(已与用户确认)

| 决策点 | 选择 | 理由 |
|---|---|---|
| 数据冲突策略 | **增量合并(upsert)** | 按 name 匹配,存在则更新、不存在则新建,不丢任何历史数据 |
| 鉴权 | **RBAC 权限点** `emoji:refetch` | 规范化,可赋给任意角色;顺便给现有 emoji 写路由补细粒度权限 |
| 执行模式 | **异步 + 状态轮询** | 下载数百张图耗时长,同步会超时 |
| 历史分组处理 | **保留本地不动** | B站不再返回的分组保留(可能累积已下架分组,但用户自定义不丢) |

## Architecture(方案 B:职责分离)

```
POST /admin/emojis/bilibili/refetch   [RequirePermission emoji:refetch]
   │  EmojiService.Refetch(ctx)
   │   ├─ statusStore.Acquire()        ── 抢锁失败 → ErrConflict → 409
   │   ├─ go func() { ... }()          ── 异步执行
   │   │     ├─ statusStore.SetRunning()
   │   │     ├─ reseeder.Reseed(ctx, progress)        ← EmojiSeedService 实现
   │   │     │     ├─ bilibili.Client.FetchEmojis()
   │   │     │     └─ upsertBilibiliEmojis(packages, progress)
   │   │     │           ├─ 逐包:repo.UpsertByName()  ← 按 name 合并分组
   │   │     │           └─ 逐表情:repo.UpsertEmojiByName()  ← 按 groupID+name 合并
   │   │     └─ statusStore.SetDone()/SetFailed(err)
   │   └─ return 202 + 状态快照

GET /admin/emojis/bilibili/refetch/status
   └─ statusStore.Get() → 状态 JSON
```

### 组件清单与职责

| 组件 | 位置 | 职责 | 新建/修改 |
|---|---|---|---|
| `EmojiGroupRepository.UpsertByName` | domain/emoji + gorm impl | 按 name+source 合并分组,存在更新 cover/sort/enabled,不存在新建,返回 ID | 修改(接口+实现) |
| `EmojiGroupRepository.UpsertEmojiByName` | 同上 | 按 groupID+name 合并表情 | 修改(接口+实现) |
| `Reseeder` 接口 | application/media | 最小端口 `Reseed(ctx, progress) error`,打破 EmojiService→seed service 的依赖 | 新建 |
| `EmojiSeedService.ReseedBilibiliEmojis` | service 层 | 实现 Reseeder;调 fetch + upsert,不走 Count 分支;调 progress 回调上报进度 | 修改 |
| `RefetchStatusStore` 端口 + Redis 实现 | domain/emoji + infrastructure | 任务状态原子机:Acquire/SetRunning/SetProgress/SetDone/SetFailed/Get | 新建 |
| `EmojiService.Refetch` / `GetRefetchStatus` | application/media | 编排:加锁→异步执行→更新状态;Get 读状态 | 修改 |
| `RefetchEmojisHandler`(media handler 加方法) | interfaces/http | POST 触发 + GET 状态,统一响应 | 修改 |
| 权限点 `emoji:refetch` | migration + permission domain | 新增权限码种子 | 新建 |

### 关键依赖注入改造

当前 `EmojiService`(在 handler 里)拿不到 `EmojiSeedService`(main.go 里独立构造)。方案 B 的做法:

- `EmojiService` 新增字段 `reseeder ReseedRunner` + `statusStore RefetchStatusStore`
- `NewEmojiService(repo, emojiDir, urlPrefix, reseeder, statusStore)` 签名扩展
- `ReseedRunner` 是 application/media 定义的最小接口(打破对 service 包的依赖):
  ```go
  type ReseedRunner interface {
      Reseed(ctx context.Context, progress func(RefetchProgress)) error
  }
  ```
- `EmojiSeedService` 实现该接口
- `media_container.go` 装配时接收 reseeder + statusStore;main.go 调整构造顺序(先 emojiRepo → emojiSeedService → 传给 NewMediaContainer)

## Detailed Design

### 1. 仓储层:upsert(方案 B 的核心归属)

`api/internal/domain/emoji/repository.go` 新增两方法:

```go
// UpsertByName 按名称+来源合并分组：存在则更新（cover/sort/enabled），不存在则新建。
// 用于 B站表情重新拉取的增量合并，不删除 B站不再返回的历史分组。
// 返回分组 ID。
UpsertByName(ctx context.Context, g *EmojiGroup) (int32, error)

// UpsertEmojiByName 按 groupID+name 合并表情：存在则更新，不存在则新建。
// 返回表情 ID。
UpsertEmojiByName(ctx context.Context, e Emoji) (int32, error)
```

GORM 实现(`media_repo.go`):
- `UpsertByName`:`WHERE name = ? AND source = ?` 查,找到则 `Updates` cover_url/sort_order/is_enabled,找不到则 `Create`
- `UpsertEmojiByName`:`WHERE group_id = ? AND name = ?` 查,找到则 `Updates` url/gif_url/source_url/sort_order,找不到则 `Create`

匹配键:
- 分组:`name + source=bilibili`(同名的 custom 分组不会误合并)
- 表情:`group_id + name`

### 2. 任务状态:RefetchStatusStore

domain 端口 `api/internal/domain/emoji/refetch_status.go`:

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

// RefetchProgress 重新拉取进度
type RefetchProgress struct {
	GroupsDone  int  `json:"groups_done"`
	GroupsTotal int  `json:"groups_total"`
}

// RefetchStatus 重新拉取任务状态快照
type RefetchStatus struct {
	State       string     `json:"state"`                  // idle/running/done/failed
	StartedAt   *time.Time `json:"started_at,omitempty"`
	FinishedAt  *time.Time `json:"finished_at,omitempty"`
	GroupsDone  int        `json:"groups_done"`
	GroupsTotal int        `json:"groups_total"`
	Error       string     `json:"error,omitempty"`
}

// RefetchStatusStore 重新拉取任务状态存储端口。
// 实现须保证 Acquire 的原子性与并发安全。
type RefetchStatusStore interface {
	// Acquire 原子抢锁：若已有任务运行返回 shared.Conflict("已有重新拉取任务在运行")，
	// 否则标记 running 并开始计时。
	Acquire(ctx context.Context) error
	// SetProgress 更新进度（groups_done/groups_total）。
	SetProgress(ctx context.Context, p RefetchProgress) error
	// SetDone 标记任务成功完成。
	SetDone(ctx context.Context) error
	// SetFailed 标记任务失败，记录错误信息。
	SetFailed(ctx context.Context, err error) error
	// Get 读取当前状态快照（无任务时返回 StateIdle）。
	Get(ctx context.Context) (*RefetchStatus, error)
}
```

Redis 实现 `api/internal/infrastructure/emoji/refetch_status_store.go`(对齐 `infrastructure/auth/redis_store.go` 的"Redis 适配器放 infrastructure 下独立子包"惯例,不混入 gorm 仓储包):
- key: `emoji:refetch:status`
- `Acquire`:用 `SET emoji:refetch:lock <timestamp> NX EX 3600` 抢锁(1h 过期兜底,防进程崩溃死锁);抢到则写 status=`{state:running, started_at:now}`,抢不到返回 `shared.Conflict("已有重新拉取任务在运行")`(→ 409)
- `SetProgress`:HSET 更新 groups_done/groups_total
- `SetDone`/`SetFailed`:更新 state/finished_at/error,`DEL emoji:refetch:lock` 释放锁
- `Get`:读 status hash,不存在则返回 `{state: idle}`
- 用 `github.com/redis/go-redis/v9` 的 `*redis.Client`(与 system 模块一致)

### 3. ReseedRunner 端口 + EmojiSeedService 实现

`api/internal/application/media/service.go` 新增最小接口(打破对 service 包依赖):

```go
// ReseedProgressCallback 重新拉取进度回调
type ReseedProgress = domainemoji.RefetchProgress

// ReseedRunner 执行 B站表情重新拉取（由 EmojiSeedService 实现）。
type ReseedRunner interface {
	Reseed(ctx context.Context, progress func(ReseedProgress)) error
}
```

`EmojiSeedService` 新增 `ReseedBilibiliEmojis`(`api/internal/service/emoji_seed_service.go`):
- 与 `SeedBilibiliEmojis`(首次/回填幂等)的区别:`Reseed` 永远走 upsert 全量,不看 Count
- 流程:`FetchEmojis` → 遍历 packages → 逐包:下载封面 → `repo.UpsertByName` → 并发下载表情图 → `repo.UpsertEmojiByName` → 每完成一包调 `progress(RefetchProgress{done, total})`
- 复用 Task 3 的并发下载逻辑(errgroup 度 8 + 下载/写库分离)
- 不删除任何分组(保留历史)

### 4. 应用层:EmojiService.Refetch

`EmojiService` 结构体扩展:
```go
type EmojiService struct {
	repo        domainemoji.EmojiGroupRepository
	emojiDir    string
	urlPrefix   string
	reseeder    ReseedRunner           // 新增
	statusStore domainemoji.RefetchStatusStore  // 新增
}
```

`NewEmojiService` 签名扩展为接收 `reseeder` + `statusStore`。

`Refetch(ctx)` 方法:
```go
func (s *EmojiService) Refetch(ctx context.Context) (*domainemoji.RefetchStatus, error) {
	// 抢锁，已在运行则返回 shared.Conflict（→ 409）
	if err := s.statusStore.Acquire(ctx); err != nil {
		return nil, err
	}
	// 异步执行，立即返回当前状态(running)
	go func() {
		progress := func(p domainemoji.RefetchProgress) {
			_ = s.statusStore.SetProgress(context.Background(), p)
		}
		if err := s.reseeder.Reseed(context.Background(), progress); err != nil {
			_ = s.statusStore.SetFailed(context.Background(), err)
			return
		}
		_ = s.statusStore.SetDone(context.Background())
	}()
	return s.statusStore.Get(ctx)
}

func (s *EmojiService) GetRefetchStatus(ctx context.Context) (*domainemoji.RefetchStatus, error) {
	return s.statusStore.Get(ctx)
}
```

注意:goroutine 内用 `context.Background()`(不继承请求 ctx,请求结束后任务继续跑)。

### 5. HTTP 接口

`api/internal/interfaces/http/handler/media/media.go` 加两个方法:

```go
// RefetchBilibiliEmojis POST /admin/emojis/bilibili/refetch
// 异步触发 B站表情重新拉取，立即返回 202 + 当前状态。已在运行返回 409。
func (h *Handler) RefetchBilibiliEmojis(w http.ResponseWriter, r *http.Request) {
	status, err := h.emojiSvc.Refetch(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusAccepted, "B站表情重新拉取已开始")
	// 或 RespondOK 携带 status，见下方响应格式
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

错误映射:`Acquire` 失败返回 `shared.Conflict("已有重新拉取任务在运行")`,经现有 `response.RespondError` 自动翻译为 409(`shared.Conflict` 已被 emoji 的 `ErrNameExists` 使用,无需额外注册)。

### 6. 路由与鉴权(main.go)

`emoji` 路由组(main.go:495 `r.Route("/emojis")`)内新增:
```go
r.With(middleware.RequirePermission(permissionChecker, "emoji:refetch")).
	Post("/bilibili/refetch", mediaH.RefetchBilibiliEmojis)
r.With(middleware.RequirePermission(permissionChecker, "emoji:refetch")).
	Get("/bilibili/refetch/status", mediaH.GetRefetchStatus)
```

现有 9 条 emoji 写路由补细粒度权限(调研发现的缺口):
- `POST /groups` → `emoji:create`
- `DELETE /groups/{id}`、`DELETE /emojis/{id}` → `emoji:delete`
- `POST /groups`、`PATCH /groups/{id}`、`PATCH /groups/batch-status` → `emoji:manage-group`

GET 路由保持 admin 即可(读操作)。

### 7. 权限点种子(migration)

新增 migration `api/migrations/057_add_emoji_refetch_permission.up.sql`:
```sql
INSERT INTO permissions (code, name, description, type) VALUES
    ('emoji:refetch', '重新拉取表情', '触发 B站表情重新拉取', 'action')
ON CONFLICT (code) DO NOTHING;
```
配套 `.down.sql`:
```sql
DELETE FROM permissions WHERE code = 'emoji:refetch';
```

`api/internal/domain/permission/entity.go` 加常量:
```go
EmojiRefetch = Code("emoji:refetch")
```

### 8. 装配改造(main.go + media_container.go)

main.go 构造顺序调整(L150-152):
```go
emojiRepo := gormrepo.NewEmojiGroupRepository(gormDB)
emojiSeedService := service.NewEmojiSeedService(emojiRepo, emojiDir, urlPrefix, cfg.BilibiliCookie, cfg.BilibiliAPIType)
refetchStatusStore := infraemoji.NewRefetchStatusStore(redisClient)  // infrastructure/emoji 包
mediaContainer := app.NewMediaContainer(gormDB, redisClient, emojiDir, chunkDir, uploadRoot, urlPrefix, emojiSeedService, refetchStatusStore)
```

`media_container.go` 的 `NewMediaContainer` 签名扩展,内部把 reseeder + statusStore 传给 `NewEmojiService`。

## 前端设计(web/)

### API 层

`web/src/features/admin-emojis/api/keys.ts` 加:
```ts
refetchStatus: () => [...adminEmojiKeys.all, "refetch-status"] as const,
```

`web/src/features/admin-emojis/api/mutations.ts` 加:
```ts
export const useRefetchBilibiliEmojis = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => apiPost("/admin/emojis/bilibili/refetch"),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: adminEmojiKeys.refetchStatus() });
        },
    });
};
```

`web/src/features/admin-emojis/api/queries.ts` 加轮询 query:
```ts
export const useRefetchStatus = () =>
    useQuery({
        queryKey: adminEmojiKeys.refetchStatus(),
        queryFn: () => apiGet<RefetchStatus>("/admin/emojis/bilibili/refetch/status"),
        // 仅 running 时轮询，2s 间隔
        refetchInterval: (query) => {
            if (!query.state.data) return false;
            return query.state.data.state === "running" ? 2000 : false;
        },
    });
```

`RefetchStatus` 类型对齐后端 `domainemoji.RefetchStatus`。

### UI 层

`web/src/routes/admin.emojis.tsx` 的 `PageShell.action`(L145-150)旁加「重新拉取」按钮:
- 点击弹 `ConfirmDialog`(用项目现有 confirm 组件):文案"将按名称合并 B站表情,你的自定义分组和历史数据不受影响。已下架的 B站表情不会被删除。"
- 确认后调 `useRefetchBilibiliEmojis`
- `useRefetchStatus` 查状态:running 时按钮 disabled + `<Loader2 className="animate-spin" />` + 文案"拉取中(groups_done/total)"
- state=done 时 `invalidateQueries(adminGroupList())` 刷新网格 + toast 成功
- state=failed 时 toast 错误(展示 status.error)
- 409(已在运行)时 toast"任务进行中,请等待"

## Error Handling

| 场景 | 行为 |
|---|---|
| B站 API 调用失败(fetch) | 任务标记 failed,状态存 error,前端 toast 显示;锁释放,可重试 |
| 单张图片下载失败 | 警告日志 + continue(与现有 seed 一致),不阻断整组 |
| UpsertByName/UpsertEmojiByName 单条失败 | 警告 + continue,不阻断整体 |
| 并发触发(任务已在运行) | Acquire 返回 `shared.Conflict` → 409,前端 toast |
| 进程崩溃中断 | Redis 锁 1h 过期自动释放,下次可重新触发 |
| Redis 不可用 | statusStore 操作失败仅记日志,任务仍执行(降级:前端轮询拿不到状态,按钮在 mutation isPending 结束后恢复) |

## Testing

| 层 | 测试 | 方式 |
|---|---|---|
| 仓储 upsert | `media_repo_test.go` 加 `TestUpsertByName` / `TestUpsertEmojiByName` | sqlite 集成,验证:新建、已存在更新、name+source 匹配键、groupID+name 匹配键 |
| RefetchStatusStore | Redis 实现 + mock redis | Acquire 并发安全(模拟二次 Acquire 返回 Err)、状态流转 idle→running→done |
| EmojiSeedService.Reseed | mock repo + httptest 图片 | 验证走 upsert(非 Save)、调 progress 回调、保留历史分组 |
| EmojiService.Refetch | mock reseeder + mock statusStore | 验证:Acquire 失败返回 conflict、成功启动 goroutine、goroutine 内 SetDone/SetFailed |
| handler | mock EmojiService | 202/409/200 响应 |

## Scope 边界

**本 spec 包含:**
- 后端:upsert 仓储方法、RefetchStatusStore、Reseed、Refetch 用例、handler、路由鉴权、权限点、装配
- 前端:refetch mutation、status 轮询 query、按钮 + 确认弹窗 + 进度展示
- 权限点补全:现有 9 条 emoji 写路由补细粒度权限

**本 spec 不包含(显式排除):**
- SSE/WebSocket 实时推送(用轮询,贴合现有架构)
- 给现有 emoji 路由的权限点补 migration 种子角色绑定(角色-权限分配是运维动作,走后台 RBAC 管理 UI)
- 重新拉取的历史日志/审计(只保留最后一次状态)
- 图片去重(同 URL 重复下载仍生成新文件,与现有 seed 行为一致)

## 风险与缓解

1. **upsert 并发与事务**:逐包 upsert 非整体事务,中途失败会留部分更新。缓解:upsert 幂等(按 name 重跑一致),失败可重试,不需复杂事务。图片下载是副作用无法纯事务回滚,接受最终一致。
2. **按钮可点击性 vs 后台真实状态**:页面刷新后若后台仍 running,靠 `useRefetchStatus` 的初次查询恢复 running 态。要求页面挂载就查状态(不只在 mutation 后)。
3. **permissionChecker 注入到 emoji 路由组**:现有 `/admin/emojis` 组未持有 permissionChecker(对比 `/admin/media` 有)。需在路由组级别传入或在每条 `RequirePermission` 处闭包捕获。
