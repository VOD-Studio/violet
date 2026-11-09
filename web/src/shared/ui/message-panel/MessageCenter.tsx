import { BadgeAnchor, Button, Count, Popover, PopoverContent, PopoverTrigger } from "@violet/ui";
import { Bell, BellRing } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { useMemo, useRef, useState } from "react";
import { MessagePanel, type MessagePanelProps } from "./MessagePanel";
import type { MessageTab } from "./types";

/** 站点顶栏的右药丸；铃铛在里面时，面板对齐整枚药丸而不是铃铛。 */
const NAVBAR_PILL = '[data-slot="navbar-right"]';

/** 消息面板的内容加铃铛触发器与开合。 */
export interface MessageCenterProps extends Omit<MessagePanelProps, "tab" | "onTabChange"> {
	/** 角标与按钮名称里的未读数：通知与聊天之和。 */
	unread: number;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	/** 受控标签；省略时内部记住上次停留的标签。 */
	tab?: MessageTab;
	onTabChange?: (tab: MessageTab) => void;
	/** 面板挂载的容器，默认 `document.body`；陈列室放进自己的舞台。 */
	container?: HTMLElement | null;
}

/** 导航右药丸里的铃铛：角标是未读之和，点开在药丸下方浮出消息面板。 */
export function MessageCenter({
	unread,
	open,
	onOpenChange,
	tab: tabProp,
	onTabChange,
	container,
	...panel
}: MessageCenterProps) {
	const [innerTab, setInnerTab] = useState<MessageTab>("notice");
	const tab = tabProp ?? innerTab;
	const Icon = unread > 0 ? BellRing : Bell;

	const trigger = useRef<HTMLButtonElement>(null);
	// 每次定位时才量：药丸里的按钮增减后面板仍对齐药丸右缘
	const anchor = useMemo(
		() => ({
			current: {
				getBoundingClientRect: () =>
					(
						trigger.current?.closest(NAVBAR_PILL) ??
						trigger.current ??
						document.body
					).getBoundingClientRect(),
			},
		}),
		[],
	);

	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			<PopoverPrimitive.Anchor virtualRef={anchor} />
			<BadgeAnchor badge={<Count value={unread} />}>
				<PopoverTrigger asChild>
					<Button
						ref={trigger}
						iconOnly
						variant="ghost"
						size="sm"
						aria-label={unread > 0 ? `消息，${unread} 条未读` : "消息"}
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
				<MessagePanel
					{...panel}
					tab={tab}
					onTabChange={(next) => {
						setInnerTab(next);
						onTabChange?.(next);
					}}
				/>
			</PopoverContent>
		</Popover>
	);
}
