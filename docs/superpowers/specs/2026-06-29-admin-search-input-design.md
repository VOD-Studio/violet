# 后台防抖搜索组件 SearchInput 设计

- 日期：2026-06-29
- 状态：待评审
- 分支：release/2.0

## 1. 背景与问题

后台多处列表页都有搜索输入框，目前以「relative 容器 + 绝对定位 Search 图标 + 裸 Input」三件套的形式手写复制，存在三个问题：

1. **UI 重复且风格漂移**：图标内边距（`pl-7` / `pl-9`）、图标尺寸（`size-3.5` / `size-4`）、输入框高度（`h-8` / `h-9`）在不同页面各不相同，没有统一来源。
2. **防抖缺失**：4 处搜索输入里只有 `admin.users` 接了防抖，其余 3 处每次击键都直接触发过滤或请求。
3. **现有防抖 hook 太薄**：`useDebouncedValue` 只做了「trailing 值防抖」最小实现，缺 flush/cancel/leading/maxWait/对象相等判断，无法支撑回车立即搜索、立即清除等需求。

### 现状清单

| 位置 | 样式 | 防抖 | 消费方式 |
|---|---|---|---|
| `routes/admin.users.tsx:393` | `pl-9` / h-9 | 有（`useDebouncedValue(keyword, 300)`） | 防抖值喂 react-query |
| `routes/admin.media.tsx:148` | `pl-7` / h-8 text-xs | 无 | `keyword` 直接过滤 |
| `routes/admin.emojis.tsx:184` | `pl-9` / h-9 | 无 | `searchQuery` 客户端 `useMemo` 过滤，空态文案也用 live 值 |
| `features/admin-emojis/ui/EmojiToolbar.tsx:46` | `pl-9` / h-9 | 无 | 纯展示，`onSearchChange` 上抛父级（`EmojiManageDialog`） |

现有 `useDebouncedValue` 位于 `features/admin-shared/ui/data-table/hooks/useDebouncedValue.ts`，目前仅被 `admin.users` 使用。

### 现有 hook 的缺口

| # | 缺口 | 后果 |
|---|---|---|
| 1 | 无 flush | 不能强制立即触发，回车立即搜索只能靠幂等绕过 |
| 2 | 无 cancel | 不能丢弃挂起调用，立即清除做不到干净取消 |
| 3 | 无 leading/trailing | 只有硬编码 trailing |
| 4 | 挂载即发射初值 | 非空初值立刻触发一次回调 |
| 5 | 对象/函数值用引用相等 | 泛型诱导传对象，每次渲染新建对象会让定时器不断重置，永不发射 |
| 6 | 无 maxWait | 用户连续打字不停顿时防抖值永不更新 |
| 7 | 无 pending 信号 | 调用方无法得知是否有挂起调用 |

## 2. 目标与非目标

### 目标

- 封装带搜索图标、内置防抖、清除按钮、回车立即搜索、大小变体的 `SearchInput` 组件，使用方无法漏接防抖。
- 重构通用防抖能力为两个共享 hook：`useDebouncedCallback`（核心）与 `useDebouncedValue`（值包装），落到 `shared/lib/hooks`，消除 `shared/ui` 反向依赖 feature 的分层违规。
- 统一 4 处搜索输入的视觉与行为。

### 非目标（YAGNI）

- 不引入 lodash 等外部 debounce 库，自行实现语义对齐 lodash 的 hook。
- SearchInput 不暴露 leading/trailing/maxWait 等 prop，保持简单；进阶需求直接用 hook。
- 不做 debounce 的 debounceQuery/throttle 变体，需要时再加。

## 3. 组件位置与 hook 架构

| 资产 | 路径 | 说明 |
|---|---|---|
| `SearchInput` 组件 | `web/src/shared/ui/search-input.tsx` | 扁平文件，与 `input.tsx`/`button.tsx` 同级；足够通用的自定义控件，经用户确认破例放入 `shared/ui`。导入 `@shared/ui/search-input` |
| `useDebouncedCallback` 核心 | `web/src/shared/lib/hooks/use-debounced-callback.ts` | lodash 级回调防抖，返回 `{ run, flush, cancel, pending }` |
| `useDebouncedValue` 值包装 | `web/src/shared/lib/hooks/use-debounced-value.ts` | 基于 callback 实现的通用值防抖，支持 `equalityFn`；供需要直接消费防抖值（如 react-query 参数）的场景使用，当前迁移不直接使用但作为共享工具保留 |
| `data-table/index.ts` | 删除 `useDebouncedValue` 的 re-export | grep 确认仅 `admin.users` 引用，迁移后不再直接用 hook |

`shared/ui/search-input` 依赖 `shared/lib/hooks/*`，同属 `shared` 层，方向合法。

## 4. API 契约

### useDebouncedCallback（核心）

```ts
interface DebounceOptions {
    delay?: number;       // 默认 300ms
    leading?: boolean;    // 默认 false
    trailing?: boolean;   // 默认 true
    maxWait?: number;     // 可选，连续触发时最长延迟兜底
}

interface Debounced<TArgs extends unknown[], TResult> {
    /** 防抖后的调用入口 */
    run: (...args: TArgs) => void;
    /** 立即触发挂起的 trailing 调用并返回其结果，无挂起则 no-op */
    flush: () => TResult | undefined;
    /** 取消挂起调用，不触发 */
    cancel: () => void;
    /** 是否有挂起的 trailing 调用 */
    pending: () => boolean;
}

function useDebouncedCallback<TArgs extends unknown[], TResult>(
    callback: (...args: TArgs) => TResult,
    options?: DebounceOptions,
): Debounced<TArgs, TResult>;
```

语义（对齐 lodash）：

- `callback` 始终调用最新闭包：内部用 ref 持有，每次渲染更新，避免过期状态。
- `leading`+`trailing` 同时为 true 且窗口内仅一次调用时，触发两次（leading + trailing）。
- `maxWait` 达到即触发，随后重置窗口。
- `delay=0` 走微任务/同步刷新，不安排 0ms 定时器。
- 返回的 `run`/`flush`/`cancel`/`pending` 引用稳定，可安全放入依赖数组。
- 卸载时取消挂起定时器。

### useDebouncedValue（值包装）

```ts
function useDebouncedValue<T>(
    value: T,
    delay?: number,
    equalityFn?: (prev: T, next: T) => boolean,
): T;
```

- 默认 `equalityFn` 为 `Object.is`；传入自定义比较器可让对象/数组值正常防抖（同结构不重发），修复缺口 5。
- 基于 `useDebouncedCallback` 实现，trailing 触发后更新内部 state。
- 保留供「防抖值喂 query 参数」场景使用。

### SearchInput

```ts
export interface SearchInputProps
    extends Omit<ComponentProps<"input">, "value" | "onChange" | "type"> {
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    onSearch?: (value: string) => void;
    delay?: number;
    loading?: boolean;
    size?: "default" | "sm";
    onClear?: () => void;
}
```

要点：

- **受控需配对**：传 `value` 即受控，必须同时提供 `onValueChange` 回写，否则输入框冻结。只需防抖结果时用 `defaultValue` + `onSearch` 走非受控。
- **双回调拆分**：`onValueChange` 实时、`onSearch` 防抖。
- **扩展原生 input**：`placeholder`、`aria-label`、`className`、`disabled` 等透传；`type` 固定为 `text`，不用 `search` 以免浏览器原生清除按钮与自定义 × 重复。

## 5. 行为规约

SearchInput 内部用 `useDebouncedCallback` 得到 `{ run, flush, cancel }`：

1. 内部维护输入值 `inner`：受控时同步 `value`，非受控时 `useState(defaultValue)`。每次变更立即 `onValueChange(inner)` 并 `run(inner)` 挂起一次防抖触发。
2. 防抖到期（trailing）→ `onSearch(inner)`。挂载时不调用，trailing-only 天然跳过初值，无需 mounted-ref 补丁。
3. **回车**：`onKeyDown` 捕获 `Enter` → `flush()`，立即以最新参数触发挂起的 `onSearch`；若无挂起则 no-op（当前值已被上一次 trailing 覆盖）。
4. **清除（×）**：`cancel()` 丢弃挂起 → 立即 `onValueChange("")` + `onSearch("")` + `onClear?.()`。
5. **loading 优先**：`loading` 为真时右侧 `Loader2` spinner 覆盖 ×；否则有值且非 loading 时显示 ×。
6. **a11y**：外层 `role="search"`，input 透传 `aria-label`。
7. **卸载**：`useDebouncedCallback` 内部 cleanup 取消挂起定时器。

## 6. 迁移计划

逐站点改造，每处删除手写的 relative 容器 + 图标 + Input 三件套。受控/非受控依据是否需要 live 值：

| 文件 | 模式 | 改造点 |
|---|---|---|
| `routes/admin.users.tsx` | 非受控 | 删除手写三件套与本地 `useDebouncedValue`；`<SearchInput defaultValue="" onValueChange={() => setPage(1)} onSearch={setSearchTerm} />`；查询参数与 `filtered` 标志均由 `searchTerm` 驱动 |
| `routes/admin.media.tsx` | 非受控 | `<SearchInput size="sm" defaultValue="" onSearch={setKeyword} />`；`keyword` 持有防抖后的搜索词 |
| `routes/admin.emojis.tsx` | 受控 | 需 live 值供空态文案；`<SearchInput value={searchQuery} onValueChange={setSearchQuery} onSearch={setFilteredQuery} />`；过滤 `useMemo` 依赖 `filteredQuery`，空态文案用 live `searchQuery` |
| `features/admin-emojis/ui/EmojiToolbar.tsx` | 非受控 | 内部 Input 换成 `<SearchInput defaultValue={searchQuery} onSearch={onSearchChange} />`；父级 `EmojiManageDialog` 的 `searchQuery` 自然变为防抖后的值，`EmojiList` 据此过滤，无需改动父级逻辑 |

凡只需防抖结果、不需要 live 值的站点一律用 `defaultValue` + `onSearch` 非受控；仅 `admin.emojis` 因空态文案依赖实时值才用 `value` + `onValueChange` 受控。`admin.users` 迁移后不再直接使用 hook，全部由 SearchInput 内部承接。

## 7. 测试

`shared/lib/hooks/__tests__/` 沿用现有 vitest 风格。

- **`use-debounced-callback.test.ts`**：trailing 默认触发；leading 边沿；leading+trailing 双触发；`maxWait` 兜底；`flush` 立即触发并返回结果；`cancel` 不触发；`pending` 状态；`delay=0` 同步；卸载清理定时器；`callback` 始终用最新闭包；`run`/`flush`/`cancel` 引用稳定。
- **`use-debounced-value.test.ts`**：基本值防抖；`equalityFn` 让对象值正常工作（同结构不重发）；`delay` 内连续变化只发一次；卸载清理。
- **组件回归**：4 处迁移后人工/类型校验搜索、防抖、清除、回车；`admin.users` 分页重置与 `filtered` 不回归。
- **类型**：`biome` / `tsc --noEmit`（或项目既有 lint 脚本）通过。

## 8. 约束

- 遵守 TS 严谨性：禁用 `as` 类型断言与 void 操作符；回调泛型 `TArgs extends unknown[]` 保留参数类型，不用 `any`；"跳过首次挂载"靠 trailing-only 语义实现，不靠 mutable flag hack。
- 注释不得含括号补充说明，融入句子或省略。
- FSD 分层：`shared/ui` 不反向依赖 `features/*`，故 hook 必须先迁出 data-table。
