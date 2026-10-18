import type { RoadmapItem, RoadmapRelation, RoadmapRelationType } from "../model/roadmap";

/** 从某个条目的角度读的一种关系：类型加方向，例如「被阻塞」是别的条目阻塞它。 */
export interface RelationKind {
	key: string;
	type: RoadmapRelationType;
	/** 这个条目是关系的来源 */
	outgoing: boolean;
	label: string;
}

/** 先列对它有影响的（谁在阻塞它），再列它造成的影响，最后是扩展与修复。 */
export const RELATION_KINDS: readonly RelationKind[] = [
	{ key: "blocks:in", type: "blocks", outgoing: false, label: "被阻塞" },
	{ key: "blocks:out", type: "blocks", outgoing: true, label: "阻塞" },
	{ key: "extends:out", type: "extends", outgoing: true, label: "扩展" },
	{ key: "extends:in", type: "extends", outgoing: false, label: "被扩展" },
	{ key: "fixes:out", type: "fixes", outgoing: true, label: "修复" },
	{ key: "fixes:in", type: "fixes", outgoing: false, label: "被修复" },
];

/** 一个条目的某一类关系，另一端的条目按关系的先后排列。 */
export interface RelationGroup {
	key: string;
	/** 从这个条目的角度读，例如「被阻塞」「扩展」。 */
	label: string;
	entries: Array<{ relation: RoadmapRelation; item: RoadmapItem }>;
}

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
	return RELATION_KINDS.flatMap(({ key, type, outgoing, label }) => {
		const entries = relations.flatMap((relation) => {
			if (relation.type !== type) return [];
			if ((outgoing ? relation.source_id : relation.target_id) !== itemId) return [];
			const other = byId.get(outgoing ? relation.target_id : relation.source_id);
			return other ? [{ relation, item: other }] : [];
		});
		return entries.length > 0 ? [{ key, label, entries }] : [];
	});
}

/** 在某个条目上按某种关系连到另一个条目时，接口要的来源、目标与类型。 */
export function relationInput(itemId: string, kind: RelationKind, otherId: string) {
	return {
		source_id: kind.outgoing ? itemId : otherId,
		target_id: kind.outgoing ? otherId : itemId,
		type: kind.type,
	};
}
