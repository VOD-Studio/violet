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
