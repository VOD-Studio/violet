import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas } from "../src/canvas/index.ts";
import type { Relation } from "../src/core/index.ts";
import { applyMove, invertMove } from "../src/core/index.ts";
import { RelationGraph } from "../src/graph/index.ts";
import {
	Board,
	type BoardMove,
	type BoardState,
	createHistory,
	HistoryButtons,
	InlineEdit,
	ResponsiveLayout,
	useHistoryShortcuts,
} from "../src/index.ts";

declare global {
	interface Window {
		__added: Array<{ columnId: string; title: string }>;
		__saved: Array<{ id: string; title: string }>;
		__moves: BoardMove[];
		__animateCalls: number;
		__pageKeys: string[];
	}
}

interface Task {
	id: string;
	title: string;
}

const tasks: Task[] = ["a", "b", "c", "d", "e"].map((id) => ({
	id,
	title: `Task ${id.toUpperCase()}`,
}));
const columns = [
	{ id: "todo", title: "Planned" },
	{ id: "doing", title: "In progress" },
	{ id: "done", title: "Done", autoSort: "start" as const },
];
const initial: BoardState["order"] = { todo: ["a", "b", "c"], doing: ["d"], done: ["e"] };

const params = new URLSearchParams(location.search);
const failMoves = params.has("fail");

window.__moves = [];
window.__added = [];
window.__saved = [];
// 页面级快捷键的替身：拿起期间不该收到看板接管的按键
window.__pageKeys = [];
window.addEventListener("keydown", (event) => window.__pageKeys.push(event.key));

const columnIds = columns.map((column) => column.id);

function App() {
	const [order, setOrder] = useState(initial);
	const [clicks, setClicks] = useState(0);
	const history = useMemo(() => createHistory(), []);
	useHistoryShortcuts(history);
	const apply = (move: BoardMove) =>
		setOrder((previous) => applyMove({ columns: columnIds, order: previous }, move).order);
	return (
		<div style={{ width: 1000, padding: 24 }}>
			<p id="clicks">clicks: {clicks}</p>
			<div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
				<HistoryButtons history={history} locale="en" />
				<input id="note" aria-label="note" defaultValue="note" />
			</div>
			<Board
				columns={columns}
				cards={tasks}
				order={order}
				locale="en"
				getCardLabel={(task) => task.title}
				renderCard={(task) => (
					<button
						type="button"
						onClick={() => setClicks((count) => count + 1)}
						style={{ all: "unset", display: "block", width: "100%" }}
					>
						{task.title}
					</button>
				)}
				onMove={async (move) => {
					window.__moves.push(move);
					await new Promise((resolve) => setTimeout(resolve, 30));
					if (failMoves) throw new Error("save failed");
					apply(move);
					history.push({
						label: `move ${move.cardId.toUpperCase()}`,
						undo: () => apply(invertMove(move)),
						redo: () => apply(move),
					});
				}}
			/>
		</div>
	);
}

const tall = Array.from({ length: 10 }, (_, index) => ({
	id: `l${index + 1}`,
	title: `Later ${index + 1}`,
}));
const canvasTasks = [...tasks, { id: "f", title: "Task F" }, ...tall];
const wide = [
	...columns,
	{ id: "c4", title: "Later" },
	{ id: "c5", title: "Backlog" },
	{ id: "c6", title: "Ideas" },
];
// c4 很高、c6 在最右：默认适应窗口后，底部与右侧的卡片都在视口之外
const wideOrder: BoardState["order"] = {
	...initial,
	c4: tall.map((task) => task.id),
	c5: [],
	c6: ["f"],
};
const wideIds = wide.map((column) => column.id);

/**
 * 画布视图：一块比窗口宽的看板放进画布，画布下面有一大块页面，用来验证滚轮不被劫持。
 * 带 `edit` 参数时看板可编辑，移动记录在 `window.__moves`。
 */
function CanvasDemo() {
	const editable = params.has("edit");
	const [order, setOrder] = useState(wideOrder);
	return (
		<div style={{ width: 900, padding: 24 }}>
			<p id="before">above the canvas</p>
			<button type="button" id="outside-before">
				outside before
			</button>
			<Canvas style={{ height: 420 }} locale="en">
				<Board
					columns={wide}
					cards={canvasTasks}
					order={order}
					getCardLabel={(task) => task.title}
					renderCard={(task) => (
						<button
							type="button"
							style={{ all: "unset", display: "block", width: "100%" }}
						>
							{task.title}
						</button>
					)}
					onMove={
						editable
							? async (move) => {
									window.__moves.push(move);
									await new Promise((resolve) => setTimeout(resolve, 30));
									setOrder(
										(previous) =>
											applyMove({ columns: wideIds, order: previous }, move)
												.order,
									);
								}
							: undefined
					}
				/>
			</Canvas>
			<button type="button" id="outside-after">
				outside after
			</button>
			<div id="spacer" style={{ height: 2400 }}>
				page keeps scrolling
			</div>
		</div>
	);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 外壳视图：折叠、列底添加、标题内联编辑与筛选（`filter` 参数）。 */
function ShellDemo() {
	const [titles, setTitles] = useState<Record<string, string>>(
		Object.fromEntries(tasks.map((task) => [task.id, task.title])),
	);
	const [added, setAdded] = useState<Task[]>([]);
	const [order, setOrder] = useState(initial);
	const cards = [...tasks, ...added].map((task) => ({
		...task,
		title: titles[task.id] ?? task.title,
	}));
	return (
		<div style={{ width: 1000, padding: 24 }}>
			<Board
				columns={columns}
				cards={cards}
				order={order}
				locale="en"
				collapsible
				filter={params.has("filter") ? (task) => /[ab]$/i.test(task.title) : undefined}
				getCardLabel={(task) => task.title}
				renderCard={(task) => (
					<InlineEdit
						value={task.title}
						label="Card title"
						onSave={async (title) => {
							window.__saved.push({ id: task.id, title });
							await sleep(20);
							setTitles((previous) => ({ ...previous, [task.id]: title }));
						}}
					/>
				)}
				onAddCard={async ({ columnId, title }) => {
					window.__added.push({ columnId, title });
					await sleep(20);
					const id = `n${added.length + 1}`;
					setAdded((previous) => [...previous, { id, title }]);
					setTitles((previous) => ({ ...previous, [id]: title }));
					setOrder((previous) => ({
						...previous,
						[columnId]: [...previous[columnId], id],
					}));
				}}
				onMove={async (move) => {
					window.__moves.push(move);
					await sleep(30);
					setOrder(
						(previous) =>
							applyMove({ columns: columnIds, order: previous }, move).order,
					);
				}}
			/>
		</div>
	);
}

const demoRelations: Relation[] = [
	{ sourceId: "a", targetId: "d", type: "extends" },
	{ sourceId: "b", targetId: "d", type: "fixes" },
	{ sourceId: "e", targetId: "c", type: "blocks" },
	{ sourceId: "a", targetId: "c", type: "extends" },
];

/** 关系视图：带关系线的可编辑看板，`canvas` 参数把它放进画布，`narrow` 参数让看板出现横向滚动。 */
function RelationsDemo() {
	const [order, setOrder] = useState(initial);
	const [selected, setSelected] = useState<string | null>(null);
	const [hidden, setHidden] = useState(false);
	const board = (
		<Board
			columns={columns}
			cards={tasks}
			order={order}
			locale="en"
			relations={demoRelations}
			hideRelations={hidden}
			selectedCardId={selected}
			onSelectedCardChange={setSelected}
			getCardLabel={(task) => task.title}
			renderCard={(task) => <span>{task.title}</span>}
			onMove={async (move) => {
				window.__moves.push(move);
				await sleep(30);
				setOrder(
					(previous) => applyMove({ columns: columnIds, order: previous }, move).order,
				);
			}}
		/>
	);
	return (
		<div style={{ width: params.has("narrow") ? 600 : 1000, padding: 24 }}>
			<label>
				<input
					id="hide-relations"
					type="checkbox"
					checked={hidden}
					onChange={(event) => setHidden(event.target.checked)}
				/>{" "}
				hide relations
			</label>
			{params.has("canvas") ? <Canvas style={{ height: 420 }}>{board}</Canvas> : board}
		</div>
	);
}

const laneTasks = ["l1", "l2", "l3", "l4", "l5", "x1"].map((id) => ({ id, title: `Lane ${id}` }));
const laneColumns = [
	{ id: "first", title: "First" },
	{ id: "last", title: "Last" },
];
// 最后一列里重叠的同列关系：l1→l5 包住 l2→l4，l3→l4 与它们都重叠
const laneRelations: Relation[] = [
	{ sourceId: "l1", targetId: "l5", type: "extends" },
	{ sourceId: "l2", targetId: "l4", type: "extends" },
	{ sourceId: "l3", targetId: "l4", type: "blocks" },
	{ sourceId: "l5", targetId: "l2", type: "fixes" },
];

/** 车道视图：重叠的同列关系在最后一列里错开，弧线不能被滚动层裁掉。 */
function LanesDemo() {
	return (
		<div style={{ width: 600, padding: 24 }}>
			<Board
				columns={laneColumns}
				cards={laneTasks}
				order={{ first: ["x1"], last: ["l1", "l2", "l3", "l4", "l5"] }}
				locale="en"
				relations={laneRelations}
				getCardLabel={(task) => task.title}
				renderCard={(task) => <span>{task.title}</span>}
			/>
		</div>
	);
}

const laterTasks = Array.from({ length: 14 }, (_, index) => ({
	id: `m${index + 1}`,
	title: `Later ${index + 1}`,
}));
const longTitle = "A very long card title that keeps going well past the width of a phone screen";
const switcherTasks = [...tasks, ...laterTasks, { id: "long", title: longTitle }];
const switcherColumns = [...columns, { id: "later", title: "Later" }];
const switcherIds = switcherColumns.map((column) => column.id);
const switcherRelations: Relation[] = [
	{ sourceId: "a", targetId: "d", type: "extends" },
	{ sourceId: "e", targetId: "c", type: "blocks" },
	{ sourceId: "m1", targetId: "m14", type: "extends" },
	{ sourceId: "b", targetId: "long", type: "fixes" },
];

/** 窄屏视图：列切换布局的可编辑看板，带关系标记；`fail` 参数让保存失败。 */
function SwitcherDemo() {
	const [order, setOrder] = useState<BoardState["order"]>({
		...initial,
		later: [...laterTasks.map((task) => task.id), "long"],
	});
	return (
		<div style={{ padding: 12 }}>
			<Board
				layout="switcher"
				columns={switcherColumns}
				cards={switcherTasks}
				order={order}
				relations={switcherRelations}
				locale="en"
				getCardLabel={(task) => task.title}
				renderCard={(task) => <span>{task.title}</span>}
				onMove={async (move) => {
					window.__moves.push(move);
					await sleep(30);
					if (failMoves) throw new Error("save failed");
					setOrder(
						(previous) =>
							applyMove({ columns: switcherIds, order: previous }, move).order,
					);
				}}
			/>
		</div>
	);
}

/**
 * 响应式视图：宽屏是画布里的看板，窄屏是列切换布局；`width` 参数固定容器宽度（px），
 * 用来在桌面窗口里验证阈值。显示的列由页面持有，两种布局之间切换时延续。
 */
function ResponsiveDemo() {
	const [order, setOrder] = useState(initial);
	const [active, setActive] = useState<string>();
	const fixed = params.get("width");
	const shared = {
		columns,
		cards: tasks,
		order,
		locale: "en" as const,
		relations: demoRelations,
		getCardLabel: (task: Task) => task.title,
		renderCard: (task: Task) => <span>{task.title}</span>,
		onMove: async (move: BoardMove) => {
			window.__moves.push(move);
			await sleep(30);
			setOrder((previous) => applyMove({ columns: columnIds, order: previous }, move).order);
		},
	};
	return (
		// 页面的左右留白：看板的聚焦环空间靠负外边距向外延伸 6px，紧贴窗口边缘会造成横向滚动
		<div style={{ width: fixed ? Number(fixed) : undefined, padding: 12 }}>
			<ResponsiveLayout
				narrow={
					<Board
						layout="switcher"
						activeColumn={active}
						onActiveColumnChange={setActive}
						{...shared}
					/>
				}
			>
				<Canvas style={{ height: 420 }}>
					<Board {...shared} />
				</Canvas>
			</ResponsiveLayout>
		</div>
	);
}

/** 一大片卡片：四列、每列 `count / 4` 张，关系线按固定步长连出去。 */
function manyGraph(count: number) {
	const names = ["c0", "c1", "c2", "c3"];
	const cards = Array.from({ length: count }, (_, index) => ({
		id: `n${index}`,
		title: `Node ${index}`,
	}));
	const manyColumns = names.map((id) => ({ id, title: id.toUpperCase() }));
	const manyOrder = Object.fromEntries(
		names.map((name, at) => [
			name,
			cards.filter((_, index) => index % 4 === at).map((card) => card.id),
		]),
	);
	const links: Relation[] = Array.from({ length: Math.floor(count * 1.5) }, (_, index) => ({
		sourceId: `n${(index * 7) % count}`,
		targetId: `n${(index * 11 + 3) % count}`,
		type: ["extends", "fixes", "blocks"][index % 3],
	}));
	return { cards, columns: manyColumns, order: manyOrder, relations: links };
}

/**
 * 关系图视图：关系图放进画布，画布下面有一大块页面，用来验证滚轮不被劫持。
 * `root` 参数只显示该卡片的子图（`depth` 限制步数），`many` 参数换成指定张数的大图。
 */
function GraphDemo() {
	const [selected, setSelected] = useState<string | null>(null);
	const [opened, setOpened] = useState<string[]>([]);
	const count = Number(params.get("many") ?? 0);
	const data = count > 0 ? manyGraph(count) : null;
	return (
		<div style={{ width: 900, padding: 24 }}>
			<p id="opened">opened: {opened.join(",")}</p>
			<button type="button" id="outside-before">
				outside before
			</button>
			<Canvas style={{ height: 420 }} locale="en">
				<RelationGraph
					columns={data?.columns ?? columns}
					cards={data?.cards ?? tasks}
					order={data?.order ?? initial}
					relations={data?.relations ?? demoRelations}
					rootId={params.get("root") ?? undefined}
					subgraph={
						params.has("depth") ? { depth: Number(params.get("depth")) } : undefined
					}
					selectedCardId={selected}
					onSelectedCardChange={setSelected}
					locale="en"
					getCardLabel={(card) => card.title}
					renderCard={(card) => (
						<button
							type="button"
							style={{ all: "unset", display: "block", width: "100%" }}
							onClick={() => setOpened((previous) => [...previous, card.id])}
						>
							{card.title}
						</button>
					)}
				/>
			</Canvas>
			<button type="button" id="outside-after">
				outside after
			</button>
			<div id="spacer" style={{ height: 2400 }}>
				page keeps scrolling
			</div>
		</div>
	);
}

const view = params.get("view");
createRoot(document.getElementById("root") as HTMLElement).render(
	view === "canvas" ? (
		<CanvasDemo />
	) : view === "shell" ? (
		<ShellDemo />
	) : view === "relations" ? (
		<RelationsDemo />
	) : view === "lanes" ? (
		<LanesDemo />
	) : view === "switcher" ? (
		<SwitcherDemo />
	) : view === "responsive" ? (
		<ResponsiveDemo />
	) : view === "graph" ? (
		<GraphDemo />
	) : (
		<App />
	),
);
