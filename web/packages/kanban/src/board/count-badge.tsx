import { formatMessage } from "../locale.ts";
import type { BoardMessages } from "./messages.ts";

export interface CountBadgeProps {
	/** 列内卡片总数。 */
	count: number;
	/** 筛选生效时匹配的卡片数；没有筛选为 null。 */
	matched: number | null;
	messages: BoardMessages;
}

/** 列内卡片数：可见的是数字（筛选时为「匹配/总数」），读屏朗读完整的句子。 */
export function CountBadge({ count, matched, messages }: CountBadgeProps) {
	return (
		<span className="v-kanban__count">
			<span aria-hidden="true">{matched === null ? count : `${matched}/${count}`}</span>
			<span className="v-kanban__sr-only">
				{matched === null
					? formatMessage(messages.cardCount, { count })
					: formatMessage(messages.cardCountFiltered, { matched, count })}
			</span>
		</span>
	);
}
