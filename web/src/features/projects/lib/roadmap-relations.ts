import type { RoadmapItem, RoadmapRelation, RoadmapRelationType } from "../model/roadmap";

/** 一个条目的某一类关系，另一端的条目按关系的先后排列。 */
export interface RelationGroup {
	key: string;
	/** 从这个条目的角度读，例如「被阻塞」「扩展」。 */
	label: string;
	items: RoadmapItem[];
}

/** 先列对它有影响的（谁在阻塞它），再列它造成的影响，最后是扩展与修复。 */
const GROUPS: ReadonlyArray<{
	type: RoadmapRelationType;
	outgoing: boolean;
	label: string;
}> = [
	{ type: "blocks", outgoing: false, label: "被阻塞" },
	{ type: "blocks", outgoing: true, label: "阻塞" },
	{ type: "extends", outgoing: true, label: "扩展" },
	{ type: "extends", outgoing: false, label: "被扩展" },
	{ type: "fixes", outgoing: true, label: "修复" },
	{ type: "fixes", outgoing: false, label: "被修复" },
];

/**
 * 按类型与方向归类一个条目的关系；另一端不在 `items` 里的关系（例如已删除的条目）不列出，
 * 没有关系的类别也不出现。
 */
export function relationGroups(
	itemId: string,
	items: readonly RoadmapItem[],
	relations: readonly RoadmapRelation[],
): RelationGroup[] {
	const byId = new Map(items.map((item) => [item.id, item]));
	return GROUPS.flatMap(({ type, outgoing, label }) => {
		const others = relations
			.filter(
				(relation) =>
					relation.type === type &&
					(outgoing ? relation.source_id : relation.target_id) === itemId,
			)
			.map((relation) => byId.get(outgoing ? relation.target_id : relation.source_id))
			.filter((other): other is RoadmapItem => other !== undefined);
		return others.length > 0 ? [{ key: `${type}:${outgoing}`, label, items: others }] : [];
	});
}
