# @violetjs/kanban

React 19 受控看板与关系图，另有不依赖 React 的核心函数。卡片、列顺序、持久化和权限由使用方管理；包负责呈现和报告操作。

[English](./README.md) · [API 文档](./docs/api.md) · [维护指南](./DEVELOPMENT.md) · [MIT 许可证](./LICENSE)

当前正在准备包交付，尚未发布 npm。`package.json` 中有版本号不代表 registry 中已有该版本。维护者用 `pnpm pack` 生成真实 tarball 后，React 19 应用可执行 `pnpm add /absolute/path/to/violetjs-kanban-0.1.0.tgz` 安装该文件；应用自行提供 React 渲染器和可处理 CSS 导入的构建工具。

## 选择入口

| 导入路径 | 内容 | 样式 |
| --- | --- | --- |
| `@violetjs/kanban` | Board、ResponsiveLayout、InlineEdit、RelationList、历史 UI/hooks、createHistory、指针控制器与相关类型 | 自动导入默认样式 |
| `@violetjs/kanban/unstyled` | 与根入口相同的导出 | 不导入 CSS |
| `@violetjs/kanban/core` | 状态、移动、规则、命令历史、关系、图布局和视口数学 | 无 CSS，也不依赖 React |
| `@violetjs/kanban/canvas` | Canvas、CanvasHandle、CanvasProps、CanvasMessages | 不导入 CSS |
| `@violetjs/kanban/graph` | RelationGraph、RelationGraphProps | 不导入 CSS |
| `@violetjs/kanban/styles.css` | 全部组件的默认样式 | 显式样式入口 |
| `@violetjs/kanban/package.json` | 包元数据 | 无 |

使用根入口自动带样式，或在使用无样式组件入口时单独导入一次 `@violetjs/kanban/styles.css`。包不依赖 Tailwind、`@violet/ui`、站点主题、路由或后端。产物为 ESM，不提供 CommonJS。

## 只读看板

以下完整代码来自 [examples/quick-start.tsx](./examples/quick-start.tsx)。四个示例都是可以独立消费的 TSX 模块，不需要补齐隐藏变量。

<!-- example:quick-start:start -->
```tsx
import { Board } from "@violetjs/kanban";

interface Task {
	id: string;
	title: string;
}

const tasks: Task[] = [
	{ id: "spec", title: "Write the specification" },
	{ id: "prototype", title: "Build the prototype" },
];

/** 不传 onMove 时，卡片只读且不显示移动入口。 */
export function QuickStart() {
	return (
		<Board
			aria-label="Read-only board"
			columns={[
				{ id: "todo", title: "Planned" },
				{ id: "doing", title: "In progress" },
			]}
			cards={tasks}
			order={{ todo: ["spec"], doing: ["prototype"] }}
			getCardLabel={(task) => task.title}
			renderCard={(task) => <span>{task.title}</span>}
		/>
	);
}
```
<!-- example:quick-start:end -->

`columns` 决定列的左右顺序，`cards` 是顺序无关的卡片池，`order` 是列 id 到从上到下卡片 id 的映射。卡片只需有 `id`，自定义卡片和列字段会原样交给渲染回调。重复放置只显示一次，池中不存在的 id 跳过，未被 `order` 引用的卡片不显示。不传 `onMove` 时不能移动。

## 可编辑看板与历史

[examples/editable.tsx](./examples/editable.tsx) 在本地应用移动、记录可逆命令，并把撤销快捷键限制在示例容器内。它没有伪装成后端保存。

<!-- example:editable:start -->
```tsx
import { Board, type BoardColumn, HistoryButtons, useHistoryShortcuts } from "@violetjs/kanban";
import {
	applyMove,
	type BoardMove,
	type BoardState,
	createHistory,
	invertMove,
} from "@violetjs/kanban/core";
import { useCallback, useMemo, useRef, useState } from "react";

const columns: BoardColumn[] = [
	{ id: "todo", title: "Planned" },
	{ id: "doing", title: "In progress" },
	{ id: "done", title: "Done", autoSort: "start" },
];
const tasks = [
	{ id: "spec", title: "Write the specification" },
	{ id: "prototype", title: "Build the prototype" },
];

/** 移动和历史都写入本地受控状态，不连接后端。 */
export function EditableBoard() {
	const scope = useRef<HTMLDivElement>(null);
	const history = useMemo(() => createHistory(), []);
	const [state, setState] = useState<BoardState>({
		columns: columns.map((column) => column.id),
		order: { todo: ["spec"], doing: ["prototype"], done: [] },
	});
	useHistoryShortcuts(history, { scope });

	const apply = useCallback((move: BoardMove) => {
		setState((current) => applyMove(current, move));
	}, []);
	const onMove = useCallback(
		(move: BoardMove) => {
			apply(move);
			history.push({
				label: `Move ${move.cardId}`,
				undo: () => apply(invertMove(move)),
				redo: () => apply(move),
			});
		},
		[apply, history],
	);

	return (
		<div ref={scope}>
			<HistoryButtons history={history} />
			<Board
				aria-label="Editable board"
				columns={columns}
				cards={tasks}
				order={state.order}
				renderCard={(task) => <span>{task.title}</span>}
				getCardLabel={(task) => task.title}
				onMove={onMove}
				moveMenu="always"
			/>
		</div>
	);
}
```
<!-- example:editable:end -->

传入 `onMove` 即启用编辑。回调收到 `BoardMove`，包含出发/目标位置与相邻卡片 id；`to.index` 按移除被移动卡片后的目标列计算。回调完成前，看板暂时显示待确认移动。同步抛错或 Promise 拒绝会撤销包内预览并触发 `onMoveError`。完成后只认 `order`，所以必须在返回前更新它。包无法撤销使用方已经写入的本地状态或后端数据；采用乐观保存时，相应回滚由应用负责。

`canMove` 是同步规则，落点变化和最终提交时都会调用，抛错按拒绝处理。自动排序列拒绝列内手动重排，外来卡片落到 `autoSort` 指定的一端。`readOnly` 可在已有 `onMove` 时禁用移动，`isDraggable` 可禁用单张卡片。传入 `filter` 会淡化而不移除未匹配卡片，并禁用整板所有移动；结束筛选时应传 `undefined`。

历史记录的是已经完成的命令，不是看板快照。操作成功后才 `push`；撤销与重做会执行使用方的真实回调，失败后该命令永久作废。历史只存在于内存，默认最多 50 步，刷新不保留。`HistoryButtons` 不安装快捷键，快捷键由 `useHistoryShortcuts` 提供。

## 画布与窄屏布局

[examples/canvas.tsx](./examples/canvas.tsx) 在宽容器显示画布，窄容器显示单列切换器。顺序、选中项和活动列放在布局之上，因此重挂载时不会丢失。

<!-- example:canvas:start -->
```tsx
import { Board, type BoardProps, ResponsiveLayout } from "@violetjs/kanban";
import { Canvas } from "@violetjs/kanban/canvas";
import { applyMove, type BoardState } from "@violetjs/kanban/core";
import { useState } from "react";

interface Task {
	id: string;
	title: string;
}

interface CanvasBoardState {
	order: BoardState["order"];
	activeColumn: string;
	selectedCardId: string | null;
}

const columns = [
	{ id: "todo", title: "Planned" },
	{ id: "doing", title: "In progress" },
	{ id: "done", title: "Done" },
];
const tasks: Task[] = [
	{ id: "spec", title: "Write the specification" },
	{ id: "prototype", title: "Build the prototype" },
];

/** 两种布局切换会重新挂载子树；把需要保留的状态放在它们之外。 */
export function CanvasBoard() {
	const [state, setState] = useState<CanvasBoardState>({
		order: { todo: ["spec"], doing: ["prototype"], done: [] },
		activeColumn: "todo",
		selectedCardId: null,
	});
	const board: BoardProps<Task> = {
		columns,
		cards: tasks,
		order: state.order,
		renderCard: (task) => <span>{task.title}</span>,
		getCardLabel: (task) => task.title,
		onMove: (move) => {
			setState((current) => ({
				...current,
				order: applyMove(
					{ columns: columns.map((column) => column.id), order: current.order },
					move,
				).order,
			}));
		},
		activeColumn: state.activeColumn,
		onActiveColumnChange: (activeColumn) =>
			setState((current) => ({ ...current, activeColumn })),
		selectedCardId: state.selectedCardId,
		onSelectedCardChange: (selectedCardId) =>
			setState((current) => ({ ...current, selectedCardId })),
	};

	return (
		<ResponsiveLayout
			narrow={<Board {...board} aria-label="Narrow canvas board" layout="switcher" />}
		>
			<Canvas aria-label="Board canvas" style={{ height: 400 }}>
				<Board {...board} aria-label="Canvas board" />
			</Canvas>
		</ResponsiveLayout>
	);
}
```
<!-- example:canvas:end -->

Canvas 可拖动背景平移，通过 Ctrl/⌘+滚轮、双指、按钮或键盘缩放；普通滚轮平时交给页面滚动，全屏时改为平移画布。应设置高度，默认 `32rem`。默认缩放范围 0.3–2，初始适应窗口范围 0.8–1。`defaultViewport` 只是初值，并不存在受控 `viewport` 属性；可通过 ref 和 `onViewportChange` 接入视口保存。

ResponsiveLayout 测量自身容器，不是窗口；默认阈值为 768px。一次只挂载一个分支。服务端和客户端首次渲染均为宽屏分支，测量后才可能切换。隐藏且宽度为零时保持当前布局；没有 ResizeObserver 的环境不会观察后续尺寸变化。页面可设置稳定滚动条槽位，避免布局改变滚动条后反复跨越阈值。

`layout="switcher"` 的标签条一次显示一列，指针不能跨列拖动；键盘移动和常显的「移到…」菜单仍可跨列。折叠与关系线不适用，改用关系按钮跳转到另一张卡片。

## 关系图

[examples/graph.tsx](./examples/graph.tsx) 把同一份数据交给 Canvas/RelationGraph，并通过 RelationList 提供文字等价内容。

<!-- example:graph:start -->
```tsx
import { RelationList } from "@violetjs/kanban";
import { Canvas } from "@violetjs/kanban/canvas";
import type { Relation } from "@violetjs/kanban/core";
import { RelationGraph } from "@violetjs/kanban/graph";
import { useState } from "react";

const columns = [
	{ id: "todo", title: "Planned" },
	{ id: "doing", title: "In progress" },
	{ id: "done", title: "Done" },
];
const tasks = [
	{ id: "spec", title: "Write the specification" },
	{ id: "prototype", title: "Build the prototype" },
	{ id: "ship", title: "Ship the package" },
];
const relations: Relation[] = [
	{ sourceId: "prototype", targetId: "spec", type: "extends" },
	{ sourceId: "prototype", targetId: "ship", type: "blocks" },
];
const getCardLabel = (task: (typeof tasks)[number]) => task.title;

/** 同一份关系同时呈现为图形和可阅读的列表。 */
export function Graph() {
	const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
	return (
		<div>
			<Canvas aria-label="Relation canvas" style={{ height: 400 }}>
				<RelationGraph
					aria-label="Package relations"
					columns={columns}
					cards={tasks}
					order={{ todo: ["ship"], doing: ["prototype"], done: ["spec"] }}
					relations={relations}
					getCardLabel={getCardLabel}
					renderCard={(task) => <span>{task.title}</span>}
					selectedCardId={selectedCardId}
					onSelectedCardChange={setSelectedCardId}
				/>
			</Canvas>
			<RelationList cards={tasks} relations={relations} getCardLabel={getCardLabel} />
		</div>
	);
}
```
<!-- example:graph:end -->

RelationGraph 只读。它根据数据确定性计算按列分区的坐标，卡片尺寸固定，默认 220×72px，溢出内容会被裁切。`rootId` 和 `subgraph` 可收窄相关子图。布局会尝试减少交叉，但不保证没有交叉；跨越多列的线可能经过中间卡片。当前没有虚拟化，也没有适用于所有卡片数量与设备的性能保证。

关系形状是 `{ sourceId, targetId, type }`。内置展示类型为 `extends`（实线箭头）、`fixes`（虚线箭头）、`blocks`（挡条）。`relationTypes` 可覆盖正向/反向读法和线型；未知类型使用类型名与实线。`checkRelation` 拒绝自指、重复和同类型内的环；渲染已有数据不等于自动校验或持久化关系。不可见或不存在的端点不画线。选中状态受控，高亮直接邻居；Board 的 `hideRelations` 仅隐藏线，保留文字描述。

## 交互与无障碍边界

- Tab 聚焦可编辑卡片，Enter/空格拿起与放下，方向键预览移动，Escape 取消；焦点离开也取消。`getCardLabel` 提供播报名称，默认 id。可拖卡片用 Alt+Enter 选中，不可拖但可选的卡片用 Enter/空格。卡片内部控件保留自身交互。
- 「移到…」菜单是拖动的单指针替代，支持方向键、Enter/空格和 Escape。`moveMenu="none"` 会移除这条路径，需要时应在应用里提供等价控件。
- 默认鼠标/笔移动超过 4px 才开始拖动；触屏长按 250ms，容许漂移 8px。表单控件、可编辑内容与 `data-kanban-no-drag` 区域不发起拖动。`dragController` 只替换指针输入，应保持引用稳定；键盘移动不经过它。
- Canvas 支持键盘平移、缩放、适应窗口，并把焦点内容带入视野。全屏是 CSS 模式，进入与退出时淡入淡出，会锁定页面滚动并将外部内容设为 inert，不使用浏览器 Fullscreen API。Escape 先取消正在进行的卡片移动，再退出全屏；不要把全屏画布放在有 transform 的祖先之下。
- `locale` 默认 `en`，支持 `zh-CN` 和局部 `messages` 覆盖。关系文字与 live 播报补充视觉线条，自定义卡片仍需提供有意义的文本与可访问控件。
- 减弱动态偏好会关闭卡片位移、列折叠和画布缩放过渡，关系跳转改为即时。实现这些行为不代表已通过真实读屏或真机认证，最终应用仍需在目标设备和辅助技术上检查。

指针拖动时会额外调用一次 `renderCard` 绘制 inert 且对辅助技术隐藏的浮动副本。内容不能依赖唯一 DOM id 或只执行一次的副作用。`renderColumnHeader` 与 `renderEmpty` 分别替换列头和空内容，返回 `null` 可不显示。只提供某列一部分卡片时（例如「展开更多」列表），用 `column.total` 让列头与切换器标签显示真实数量，并把控件放进 `renderColumnFooter`（渲染在卡片之后）。快速添加（`onAddCard`）与 InlineEdit 只报告保存，不持有业务记录；失败会保留草稿。

## 样式与服务端渲染

默认 CSS 使用 `--kanban-*` 变量，内置亮暗色默认值。在组件上设置 `data-theme="light"`/`"dark"`，或在祖先上设置 `.light`/`.dark` 可固定色域。公开变量包括文字/弱文字/边框、列/卡片/画布背景、焦点/危险/关系色、圆角、间距、列宽、卡片内边距、字体与画布高度；见 [完整主题表](./docs/api.md#主题接缝)。

水平看板滚动层和标签条会向盒外延伸 6px，以保留焦点轮廓。两侧至少留 6px 外部空间，避免贴窗口边缘时产生页面横向滚动。自定义 CSS 不能破坏焦点可见性，也不应只靠颜色表达状态。

组件可输出服务端标记；测量、手势和自适应布局需要水合后的浏览器环境。核心数学不依赖 React，关系图坐标不依赖 DOM 测量。原生 Node SSR 应使用 `/unstyled` 和无 CSS 的 canvas/graph 入口，由宿主构建工具加载样式，而不是让 Node 执行 CSS 导入。服务端和客户端应提供相同输入；自适应内容首次使用宽屏分支是明确行为。包不发起数据请求，也不负责持久化。

完整属性、类型、入口归属与集成限制见 [API 文档](./docs/api.md)。维护命令、tarball 验收和发布前清单见 [DEVELOPMENT.md](./DEVELOPMENT.md)。示例与维护命令均不会发布包。
