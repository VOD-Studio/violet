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
