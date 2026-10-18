# @violetjs/kanban API

[中文入门](../README.zh-CN.md) · [English README](../README.md) · [维护指南](../DEVELOPMENT.md)

本文描述当前公开契约，不代表包已经发布。安装产物中的 `dist/**/*.d.ts` 是准确类型签名；下列源码路径供仓库维护时追溯，不是允许消费者深导入的子路径。不得通过 `src/` 或 `dist/` 内部路径绕过 exports。

## 公开入口

| 入口 | 值导出 | 类型导出 |
| --- | --- | --- |
| 根、`/unstyled` | Board、InlineEdit、RelationList、ResponsiveLayout、DEFAULT_NARROW_BREAKPOINT、createPointerController、createHistory、HistoryButtons、useHistoryState、useHistoryAnnouncement、useHistoryShortcuts | BoardColumn、BoardProps、NewCard、PointerControllerOptions、DragController、DragHost、MoveDecision、InlineEditMessages、InlineEditProps、BoardLocale、BoardMessages、RelationListProps、RelationLine、RelationTypeStyle、BoardCard、BoardMove、BoardPosition、BoardState、CommandHistory、HistoryCommand、HistoryOptions、HistoryOutcome、HistoryResult、HistoryState、HistoryButtonsProps、HistoryAnnouncementOptions、HistoryShortcutsOptions、ResponsiveLayoutKind、ResponsiveLayoutProps |
| `/canvas` | Canvas | CanvasHandle、CanvasProps、CanvasMessages |
| `/graph` | RelationGraph | RelationGraphProps |
| `/core` | 下文所有核心函数和常量 | 下文所有核心类型 |
| `/styles.css` | 默认样式 | 无 |
| `/package.json` | 元数据 | 无 |

根入口导入 CSS，`/unstyled` 与根导出相同但不导入 CSS；canvas/graph 也不自动导入 CSS。`/core` 不依赖 React，不导入 CSS。**BoardColumn 不从 `/core` 导出**，应从根或 `/unstyled` 导入。包是 ESM，React 组件要求 React 19；不依赖站点 UI、路由、存储或请求库。

追溯：`src/index.ts`、`src/unstyled.ts`、`src/core/index.ts`、`src/canvas/index.ts`、`src/graph/index.ts` 与 `package.json` 的 exports/publishConfig。

## 数据与受控边界

- `BoardCard = { id: string }`，额外业务字段由泛型保留。
- `BoardState = { columns: readonly string[]; order: Readonly<Record<string, readonly string[]>> }`。列顺序和每列卡片顺序分开保存。
- `ResolvedColumn<TCard> = { id: string; cards: TCard[] }`。
- `BoardColumn` 有 `id: string`、可选 `title: string`、`autoSort: "start" | "end"`、`collapsible: boolean`、`quickAdd: boolean`、`total: number`。`collapsible`、`quickAdd` 为 `false` 时让该列退出相应看板能力。`total` 用于只提供了列内一部分卡片（例如「展开更多」之前）：列头、切换器标签与读屏的数量取它（有限数，向下取整，小于提供的张数时忽略），筛选只作用于提供的卡片。`title` 还是列的可访问名称，没有时退回 id。
- `NewCard = { columnId: string; title: string }`。

`normalizeBoardState(state): BoardState` 返回新状态，为每个列 id 补排序数组，丢弃未知列记录，重复列/卡片位置保留首次出现，一张卡片归属最靠前的列。

`resolveBoard<TCard>(state, cards: Iterable<TCard>): ResolvedColumn<TCard>[]` 先规整状态，再根据池解析卡片；不存在的 id 跳过，未放置卡片不显示。卡片池重复 id 采用最后一条数据，排序中的重复位置仍只保留一次。应在应用层使用稳定、唯一的 id。

追溯：`src/core/state.ts`、`src/board/board.tsx`。

## Board

`Board<TCard extends BoardCard, TColumn extends BoardColumn = BoardColumn>(props: BoardProps<TCard, TColumn>)`。

除 children 外继承 `HTMLAttributes<HTMLDivElement>`，`className`、`style`、`data-*`、`aria-*` 等落在根节点。它不是任意 children 容器，卡片内容通过 slot 提供。

| 属性 | 类型或默认值 | 契约 |
| --- | --- | --- |
| columns | `readonly TColumn[]`，必填 | 列从左到右的顺序 |
| cards | `readonly TCard[]`，必填 | 顺序无关的卡片池 |
| order | `BoardState["order"]`，必填 | 每列从上到下的卡片 id |
| renderCard | `(card, { column, index }) => ReactNode`，必填 | 只渲染卡片内容，外壳由包提供；指针拖动时额外渲染浮动副本 |
| renderColumnHeader | `(column, { count: number, matched: number | null }) => ReactNode` | 替换默认标题/计数，count 是列总数（有 `total` 时取它）；未筛选 matched 为 null；返回 null 不显示内容，列名称仍保留 |
| renderEmpty | `(column) => ReactNode` | 替换空列提示，null 可隐藏 |
| renderColumnFooter | `(column, { count: number, shown: number }) => ReactNode` | 列内卡片之后、快速添加之前的内容，例如「展开更多」；count 是列总数（有 `total` 时取它），shown 是提供的张数；折叠的列里随列体一起不可交互 |
| onMove | `(move: BoardMove) => void | Promise<void>` | 提供即启用移动；完成前要更新受控 order |
| canMove | `(move: BoardMove) => MoveDecision` | 同步规则，目标变化和提交时调用，抛错按拒绝处理 |
| onMoveError | `(error: unknown, move: BoardMove) => void` | 保存失败且包内预览已回滚时通知 |
| isDraggable | `(card: TCard) => boolean` | 按卡片禁用移动 |
| readOnly | `boolean` | 即使有 onMove 也禁用移动；快速添加也隐藏 |
| getCardLabel | `(card) => string`，默认 id | 播报、菜单、关系文字名称 |
| moveMenu | `"hover" | "always" | "none"`，默认 hover | hover 在悬停/聚焦显示，无 hover 设备常显；switcher 中默认常显 |
| collapsible | `boolean`，默认 false | 可折叠列头 |
| collapsedColumns | `readonly string[]` | 受控折叠状态 |
| defaultCollapsedColumns | `readonly string[]` | 非受控初始折叠状态 |
| onCollapsedColumnsChange | `(collapsed: string[]) => void` | 报告完整列表；移动进入折叠列时展开并通知 |
| onAddCard | `(card: NewCard) => void | Promise<void>` | 启用列底添加入口，数据创建由使用方负责 |
| onAddCardError | `(error: unknown, card: NewCard) => void` | 添加失败通知，草稿保留 |
| filter | `(card: TCard) => boolean` | 只淡化不匹配卡片，不移除；存在谓词即禁用所有移动；抛错视为匹配 |
| relations | `readonly Relation[]` | 有向类型关系，输入数据不自动执行 checkRelation |
| relationTypes | `Readonly<Record<string, RelationTypeStyle>>` | 与内置关系类型映射合并 |
| hideRelations | `boolean`，默认 false | 隐藏线，保留卡片的关系文字 |
| selectedCardId | `string | null`，默认 null | 受控选中项，不提供回调不会自行更改 |
| onSelectedCardChange | `(cardId: string | null) => void` | 启用点击/键盘选中，重复点击或空白处清空 |
| layout | `"columns" | "switcher"`，默认 columns | 并排列或单列标签切换 |
| activeColumn | `string` | 受控活动列，无效 id 回退首列 |
| defaultActiveColumn | `string`，默认首列 | 非受控初始活动列 |
| onActiveColumnChange | `(columnId: string) => void` | 标签或移动导致活动列变化时通知 |
| dragController | `DragController` | 替换指针控制器，引用变化取消拖动并重新 attach |
| locale | `BoardLocale`，默认 en | en 或 zh-CN |
| messages | `Partial<BoardMessages>` | 覆盖内置文本 |

### 移动事务与规则

`MoveDecision = { allowed: true } | { allowed: false; reason?: string }`。不指定拒绝原因时使用 `messages.moveRejected`。

没有 `onMove` 时只读。保存期间的移动按放下顺序叠加在受控 `order` 上；回调抛错或 Promise 拒绝会移除该待确认移动并通知 `onMoveError`。完成后仍只认传入的 `order`。这仅撤销包内预览，不会撤销宿主已经更新的状态或后端写入。乐观保存的失败回滚、并发冲突、权限校验都由宿主实现。

自动排序列的列内手动重排优先被包拒绝，进入时落在指定一端。折叠列不接收指针落点；菜单/键盘移入会展开。过滤存在时，指针、键盘和菜单移动全部禁用。

### 键盘、触屏与接缝

可编辑卡片 Tab 聚焦后，Enter/空格拿起与放下，方向键移动预览，Escape 取消，失焦也取消。持有卡片时相关按键不再传给页面快捷键。组合键、重复按键和输入法组合不用于移动。一步只能跨一个列，拒绝的中间列会挡住键盘路径，可用菜单跳转。

可拖卡片用 Alt+Enter 选中，不可拖但可选卡片用 Enter/空格。内部按钮、链接和输入框保持自身行为。菜单支持方向键、Enter/空格、Escape，是单指针拖动替代路径。显式关闭菜单后，应用需自行考虑等价操作。

默认指针控制器：鼠标/笔阈值 4px，触屏长按 250ms，漂移容差 8px；表单控件、可编辑内容、`data-kanban-no-drag` 不发起拖动。拖动后的点击被抑制，Escape、窗口失焦和 pointercancel 取消。

浮动卡片 inert 且对辅助技术隐藏，但仍再次渲染 `renderCard`；避免唯一 DOM id、一次性副作用和依赖只挂载一次的控件。选择、折叠、活动列等受控状态必须由调用方回写。

switcher 只渲染活动列，标签条是 tablist；左右键循环切换，Home/End 到首尾，只有活动标签在 Tab 序列。此布局不折叠、不画关系线，关系标记可切到另一卡片所在列、聚焦并滚动到它，短时标记到达位置。指针不能跨列移动，菜单/键盘可以。减弱动态偏好使关系跳转立即完成。

追溯：`src/board/board.tsx`、`src/board/drag/`、`src/board/column-switcher.tsx`、`src/board/use-arrival.ts`。

## DragController

根与 `/unstyled` 导出 `createPointerController(options?: PointerControllerOptions): DragController`。

`PointerControllerOptions` 的可选字段：`threshold`（px，4）、`touchHoldDelay`（ms，250）、`touchTolerance`（px，8）。

`DragController.attach(host: DragHost): () => void` 在挂载后接入，返回清理函数；卸载或控制器引用改变时清理。应保持控制器引用稳定。它只替换指针输入，不接管内置键盘移动。

`DragHost` 提供：

| 成员 | 契约 |
| --- | --- |
| readonly root: HTMLElement | 在看板根监听输入 |
| cardIdFor(target: EventTarget \| null): string \| null | 查可拖卡片，不可拖或不属于卡片返回 null |
| start(cardId: string, point: Point): void | 使用按下时的 client 坐标保留抓取位置 |
| move(point: Point): void | 新 client 坐标 |
| drop(): void | 按当前有效落点提交，无落点则归位 |
| cancel(): void | 归位，不提交 |

追溯：`src/board/drag/types.ts`、`pointer-controller.ts`。

## InlineEdit

`InlineEdit(props: InlineEditProps)`，不继承任意 input 属性。

必填 `value: string`、`label: string`、`onSave(value: string): void | Promise<void>`；可选 `placeholder: string`、`maxLength: number`、`allowEmpty: boolean`（false）、`className: string`、`locale`、`messages: Partial<InlineEditMessages>`。

展示态为按钮，点击编辑；Enter/失焦保存，Escape 放弃。保存值先 trim，未改变不调用 onSave；空值默认拒绝。失败留在编辑态、保留草稿。成功后宿主应更新 value。label 作为输入框名称和展示态说明。默认继承 Board 的 locale，否则 en；messages 键为 `saveFailed`、`required`。样式使用 Board 内部解析的变量，宜放在 `renderCard` 内。编辑输入不发起卡片拖动，展示文字仍可作为拖动起点。

追溯：`src/board/inline-edit.tsx`。

## Canvas

从 `/canvas` 导入。`CanvasProps` 除 children 外继承 div 属性；`children: ReactNode` 必填。

| 属性 | 契约 |
| --- | --- |
| ref?: Ref<CanvasHandle> | 命令式视口控制 |
| defaultViewport?: Viewport | 仅初始视口；省略则自动适应，直到用户平移或缩放 |
| onViewportChange?: (viewport: Viewport) => void | 报告手势、按钮、键盘等导致的变化，不构成受控 viewport |
| scaleLimits?: ScaleLimits | 默认 min 0.3、max 2 |
| fit?: FitOptions | 适应窗口配置 |
| controls?: boolean | 默认 true，是否显示缩放/适应/全屏按钮 |
| onFullscreenChange?: (fullscreen: boolean) => void | 全屏状态变化 |
| locale | en（默认）或 zh-CN |
| messages?: Partial<CanvasMessages> | 覆盖文案 |

`CanvasHandle`：`fit(): void`、`zoomIn(): void`、`zoomOut(): void`、`setViewport(viewport: Viewport): void`、`getViewport(): Viewport`。fit 同时恢复随尺寸变化自动适应。外部视口会规整：scale 收敛到范围，非有限平移归零。

背景拖动平移；Ctrl/⌘+滚轮围绕指针缩放，普通滚轮不拦截。双指缩放/平移，Safari 触控板手势有对应处理。触屏画布使用 touch-action none，单指背景操作平移而不是滚动页面；可编辑卡片快速滑动平移，长按后拖卡。

视口聚焦后方向键每次平移 48px，Shift 四倍；+/− 按 1.25 倍步进，0 适应。聚焦离屏控件会露出其焦点区域。拖卡时视口边缘自动平移，越靠边越快，内容到边时停止；离开视口无落点。

全屏为 CSS fixed 模式，不调用 Fullscreen API；全屏与页面里各用各的视口：进入时从适应窗口开始，退出时回到页面里原来的视口，切换在绘制前完成；锁页面滚动，使画布外内容 inert。不要放在 transform 祖先下。全屏忽略内联 height。Escape 先取消卡片操作，未被处理时才退出全屏。按钮/键盘缩放有过渡，滚轮/拖动/双指即时；减弱动态关闭过渡。默认高度 `32rem`，宿主应提供适合页面的可用空间。

追溯：`src/canvas/canvas.tsx`、`use-canvas-gestures.ts`、`use-inert-outside.ts`。

## ResponsiveLayout

根或 `/unstyled` 导出。`ResponsiveLayoutKind = "wide" | "narrow"`，`DEFAULT_NARROW_BREAKPOINT = 768`。

`ResponsiveLayoutProps` 继承不含 children 的 div 属性：必填宽屏 `children: ReactNode` 与 `narrow: ReactNode`，可选 `breakpoint: number`（768）、`onLayoutChange(layout: ResponsiveLayoutKind): void`。

容器宽度小于 breakpoint 时选窄屏，一次只挂载一个分支。SSR 和首次客户端渲染均为 wide，测量后再切换；首次测到 narrow 也会通知。零宽保持当前布局。初次测量后由 ResizeObserver 观察尺寸，不存在该 API 时不继续观察。跨分支需保留的 order、selectedCardId、activeColumn 等放在组件外并受控传入。页面滚动条会改变容器宽度时可设置 `scrollbar-gutter: stable`，防止阈值附近反复切换。

追溯：`src/responsive/responsive-layout.tsx`。

## RelationGraph

从 `/graph` 导入。`RelationGraphProps<TCard extends BoardCard, TColumn extends BoardColumn = BoardColumn>` 除 children 外继承 div 属性。

必填 `columns: readonly TColumn[]`、`cards: readonly TCard[]`、`order: BoardState["order"]`、`relations: readonly Relation[]`、`renderCard(card, { column }): ReactNode`。

可选：`rootId: string`、`subgraph: SubgraphOptions`、`cardSize: { width: number; height: number }`（220×72）、`getCardLabel(card): string`（id）、`relationTypes`、`selectedCardId: string | null`、`onSelectedCardChange(cardId: string | null): void`、`locale`、`messages: Partial<BoardMessages>`。

此组件没有 onMove、编辑、菜单和自定义列头/空列 slot。共享的数据形状不代表共享全部 BoardProps。order 决定归属和布局初始顺序，不保证最终纵向顺序保持不变。只读卡片没有浮动副本，renderCard 不需要 index；固定尺寸溢出内容会裁切。选中通过点击或 Enter/空格完成，内部控件点击不算选中。

按输入纯计算布局，不存坐标；缺少端点不画线。rootId 不存在时显示 graphEmpty，存在时按 subgraph 取相关卡片。跨多列的线可能穿过中间卡片，布局不承诺无交叉，也没有虚拟化。可放入 Canvas 获得平移缩放与全屏。

追溯：`src/graph/relation-graph.tsx`、`src/core/graph.ts`。

## RelationList 与关系展示

`RelationListProps<TCard extends BoardCard = BoardCard>` 必填 `relations: readonly Relation[]`、`cards: readonly TCard[]`；可选 `getCardLabel(card): string`（id）、`cardId: string`（仅列该卡片的出入关系）、`relationTypes`、`locale`、`emptyText`、`className`。不继承任意 ul 属性。池外卡片用 id 作名称，空时显示 emptyText 或本地化 relationListEmpty。

`RelationLine = "solid" | "dashed" | "blocker"`。`RelationTypeStyle = { label: string; inverseLabel: string; line: RelationLine }`。来源侧读 label，目标侧读 inverseLabel。内置 extends 实线箭头、fixes 虚线箭头、blocks 实线挡条；覆盖时按类型合并，未知类型用原名和实线。线型而非只有颜色承担类型区别。

Board 和图中的关系文字为线提供等价描述；Board 隐藏线不隐藏文字。RelationList 为独立可见文字列表，不会自动继承 Board locale，应显式传入。关系标记只负责导航，不提供创建或删除关系 UI。

追溯：`src/board/relations/relation-list.tsx`、`types.ts`、`entries.ts`。

## 历史

### 核心类型与 createHistory

`createHistory(options?: HistoryOptions): CommandHistory` 同时从根、`/unstyled`、`/core` 导出。

- `HistoryCommand`：可选 `label: string`，必填 `undo(): void | Promise<void>`、`redo(): void | Promise<void>`。
- `HistoryOptions`：`limit?: number`（50，有限数取整且至少 1，非有限数回退 50），`onError?: (error: unknown, command: HistoryCommand) => void`。
- `HistoryOutcome`：`kind: "undo" | "redo"`、`ok: boolean`、`label?: string`、`seq: number`。seq 每次完成递增。
- `HistoryState`：`canUndo`、`canRedo`、`busy`（boolean），`undoLabel?`、`redoLabel?`、`last?: HistoryOutcome`；状态未变保持同一引用。
- `HistoryResult`：`{ ok: true }`，或 `{ ok: false; reason: "empty" | "busy" }`，或 `{ ok: false; reason: "failed"; error: unknown }`。

CommandHistory 方法：`push(command): void` 记录已完成操作并清空重做栈；`undo()`/`redo(): Promise<HistoryResult>` 执行真实动作；`clear(): void` 清空，进行中动作完成后也不重新记入；`getState(): HistoryState`；`subscribe(listener: () => void): () => void`。

一次只执行一步，busy 时不排队。动作失败丢弃该步并触发 onError，其余历史可继续；订阅者或 onError 抛错会异步重抛，不破坏历史。只存在于当前内存，不自动跟随 Board，也不保存服务器快照。宿主负责在闭包中保存撤销所需业务字段。

### React 历史接口

- `useHistoryState(history: CommandHistory): HistoryState` 订阅历史。
- `useHistoryAnnouncement(history, options?: HistoryAnnouncementOptions)` 返回 `{ text: string; seq: number }`，无结果时空文本/0。options 为 `locale`、`messages: Partial<HistoryMessages>`；自定义 live 区域可用 seq 让重复结果重新播报。
- `HistoryButtons(props: HistoryButtonsProps)` 接收必填 history，可选 locale/messages，其余 div 属性落到按钮组根。不可用按钮用 aria-disabled 保持焦点，下一步名称放 title，自带结果播报，不绑定快捷键。
- `useHistoryShortcuts(history, options?: HistoryShortcutsOptions)`；`enabled?: boolean` 默认 true，`scope?: RefObject<HTMLElement | null>` 默认 document，scope 尚未挂载时不监听。Ctrl/⌘+Z 撤销，Ctrl/⌘+Shift+Z 或 Ctrl+Y 重做。忽略输入框、textarea、select、可编辑内容（含 Shadow DOM）、Alt、输入法组合和已处理事件。多板页面宜明确 scope。

追溯：`src/core/history.ts`、`src/history/`。

## 移动纯函数（/core）

`Point = { x: number; y: number }`，`Rect = { left: number; top: number; right: number; bottom: number }`。落点使用 client 坐标；`BoardPosition = { columnId: string; index: number }`。

`BoardMove` 含 `cardId`、`from`、`to`、`previousId`、`nextId`、`fromPreviousId`、`fromNextId`。四个相邻 id 都是 `string | null`；to.index 按去掉自身后的目标列计算，来源邻居支持无需额外状态的逆操作。

`AutoSortEntry = "start" | "end"`。`ColumnLayout` 为 `{ id; rect; cards: ReadonlyArray<{ id; rect }>; autoSort?; disabled? }`，几何中的 cards 应按顺序且不含被拖卡片。

| 函数 | 返回与语义 |
| --- | --- |
| locateCard(state, cardId) | `BoardPosition | null` |
| createMove(state, cardId, target) | `BoardMove | null`；目标序号收敛，卡片/目标列不存在返回 null |
| applyMove(state, move) | 新 BoardState，不改原输入；按 to.index 插入 |
| invertMove(move) | BoardMove；交换方向和来源/目标邻居 |
| isNoopMove(move) | boolean；同列同序号 |
| entryIndex(entry, length) | number；start 为 0，end 为 length |
| violatesAutoSort(move, isAutoSort: (columnId: string) => boolean) | boolean；检查自动排序列内手动重排 |
| resolveDropTarget(columns, point, options?) | `BoardPosition | null`；options 为 originColumnId?、slack?（48px）。横向按最近列/间隙中点，纵向按卡片中线；禁用列或越界无落点 |
| stepTarget(state, cardId, origin, current, direction, autoSort) | StepResult；上下单步，左右相邻列，索引收敛；自动排序按入口处理 |

`StepDirection = "up" | "down" | "left" | "right"`。`StepResult = { kind: "moved"; target: BoardPosition } | { kind: "edge" } | { kind: "autoSorted" }`。stepTarget 的 autoSort 参数为 `(columnId: string) => AutoSortEntry | undefined`。规则函数不替代后端权限验证。

追溯：`src/core/moves.ts`、`steps.ts`。

## 关系与图纯函数（/core）

`Relation<TType extends string = string> = { sourceId: string; targetId: string; type: TType }`。

- `checkRelation(existing: readonly Relation[], candidate: Relation): RelationCheck`；结果 `{ ok: true }`、`{ ok: false; reason: "self" | "duplicate" }` 或 `{ ok: false; reason: "cycle"; path: string[] }`。只按相同类型检测环，cycle path 为目标到来源的路径；已有环不会导致死循环。它不检查卡片是否存在，也不自动改数据。
- `createAdjacency<R extends Relation>(relations: readonly R[]): Adjacency<R>`；`outgoing(id, type?)`、`incoming(id, type?)`、`of(id)` 返回 readonly R[] 并保持输入顺序，`neighbors(id): readonly string[]` 去重且不含自身。
- `routeEdge(from: Rect, to: Rect, options?: { lane?: number }): EdgeRoute`；`EdgeRoute = { d: string; start: Point; end: Point; angle: number }`，d 为 SVG 贝塞尔路径，angle 为终点切线弧度；同列从右侧绕行，`lane`（0–2，默认 0）让同列弧线向外错开，每条多 6px。
- `assignLanes(edges: Array<{ from: Rect; to: Rect }>): number[]`：给一批线分配同列弧线的车道，竖直范围重叠（端点相接也算）的分到不同车道，短的在内侧；`Board` 的关系线已自动使用。
- `arrowHead(end: Point, angle: number, size: number): string` 返回箭头 SVG 路径。
- `blockerBar(end: Point, angle: number, length: number): string` 返回垂直挡条 SVG 路径。

`GraphCard = { id: string; columnId: string; width?: number; height?: number }`。

`GraphLayoutInput = { columns: readonly string[]; cards: readonly GraphCard[]; relations: readonly Relation[] }`。

`GraphLayoutOptions` 全部可选；`DEFAULT_GRAPH_LAYOUT` 为只读完整默认配置：cardWidth 220、cardHeight 72、cardGap 16、columnGap 96、columnPaddingX 16、columnPaddingY 16、headerHeight 48（均 px），sweeps 4。

`layoutGraph(input, options?): GraphLayout` 返回 `columns: Array<{ id; rect: Rect }>`、`cards: Array<{ id; columnId; rect: Rect }>`、`width: number`、`height: number`。列左右排列且等高；卡片输入顺序为起点，以跨列邻居重心扫描减少交叉；sweeps 0 保留输入顺序。同列关系不参与排序。重复卡片 id、不属于列的卡片被丢弃，相应关系不参与。尺寸/间距不合法时使用默认值。算法不读 DOM、随机数或时间，输入相同则结果相同，不保证最优排布。

`SubgraphOptions = { direction?: "both" | "out" | "in"; depth?: number; types?: readonly string[] }`，默认 both、不限深度、全部类型。depth 的有限值向下取整且至少 0。`relatedSubgraph<R extends Relation>(relations, rootId, options?): Subgraph<R>` 广度优先返回 `ids: string[]`（根在首位）和 `relations: R[]`（端点均在子图、保持输入顺序）。孤立根返回自身；自指不进入结果关系。out 顺方向，in 逆方向，both 双向。该纯函数没有卡片池，不判断根是否是有效卡片；RelationGraph 另行检查。

追溯：`src/core/relations.ts`、`graph.ts`。

## 视口纯函数（/core）

`Viewport = { scale: number; x: number; y: number }`；内容点 p 显示为 `p * scale + (x, y)`，x/y 为容器坐标屏幕像素。`Size = { width: number; height: number }`，`ScaleLimits = { min: number; max: number }`，调用方应给出有序、有限的合理范围。

常量：`DEFAULT_SCALE_LIMITS = { min: 0.3, max: 2 }`，`IDENTITY_VIEWPORT = { scale: 1, x: 0, y: 0 }`，`DEFAULT_FIT_PADDING = 24`。

`FitOptions` 可选 padding（24）、minScale（0.8）、maxScale（1）、limits。`EdgePanOptions` 可选 edge（48px）、maxSpeed（1000px/s）。

| 函数签名 | 契约 |
| --- | --- |
| clampScale(scale, limits): number | 非有限 scale 先视为 1，再收敛 |
| normalizeViewport(viewport, limits): Viewport | 规整 scale，非有限 x/y 归零 |
| zoomAt(viewport, anchor: Point, scale, limits): Viewport | anchor 为容器坐标，锚点下的内容点不动 |
| zoomByFactor(viewport, anchor, factor, limits): Viewport | 当前 scale 乘 factor |
| stepScale(scale, direction: 1 \| -1, limits, ratio = 1.25): number | 放大/缩小一步并收敛 |
| panBy(viewport, dx, dy): Viewport | 平移，不改 scale |
| fitViewport(container: Size, content: Size, options?): Viewport | 装得下则居中，装不下从起始边加 padding 开始 |
| revealRect(viewport, container: Size, rect: Rect, margin): Viewport | rect 为容器坐标，最小平移露出矩形；已可见返回原视口 |
| pinchViewport(start, from: readonly [Point, Point], to: readonly [Point, Point], limits): Viewport | 按双指间距缩放，中点跟随平移 |
| edgePanSpeed(pointer: Point, region: Rect, options?): Point | 返回屏幕坐标速度 px/s；左/上为正，右/下为负 |
| panWithin(viewport, container: Size, content: Size, dx, dy, margin): Viewport | 有边界平移，内容尽头停止；内容较小时保持该方向位置 |

追溯：`src/core/viewport.ts`。

## 文案接缝

BoardLocale 是 `"en" | "zh-CN"`，默认 en。Canvas、InlineEdit、RelationList、历史接口也接受这两种值；内部 Locale 类型本身没有作为独立公开类型导出。除 InlineEdit 明确继承 Board 上下文外，独立组件应自行传 locale。messages 均为局部覆盖；占位符替换为纯文本，不解释 HTML。

### BoardMessages 全部键

| 分组 | 键与用途/占位符 |
| --- | --- |
| 基础 | boardLabel 整板名称；cardCount `{count}`；emptyColumn 空列 |
| 规则与失败 | autoSorted 自动排序拒绝；moveRejected 普通拒绝；moveFailed 保存失败 |
| 键盘 | keyboardHint；keyboardPickedUp、keyboardMoved、keyboardAtEdge、keyboardDropped、keyboardCancelled、movedByMenu，后六个使用 `{card}`、`{column}`、`{position}`、`{count}` |
| 菜单 | moveTo；moveToLabel `{card}` |
| 折叠 | collapseColumn、expandColumn，均 `{column}` |
| 筛选 | cardCountFiltered `{matched}`/`{count}`；filteredOut；filterDragDisabled |
| 添加 | addCard；addCardLabel `{column}`；addCardPlaceholder；addCardSubmit；addCardCancel；addCardFailed |
| 关系与选择 | relationsSummary `{list}`；relationsSeparator；selectHint；selectHintDraggable；relationListEmpty；relationJump `{relation}` |
| 图与切换 | graphLabel；graphEmpty；switcherLabel |

### CanvasMessages 全部键

canvasLabel、canvasHint、controlsLabel、zoomIn、zoomOut、fit、enterFullscreen、exitFullscreen、zoomStatus（`{percent}`）、fullscreenEntered、fullscreenExited。

### 其他文案类型

InlineEditMessages：saveFailed、required。

HistoryMessages：historyLabel、undo、redo、undoNamed、redoNamed、undone、undoneNamed、redone、redoneNamed、undoFailed、redoFailed。Named 后缀使用 `{label}`；HistoryButtons 的可访问按钮名称仍是可见的 undo/redo 文案，下一步名称作为 title。

RelationList 不接受 BoardMessages，只提供 emptyText 及 relationTypes/locale。

追溯：`src/board/messages.ts`、`src/canvas/messages.ts`、`src/history/messages.ts`、`src/board/inline-edit.tsx`。

## 主题接缝

默认 CSS 不依赖宿主 token，使用以下公开变量。`--_kanban-*` 是内部解析变量，不是可依赖的公共配置。无样式入口保留组件 DOM 与交互，需要宿主自己提供完整可用样式或显式导入默认 CSS。

| 变量 | 默认/作用 |
| --- | --- |
| --kanban-foreground | 亮暗正文颜色 |
| --kanban-muted | 弱文字与默认关系线色 |
| --kanban-border | 边框 |
| --kanban-column-background | 列背景 |
| --kanban-card-background | 卡片和部分控件表面 |
| --kanban-canvas-background | 画布背景 |
| --kanban-focus | 焦点与选中反馈 |
| --kanban-danger | 拒绝/错误/阻塞附加颜色 |
| --kanban-relation | 普通关系线，默认 muted |
| --kanban-relation-blocker | 挡条关系，默认 danger |
| --kanban-radius | 默认 12px，上限 16px |
| --kanban-gap | 列间距，默认 12px |
| --kanban-column-width | 默认 18rem |
| --kanban-card-padding | 默认 12px |
| --kanban-font-family | 默认继承宿主 |
| --kanban-canvas-height | 默认 32rem |

默认使用 color-scheme 与 light-dark 跟随系统；组件自身 data-theme="light"/"dark"，或祖先 .light/.dark、data-theme 可固定色域。图复用 Board 的基础样式变量，几何尺寸由 cardSize/布局函数控制，不由列宽 token 控制。跨组件共享主题时把变量放在共同祖先上。

默认样式和行为响应 prefers-reduced-motion：位移/折叠/画布缩放不做过渡，关系跳转立即完成。自定义 CSS 仍应保留焦点可见性、文字等价和线型差别。看板滚动层/标签条以 6px 内边距加负外边距保留焦点，宿主两侧至少留 6px，避免页面横向溢出。

追溯：`src/styles.css`、`src/board/*.css`、`src/board/relations/relations.css`、`src/canvas/canvas.css`、`src/history/history.css`、`src/graph/graph.css`。

## SSR 与验收限制

核心纯函数可独立用于服务端；关系图布局不依赖 DOM。React 组件可输出服务端标记，浏览器测量/拖动/适应窗口在水合后接入。原生 Node SSR 不应直接执行根入口 CSS 导入，应使用无 CSS 入口，并由宿主构建链加载 CSS。ResponsiveLayout 首屏 wide 不代表 SSR 已知道设备宽度。

没有网络层、存储、服务器权限判断、关系编辑 UI、虚拟化或跨刷新历史。回调与 render slot 里的业务行为仍由应用负责。自动化浏览器触屏仿真、语义断言和 reduced-motion 检查不能替代真实读屏、真机和最终宿主页面验收；维护流程见 [DEVELOPMENT.md](../DEVELOPMENT.md)。
