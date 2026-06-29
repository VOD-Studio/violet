# 后台防抖搜索组件 SearchInput 设计

- 日期：2026-06-29
- 状态：待评审
- 分支：release/2.0

## 1. 背景与问题

后台多处列表页都有搜索输入框，目前以「relative 容器 + 绝对定位 Search 图标 + 裸 Input」三件套的形式手写复制，存在两个问题：

1. **UI 重复且风格漂移**：图标内边距（`pl-7` / `pl-9`）、图标尺寸（`size-3.5` / `size-4`）、输入框高度（`h-8` / `h-9`）在不同页面各不相同，没有统一来源。
2. **防抖缺失**：4 处搜索输入里只有 `admin.users` 接了防抖，其余 3 处每次击键都直接触发过滤或请求。

### 现状清单

| 位置 | 样式 | 防抖 | 消费方式 |
|---|---|---|---|
| `routes/admin.users.tsx:393` | `pl-9` / h-9 | 有（`useDebouncedValue(keyword, 300)`） | 防抖值喂 react-query |
| `routes/admin.media.tsx:148` | `pl-7` / h-8 text-xs | 无 | `keyword` 直接过滤 |
| `routes/admin.emojis.tsx:184` | `pl-9` / h-9 | 无 | `searchQuery` 客户端 `useMemo` 过滤，空态文案也用 live 值 |
| `features/admin-emojis/ui/EmojiToolbar.tsx:46` | `pl-9` / h-9 | 无 | 纯展示，`onSearchChange` 上抛父级（`EmojiManageDialog`） |

现有防抖 hook `useDebouncedValue` 位于 `features/admin-shared/ui/data-table/hooks/useDebouncedValue.ts`，是「值防抖」（返回防抖后的值），目前仅被 `admin.users` 使用。

## 2. 目标与非目标

### 目标

- 封装一个带搜索图标、内置防抖、清除按钮、回车立即搜索、大小变体的 `SearchInput` 组件，使用方无法漏接防抖。
- 统一 4 处搜索输入的视觉与行为。
- 把通用 `useDebouncedValue` 提升到 `shared/lib/hooks`，消除 `shared/ui` 反向依赖 feature 的分层违规。

### 非目标（YAGNI）

- 不做最小输入长度门槛（如 ≥2 字才搜）。
- 不做自动 trim、leading debounce、防抖 cancel 对外暴露。
- 不引入新的 debounce 库（lodash 等），沿用现有手写 `useDebouncedValue`。

## 3. 组件位置与 hook 迁移

| 资产 | 路径 | 说明 |
|---|---|---|
| `SearchInput` 组件 | `web/src/shared/ui/search-input.tsx` | 扁平文件，与 `input.tsx`/`button.tsx` 同级；足够通用的自定义控件，经用户确认破例放入 `shared/ui`。导入 `@shared/ui/search-input` |
| `useDebouncedValue` hook | `web/src/shared/lib/hooks/use-debounced-value.ts` | 从 data-table 迁出，kebab-case 贴合 `use-toc.ts` 等现有约定 |
| `data-table/index.ts` | 删除 `useDebouncedValue` 的 re-export | grep 确认仅 `admin.users` 引用，迁移后不再直接用 hook |

迁移后 `shared/ui/search-input.tsx` 依赖 `shared/lib/hooks/use-debounced-value`，同属 `shared` 层，方向合法。

## 4. API 契约

```ts
import type { ComponentProps } from "react";

export interface SearchInputProps
    extends Omit<ComponentProps<"input">, "value" | "onChange" | "type"> {
    /** 受控实时值 */
    value?: string;
    /** 非受控初始值，仅在未传 value 时生效 */
    defaultValue?: string;
    /** 实时回调，每次击键触发，用于 UI 联动与分页重置 */
    onValueChange?: (value: string) => void;
    /** 防抖后、回车、清除时触发，用于查询或过滤 */
    onSearch?: (value: string) => void;
    /** 防抖时长，默认 300ms */
    delay?: number;
    /** 搜索中右侧显示 spinner，优先级高于清除按钮 */
    loading?: boolean;
    /** 尺寸变体，default=h-9，sm=h-8 text-xs */
    size?: "default" | "sm";
    /** 点击清除按钮的额外回调 */
    onClear?: () => void;
}
```

设计要点：

- **受控需配对**：传 `value` 即受控，必须同时提供 `onValueChange` 回写父级 state，否则输入框无法更新（冻结）。只需防抖结果、不需要 live 值时用 `defaultValue` + `onSearch` 走非受控，组件自管输入值。
- **双回调拆分**：`onValueChange` 实时、`onSearch` 防抖。满足 `admin.emojis` 这类「空态文案用 live 值、过滤用防抖值」的诉求，也满足 `admin.users`「重置分页用 live、查询用防抖」。
- **扩展原生 input**：`placeholder`、`aria-label`、`className`、`disabled` 等透传；`type` 固定为 `text`，不用 `search` 以免浏览器原生清除按钮与自定义 × 重复；`value`/`onChange` 由组件接管故从 `ComponentProps` 中 Omit。

## 5. 行为规约

1. 内部维护输入值 `inner`：受控时 `value`，非受控时 `useState(defaultValue)`。每次变更立即 `onValueChange(inner)` 并更新 `inner`。
2. `const debounced = useDebouncedValue(inner, delay)`。
3. **防抖触发**：用 `mounted` ref 跳过首次挂载；`debounced` 变化时调用 `onSearch(debounced)`。
4. **回车立即搜索**：`onKeyDown` 捕获 `Enter` 时立即 `onSearch(inner)`。`onSearch` 幂等，之后定时器到点重复触发同值无副作用。
5. **清除**：输入有值且非 `loading` 时右侧显示 `×`；点击后 `inner` 置空、立即 `onSearch("")`、调用 `onClear?.()`。
6. **loading 优先**：`loading` 为真时右侧显示 `Loader2` spinner，覆盖清除按钮。
7. **a11y**：外层容器 `role="search"`，input 透传 `aria-label`（调用方按场景给，如「搜索用户」）。

## 6. 迁移计划

逐站点改造，每处都删除手写的 relative 容器 + 图标 + Input 三件套。受控/非受控选择依据是否需要 live 值：

| 文件 | 模式 | 改造点 |
|---|---|---|
| `routes/admin.users.tsx` | 非受控 | 删除手写三件套与本地 `useDebouncedValue`；`<SearchInput defaultValue="" onValueChange={() => setPage(1)} onSearch={setSearchTerm} />`；查询参数与 `filtered` 标志均由 `searchTerm` 驱动 |
| `routes/admin.media.tsx` | 非受控 | `<SearchInput size="sm" defaultValue="" onSearch={setKeyword} />`；`keyword` 持有防抖后的搜索词 |
| `routes/admin.emojis.tsx` | 受控 | 需 live 值供空态文案；`<SearchInput value={searchQuery} onValueChange={setSearchQuery} onSearch={setFilteredQuery} />`；过滤 `useMemo` 依赖 `filteredQuery`，空态文案用 live `searchQuery` |
| `features/admin-emojis/ui/EmojiToolbar.tsx` | 非受控 | 内部 Input 换成 `<SearchInput defaultValue={searchQuery} onSearch={onSearchChange} />`；父级 `EmojiManageDialog` 的 `searchQuery` 自然变为防抖后的值，`EmojiList` 据此过滤，无需改动父级逻辑 |

凡只需防抖结果、不需要 live 值的站点一律用 `defaultValue` + `onSearch` 非受控；仅 `admin.emojis` 因空态文案依赖实时值才用 `value` + `onValueChange` 受控。

## 7. 测试

- **hook 单测**：`shared/lib/hooks/__tests__/use-debounced-value.test.ts`，沿用目录现有 vitest 风格。覆盖：定时器推进后返回最新值、`delay` 内连续变化只触发一次、卸载时清理定时器。
- **组件回归**：4 处迁移后人工/类型校验搜索、防抖、清除、回车行为；`admin.users` 的分页重置与 `filtered` 标志不回归。
- 类型校验：`biome` / `tsc --noEmit`（或项目既有 lint 脚本）通过。

## 8. 约束

- 遵守 TS 严谨性要求：禁用 `as` 类型断言与 void 操作符，用判空收窄或类型推断实现「跳过首次挂载」等逻辑。
- 注释不得含括号补充说明，融入句子或省略。
- FSD 分层：`shared/ui` 不反向依赖 `features/*`，故 hook 必须先迁出 data-table。
