import { BadgeAnchor, Button, Count, Popover, PopoverContent, PopoverTrigger } from "@violet/ui";
import { Bell, BellRing } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { MessagePanel, type MessagePanelProps } from "./MessagePanel";
import type { MessageTab } from "./types";

/** 站点顶栏的右药丸；铃铛在里面时，面板对齐整枚药丸而不是铃铛。 */
const NAVBAR_PILL = '[data-slot="navbar-right"]';

/** 面板与药丸（没有药丸时与铃铛）之间的间隙，px。 */
const PANEL_GAP = 12;

/** 面板相对铃铛的偏移：右缘多出的距离与到面板的距离。 */
interface PanelOffset {
	overhang: number;
	gap: number;
}

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
	const [innerOpen, setInnerOpen] = useState(false);
	const isOpen = open ?? innerOpen;
	const [innerTab, setInnerTab] = useState<MessageTab>("notice");
	const tab = tabProp ?? innerTab;
	const Icon = unread > 0 ? BellRing : Bell;

	const trigger = useRef<HTMLButtonElement>(null);
	const [offset, setOffset] = useState<PanelOffset>({ overhang: 0, gap: PANEL_GAP });
	// 打开时量一次：药丸里铃铛右侧还有别的按钮，面板仍对齐药丸右缘，且离药丸而不是离铃铛固定间隙
	useLayoutEffect(() => {
		const bell = trigger.current;
		if (!isOpen || !bell) return;
		const pill = bell.closest(NAVBAR_PILL)?.getBoundingClientRect();
		const own = bell.getBoundingClientRect();
		setOffset({
			overhang: pill ? pill.right - own.right : 0,
			gap: PANEL_GAP + (pill ? pill.bottom - own.bottom : 0),
		});
	}, [isOpen]);

	return (
		<Popover
			open={isOpen}
			onOpenChange={(next) => {
				setInnerOpen(next);
				onOpenChange?.(next);
			}}
		>
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
				alignOffset={-offset.overhang}
				sideOffset={offset.gap}
				container={container}
				onFocusOutside={(event) => {
					// 先开着账号菜单再点铃铛：菜单收起时把焦点还给自己的触发器，不算离开面板，否则面板刚开就被关掉
					if (
						event.target instanceof Element &&
						event.target.closest('[aria-haspopup="menu"]')
					) {
						event.preventDefault();
					}
				}}
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
