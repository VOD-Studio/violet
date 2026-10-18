import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
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

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
