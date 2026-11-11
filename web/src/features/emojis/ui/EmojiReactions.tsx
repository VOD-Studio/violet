import type { Emoji } from "@entities/emoji/model/types";
import type { AggregatedReaction } from "@entities/reaction/model/types";
import { EmojiPickerPanel, type EmojiPickerPanelProps, ReactionBar } from "@violet/ui";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useEmojiCatalog } from "../hooks/use-emoji-catalog";
import { EmojiContent } from "./EmojiContent";
import { createEmojiPickerGroups, toEmojiPickerItem } from "./emoji-picker-groups";

/** 评论与聊天共用的公开表情回应入口；私人表情不能进入回应。 */
export interface EmojiReactionsProps {
	reactions: readonly AggregatedReaction[];
	currentUserId?: string;
	isLoggedIn: boolean;
	/** 省略时不显示添加入口，适用于尚未发送成功或已删除的消息。 */
	onAdd?: (emojiId: number) => void;
	onRemove: (emojiId: number) => void;
	/**
	 * 聊天传 3；达到上限时仍可取消已选项。
	 *
	 * @default 不限种类
	 */
	maxSelected?: number;
	/**
	 * 聊天传 6，超出后可展开。
	 *
	 * @default 不折叠
	 */
	collapseAfter?: number;
	onLimit?: () => void;
	limitMessage?: string;
	/**
	 * 提交及刷新期间暂停所有回应操作。
	 *
	 * @default false
	 */
	disabled?: boolean;
	className?: string;
}

export function EmojiReactions({
	reactions,
	currentUserId,
	isLoggedIn,
	onAdd,
	onRemove,
	maxSelected,
	collapseAfter,
	onLimit,
	limitMessage,
	disabled = false,
	className,
}: EmojiReactionsProps) {
	const selectedIds = useMemo(
		() =>
			new Set(
				reactions.filter((reaction) => reaction.self).map((reaction) => reaction.emoji_id),
			),
		[reactions],
	);
	const catalog = useEmojiCatalog({ showMyEmojis: false, selectedIds });
	const recent = useMemo(() => {
		const emojis: Emoji[] = [];
		for (const key of catalog.recentKeys) {
			const emoji = catalog.directory.byKey.get(key);
			if (emoji && !emoji.custom_emoji_id) {
				emojis.push(emoji);
			}
		}
		return emojis;
	}, [catalog.directory, catalog.recentKeys]);
	const recentItems = useMemo(
		() => recent.slice(0, 8).map((emoji) => toEmojiPickerItem(emoji, selectedIds)),
		[recent, selectedIds],
	);
	const groups = useMemo(
		() => createEmojiPickerGroups(catalog.directory, recent, { selectedIds }),
		[catalog.directory, recent, selectedIds],
	);
	const items = useMemo(
		() =>
			reactions.map((reaction) => {
				const emoji: Emoji = {
					...catalog.directory.byKey.get(`system:${reaction.emoji_id}`),
					id: reaction.emoji_id,
					name: reaction.emoji_name,
					url: reaction.emoji_url,
					gif_url: reaction.gif_url,
				};
				const name = reaction.emoji_name.replace(/^\[|\]$/g, "");
				return {
					id: `system:${reaction.emoji_id}`,
					name,
					content: <EmojiContent emoji={emoji} />,
					count: reaction.count,
					self: reaction.self,
					recentUsers: reaction.recent_users.map((user) => ({
						name: user.name,
						self: user.id === currentUserId,
					})),
				};
			}),
		[reactions, currentUserId, catalog.directory],
	);
	const [group, setGroup] = useState("recent");
	const scroll = useRef(new Map<string, number>());
	const activeGroup = groups.some((entry) => entry.id === group) ? group : "recent";
	let status: EmojiPickerPanelProps["status"] = "ready";
	if (catalog.publicQuery.isLoading) {
		status = "loading";
	} else if (catalog.publicQuery.isError) {
		status = "error";
	}
	const add = (key: string) => {
		if (disabled || !isLoggedIn || !onAdd) {
			return false;
		}
		if (maxSelected !== undefined && selectedIds.size >= maxSelected) {
			onLimit?.();
			return false;
		}
		const emoji = catalog.select(key);
		if (!emoji || emoji.custom_emoji_id) {
			return false;
		}
		onAdd(emoji.id);
		return true;
	};
	const toggle = (key: string) => {
		if (!isLoggedIn) {
			toast.info("登录后可以回应");
			return;
		}
		const reaction = reactions.find((entry) => `system:${entry.emoji_id}` === key);
		if (!reaction || disabled) {
			return;
		}
		if (reaction.self) {
			onRemove(reaction.emoji_id);
			return;
		}
		if (!onAdd) {
			return;
		}
		if (maxSelected !== undefined && selectedIds.size >= maxSelected) {
			onLimit?.();
			return;
		}
		catalog.select(key);
		onAdd(reaction.emoji_id);
	};
	return (
		<ReactionBar
			className={className}
			items={items}
			recentItems={recentItems}
			onToggle={toggle}
			onAdd={isLoggedIn && onAdd ? add : undefined}
			maxSelected={maxSelected}
			collapseAfter={collapseAfter}
			onLimit={onLimit}
			limitMessage={limitMessage}
			disabled={disabled}
			renderPicker={({ close }) => (
				<EmojiPickerPanel
					groups={groups}
					activeGroup={activeGroup}
					onGroupChange={setGroup}
					scrollTop={scroll.current.get(activeGroup) ?? 0}
					onScrollTopChange={(value) => scroll.current.set(activeGroup, value)}
					status={status}
					errorMessage={
						catalog.publicQuery.error instanceof Error
							? catalog.publicQuery.error.message
							: undefined
					}
					onRetry={() => void catalog.publicQuery.refetch()}
					onSelect={(item) => {
						if (add(item.id)) {
							close();
						}
					}}
				/>
			)}
		/>
	);
}
