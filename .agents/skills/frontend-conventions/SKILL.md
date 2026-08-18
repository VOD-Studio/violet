---
name: frontend-conventions
description: Use when writing or placing frontend code — creating a util/hook/component, deciding its file location, extracting shared code across features, or writing TS/TSX doc comments (TSDoc format, what belongs in a header comment vs inline).
---

# 前端编码纪律

## 落笔前查重

写任何新 util / hook / 通用组件前,先搜同款,命中即复用:

1. shared 层(`lib/` / `ui/` 等,项目公共能力所在)。
2. 本 feature 已有文件。
3. 兄弟 feature——有近似实现而确实需要复用时,先把它上提到公共层(独立提交),再在新 feature 接入;两边各复制一份是最后选项。

新建前不存在同款才动笔;搜过但不确定算不算同款时,把候选列给用户。

## 文件落位

| 场景 | 落位 |
|---|---|
| 单 feature 私有工具 | feature 根的 `lib/` 或 `utils/`(与兄弟 feature 既有命名对齐,grep 确认) |
| 单 feature 私有 hook | feature 根的 `hooks/` |
| 复合组件的辅件 | 该组件目录内 `components/` `hooks/` `utils/` 子目录 |
| 跨 feature 复用 | 公共层;先上提(独立提交)再接入 |

- 组件目录建 `utils/` `hooks/` 子目录的门槛是「多文件复合体」;一两个文件平铺在组件旁,建了空目录结构就是堆砌。
- feature 私有内容禁止先放进公共层「备用」;公共化的触发条件是第二个消费方真实出现。

## TS 注释规范

导出符号用 TSDoc 标准形态:首行一句话说明用途,`@typeParam` / `param` / `returns` / `example` 标签,example 可运行:

```ts
/**
 * 服务端分页表格 Hook,管理分页状态并组装 pagination。
 *
 * @typeParam T - 列表项数据类型
 * @param useList - 模块的列表查询 Hook
 * @param baseQuery - 业务筛选参数,省略时查全部
 * @returns 查询结果 + pagination,供 DataTable 直接消费
 */
```

头注释禁写(判定:删掉后调用方损失信息吗?不损失即删):

- **动机叙述**:「本 hook 消除 7 个子页重复的样板」——为什么写它,属于 PR 描述。
- **历史论证**:「原单一全量 query 有竞态,已拆为 X」——演进过程,属于 commit/ADR。
- **被否决方案对比**:「IntersectionObserver 方案在边界会丢选中」——要写就压缩成一句「为什么不用 X」。
- **@param 复读签名**:类型与参数名已表达的不再用文字重述。

保留与提倡:

- **魔法值理由**:值旁一句为什么是这个数(行尾或行上)。
- **行内陷阱注释**:函数体内非显然的坑(为什么解构某个引用、为什么豁免某条 lint 依赖)——这是头注释该让位给它的部分。
- **编排契约**:签名看不出的数据流顺序(「读配置 → 回填 → 提交部分字段」),一行。

interface 字段只在非自解释时加行上注释;组件内部私有函数默认不注释,非显然时一句。

## API client / query hooks 注释特例

这两类函数天然自解释:函数名 = 操作,参数类型 = 请求,返回类型 = 响应,下一行代码就是协议与路径。**默认不写头注释**,只补签名外的语义,且不带函数名前缀:

```ts
// ✅ 语义写首行正文;取值约束、前置状态用标签或箭头式陈述
/**
 * 审核通过。rejected 是改判,即该链接曾被拒绝。
 */
export const useApproveFriendLink = ...

/**
 * 待审核数量。
 *
 * @remarks 消费方是后台导航角标,轮询间隔 60s。
 */
export const usePendingFriendLinkCount = ...
```

```ts
// ❌ 复读:函数名 + 「调 GET /admin/friend-links」全在签名与实现里
/** listFriendLinks - 调 GET /admin/friend-links(按状态筛选,分页) */
```

标签使用约定:

- `@remarks`——次要语义(消费场景、缓存行为),首行装不下的放这。
- `@default`——默认值语义(`@default 出现时加载`),而非括号里写「默认 false」。
- `@defaultValue` 同义,项目内统一用 `@default`。
- 状态机转换(`pending → rejected`)直接写箭头式陈述,这是状态描述不是括号补语。
- `@param` / `@returns` 保持;自解释参数不写,写了就必须有签名外信息。

## 组件 props 形态

- props ≤3 且都是原始类型:内联类型可以。
- props >3、含回调、或带泛型:抽 `XxxProps` interface,导出并挂 TSDoc,字段在 interface 上加行上注释;组件函数头只写职责,不再堆 props 说明。

```ts
/**
 * 展开后的推文回复加载器:懒挂载,拍平 useTweetReplies 交 shared 渲染。
 */
function TweetExpandedReplies({ config, tweetId, topLevelId }: TweetExpandedRepliesProps) { ... }
```

## entities 层定位(FSD)

entities = 业务对象(名词:Post/Tag/User 的领域类型与跨 feature 实体逻辑);features = 用户动作(动词)。**薄实体层是健康形态**——只有 `model/types.ts` 说明项目实体只承载类型,多数展示型项目正是如此,不是缺陷。

判断落点:

- 类型/组件只被单一 feature 用 → 留在该 feature 的 `model/`,不预防性上提。
- 被 ≥2 features 引用 → 上提到 `entities/<name>/`(独立提交),按需长出 `api/`(实体查询)、`ui/`(实体组件) segment。
- shared 层禁止业务知识(`shared/user` 这种不存在);有业务语义的类型最低放 entities。

## 空值保护全景规范

空值保护的核心是**在信任边界（API 响应、异步状态、用户输入）进行分层防御**，既不盲目信任外部数据，也不在内部代码中到处堆砌无意义的 `?.`（过度防御会掩盖真实类型错误）：

### 1. DTO 建模与类型真实性
- **诚实的类型定义**：后端可能返回 `null` 的字段，DTO 必须显式声明为 `T | null`，严禁标注为非空 `T` 欺骗编译器。
- **语义区分**：`null` 表示后端明确告知“无此数据/未配置/已清空”；`undefined` 表示前端未传参/可选字段/数据未完成加载。

### 2. 操作符选型与假值陷阱
- **永远优先使用 `??`（空值合并）替代 `||`（逻辑或）**：
  - ❌ `stars || 0`（当 `stars = 0` 时会被错误覆盖为默认值）
  - ❌ `isPinned || false`（当 `isPinned = false` 时会被错误触发）
  - ❌ `title || "默认"`（当 `title = ""` 故意置空时会被覆盖）
  - ✅ `stars ?? 0`、`title ?? "默认"`：仅在值为 `null` 或 `undefined` 时生效。
- **解构赋值默认参数陷阱**：
  - ❌ `const { items = [] } = data || {}`（若 `data.items` 为 `null`，JS 默认参数**完全不生效**，直接读 `items.length` 必崩溃）。
  - ✅ `const items = data?.items ?? []`。

### 3. TanStack Query 异步状态分层
- **严格三态守卫**：
  - **加载中态（`isLoading`）**：`data === undefined`，渲染骨架屏 / 加载指示器。
  - **请求错误态（`isError`）**：渲染错误提示，不阻断父级。
  - **成功但为空态（Empty State）**：在守卫之后通过 `!data?.length` 判定，渲染空占位。
- **反模式**：禁止在调用 hook 时写 `const { data: list = [] } = useQuery()` 以为能防 `null`（混淆加载中与数据为空状态，且遇到 `null` 仍崩溃）。

### 4. 集合与对象渲染
- **集合型数据**：状态守卫后方可进行 map 迭代或排序；无守卫时使用可选链与兜底 `(list ?? []).map(...)`。
- **嵌套对象属性**：使用可选链 `user?.profile?.avatarUrl ?? DEFAULT_AVATAR`。在状态守卫已确保对象存在时，避免无意义的冗余链式访问。

### 5. 工具函数与格式化器防御
- 通用格式化函数（`formatDate`、`formatSize` 等）入参声明为 `val?: string | number | null`，内部统一返回安全占位符（如 `"—"`），避免所有调用方处处手写三元表达式防御。
