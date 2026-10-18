import { useState } from "react";
import { createRoot } from "react-dom/client";
import { applyMove } from "../src/core/index.ts";
import { Board, type BoardMove, type BoardState } from "../src/index.ts";

declare global {
	interface Window {
		__moves: BoardMove[];
		__animateCalls: number;
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

function App() {
	const [order, setOrder] = useState(initial);
	const [clicks, setClicks] = useState(0);
	return (
		<div style={{ width: 1000, padding: 24 }}>
			<p id="clicks">clicks: {clicks}</p>
			<Board
				columns={columns}
				cards={tasks}
				order={order}
				locale="en"
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
					setOrder(
						(current) =>
							applyMove(
								{ columns: columns.map((column) => column.id), order: current },
								move,
							).order,
					);
				}}
			/>
		</div>
	);
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
