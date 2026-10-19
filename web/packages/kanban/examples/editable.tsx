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
