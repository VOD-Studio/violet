import type { Emoji } from "@entities/emoji/model/types";
import { useSessionStore } from "@shared/api/session";
import {
	Button,
	EmojiPickerPanel,
	type EmojiPickerPanelProps,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@violet/ui";
import { Smile } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useEmojiCatalog } from "../hooks/use-emoji-catalog";
import { EmojiUploadAction } from "./EmojiUploadAction";
import { createEmojiPickerGroups } from "./emoji-picker-groups";

/**
 * 评论、推文和聊天共用的表情选择入口。
 */
export interface EmojiPickerProps {
	/** 自定义触发元素；省略时使用「添加表情」图标按钮。 */
	trigger?: ReactNode;
	onSelect: (emoji: Emoji) => void;
	/**
	 * 浮层相对触发器的水平对齐方式。
	 *
	 * @default start
	 */
	align?: "start" | "center" | "end";
	/** 已回应的系统表情 ID；匹配项可以预览，但不能再次选择。 */
	selectedIds?: Set<number>;
	/**
	 * 连续插入时设为 false，选中后保留浮层且不主动夺取焦点。
	 *
	 * @default true
	 */
	closeOnSelect?: boolean;
	/**
	 * 回应入口只接受系统表情时设为 false，不显示个人收藏与上传。
	 *
	 * @default true
	 */
	showMyEmojis?: boolean;
	/**
	 * 禁用入口并关闭已打开的选择器；重新启用不会自动展开。
	 *
	 * @default false
	 */
	disabled?: boolean;
}

/** 会话切换卸载个人数据和已展开的面板。 */
export function EmojiPicker(props: EmojiPickerProps) {
	const version = useSessionStore((state) => state.sessionVersion);
	return <EmojiPickerSession key={version} {...props} />;
}

function EmojiPickerSession({
	trigger,
	onSelect,
	align = "start",
	selectedIds,
	closeOnSelect = true,
	showMyEmojis = true,
	disabled = false,
}: EmojiPickerProps) {
	const [open, setOpen] = useState(false);
	const [recentOrder, setRecentOrder] = useState<readonly string[] | null>(null);
	const [group, setGroup] = useState("recent");
	const scroll = useRef(new Map<string, number>());
	useEffect(() => {
		if (disabled) {
			setOpen(false);
			setRecentOrder(null);
		}
	}, [disabled]);
	const catalog = useEmojiCatalog({ showMyEmojis, selectedIds });
	const recentKeys = recentOrder ?? catalog.recentKeys;
	const recent = useMemo(() => {
		const emojis: Emoji[] = [];
		for (const key of recentKeys) {
			const emoji = catalog.directory.byKey.get(key);
			if (emoji) {
				emojis.push(emoji);
			}
		}
		return emojis;
	}, [catalog.directory, recentKeys]);
	const groups = useMemo(
		() =>
			createEmojiPickerGroups(catalog.directory, recent, {
				selectedIds,
				uploadAction: <EmojiUploadAction />,
			}),
		[catalog.directory, recent, selectedIds],
	);
	const activeGroup = groups.some((entry) => entry.id === group) ? group : "recent";
	const query = activeGroup === "mine" ? catalog.mineQuery : catalog.publicQuery;
	let status: EmojiPickerPanelProps["status"] = "ready";
	if (query.isLoading) {
		status = "loading";
	} else if (query.isError) {
		status = "error";
	}

	const handleOpenChange = (nextOpen: boolean) => {
		// 同一次打开内保留格子顺序，连续点击同一位置不会换成另一张表情。
		if (nextOpen) {
			setRecentOrder(catalog.recentKeys);
		} else {
			setRecentOrder(null);
		}
		setOpen(nextOpen);
	};
	return (
		<Popover open={open && !disabled} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild disabled={disabled}>
				{trigger ?? (
					<Button
						iconOnly
						type="button"
						variant="ghost"
						size="sm"
						aria-label="添加表情"
						onMouseDown={(event) => event.preventDefault()}
					>
						<Smile className="size-3.5" />
					</Button>
				)}
			</PopoverTrigger>
			<PopoverContent
				align={align}
				aria-label="表情选择器"
				className="w-85 max-w-[calc(100vw-2rem)] p-0"
				onOpenAutoFocus={(event) => event.preventDefault()}
				onFocusOutside={(event) => {
					if (!closeOnSelect) {
						event.preventDefault();
					}
				}}
				onInteractOutside={(event) => {
					if (
						!closeOnSelect &&
						event.target instanceof Element &&
						event.target.closest('[contenteditable="true"],textarea,input')
					) {
						event.preventDefault();
					}
				}}
			>
				<EmojiPickerPanel
					groups={groups}
					activeGroup={activeGroup}
					onGroupChange={setGroup}
					scrollTop={scroll.current.get(activeGroup) ?? 0}
					onScrollTopChange={(value) => scroll.current.set(activeGroup, value)}
					status={status}
					errorMessage={query.error instanceof Error ? query.error.message : undefined}
					onRetry={() => void query.refetch()}
					onSelect={(item) => {
						const emoji = catalog.select(item.id);
						if (!emoji) {
							return;
						}
						onSelect(emoji);
						if (closeOnSelect) {
							handleOpenChange(false);
						}
					}}
				/>
			</PopoverContent>
		</Popover>
	);
}
