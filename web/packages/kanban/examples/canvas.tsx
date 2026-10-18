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
