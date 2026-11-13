import { BadgeAnchor, Button, Count, Popover, PopoverContent, PopoverTrigger } from "@violet/ui";
import { Bell, BellRing } from "lucide-react";
import { useState } from "react";
import { MessagePanel, type MessagePanelProps } from "./MessagePanel";
import type { MessageTab } from "./types";

/** 消息面板的内容加铃铛触发器与开合。 */
export interface MessageCenterProps extends Omit<MessagePanelProps, "tab" | "onTabChange"> {
	/** 角标与按钮名称里的未读数：通知与聊天之和。 */
	unread: number;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	/** 受控标签；省略时内部记住上次停留的标签。 */
	tab?: MessageTab;
	onTabChange?: (tab: MessageTab) => void;
	/** 默认挂载到 `document.body`。 */
	container?: HTMLElement | null;
}

/**
 * 消息铃铛与面板，合并通知和聊天的未读数。
 *
 * @remarks 未受控的开合与标签保存在当前组件实例；默认使用 popover。
 */
export function MessageCenter({
	unread,
	open,
	onOpenChange,
	tab: tabProp,
	onTabChange,
	container,
	...panel
}: MessageCenterProps) {
	const [innerOpen, setInnerOpen] = useState(false);
	const isOpen = open ?? innerOpen;
	const [innerTab, setInnerTab] = useState<MessageTab>("notice");
	const tab = tabProp ?? innerTab;
	const Icon = unread > 0 ? BellRing : Bell;

	const changeOpen = (next: boolean) => {
		setInnerOpen(next);
		onOpenChange?.(next);
	};
	const content = (
		<MessagePanel
			{...panel}
			tab={tab}
			onTabChange={(next) => {
				setInnerTab(next);
				onTabChange?.(next);
			}}
		/>
	);
	const label = unread > 0 ? `消息，${unread} 条未读` : "消息";

	return (
		<Popover open={isOpen} onOpenChange={changeOpen}>
			<BadgeAnchor badge={<Count value={unread} />}>
				<PopoverTrigger asChild>
					<Button
						iconOnly
						variant="ghost"
						size="sm"
						aria-label={label}
						className="text-muted-foreground hover:text-foreground"
					>
						<Icon className="size-4.25" />
					</Button>
				</PopoverTrigger>
			</BadgeAnchor>
			<PopoverContent
				aria-label="消息"
				align="end"
				sideOffset={12}
				container={container}
				className="w-95 max-w-[calc(100vw-1rem)] rounded-2xl p-2"
			>
				{content}
			</PopoverContent>
		</Popover>
	);
}
