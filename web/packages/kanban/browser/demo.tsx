import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas } from "../src/canvas/index.ts";
import { applyMove, invertMove } from "../src/core/index.ts";
import {
	Board,
	type BoardMove,
	type BoardState,
	createHistory,
	HistoryButtons,
	useHistoryShortcuts,
} from "../src/index.ts";

declare global {
	interface Window {
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

createRoot(document.getElementById("root") as HTMLElement).render(
	params.get("view") === "canvas" ? <CanvasDemo /> : <App />,
);
