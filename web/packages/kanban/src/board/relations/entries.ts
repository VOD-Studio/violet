import type { Adjacency } from "../../core/index.ts";
import { formatMessage } from "../../locale.ts";
import type { BoardMessages } from "../messages.ts";
import { type RelationTypeStyle, relationStyle } from "./types.ts";

/** 一张卡片的一条关系，从这张卡片的角度读。 */
export interface RelationEntry {
	key: string;
	type: string;
	/** 这张卡片是关系的来源（`out`）还是目标（`in`）。 */
	direction: "out" | "in";
	/** 例如「扩展 X」「被阻塞 Y」。 */
	text: string;
	/** 关系另一端的卡片。 */
	targetId: string;
}

/** 一张卡片的每条关系：来源读正向的名称，目标读反向的名称。 */
export function relationEntries(
	adjacency: Adjacency,
	id: string,
	types: Readonly<Record<string, RelationTypeStyle>>,
	cardLabel: (id: string) => string,
): RelationEntry[] {
	return adjacency.of(id).map((relation) => {
		const style = relationStyle(types, relation.type);
		const outgoing = relation.sourceId === id;
		const otherId = outgoing ? relation.targetId : relation.sourceId;
		return {
			// 数据里可能有重复的关系，id 也可能带任何字符：用 NUL 隔开
			key: `${relation.sourceId}\u0000${relation.type}\u0000${relation.targetId}`,
			type: relation.type,
			direction: outgoing ? "out" : "in",
			text: `${outgoing ? style.label : style.inverseLabel} ${cardLabel(otherId)}`,
			targetId: otherId,
		};
	});
}

/** 给读屏的关系汇总句；没有关系时没有。 */
export function relationsSummary(
	entries: readonly RelationEntry[],
	messages: Pick<BoardMessages, "relationsSummary" | "relationsSeparator">,
): string | undefined {
	return entries.length > 0
		? formatMessage(messages.relationsSummary, {
				list: entries.map((entry) => entry.text).join(messages.relationsSeparator),
			})
		: undefined;
}
