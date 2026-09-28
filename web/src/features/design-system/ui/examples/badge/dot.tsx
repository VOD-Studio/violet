import { Badge, BadgeAnchor, Button } from "@violet/ui";
import { MessageCircle } from "lucide-react";

/** 状态点角标：仅提示新消息存在，edge 贴合按钮圆弧。 */
export function BadgeDotDemo() {
	return (
		<div className="flex justify-center">
			<BadgeAnchor placement="edge" badge={<Badge size="dot" variant="default" />}>
				<Button
					type="button"
					size="icon-sm"
					variant="outline"
					className="rounded-full"
					aria-label="聊天，有新消息"
				>
					<MessageCircle aria-hidden="true" />
				</Button>
			</BadgeAnchor>
		</div>
	);
}
