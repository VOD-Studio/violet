import { emojiKey } from "@entities/emoji/model/recent";
import { toEmojiToken } from "@entities/emoji/model/token";
import type { Emoji, EmojiGroup } from "@entities/emoji/model/types";
import { isImageURL } from "@shared/lib/url";
import type { EmojiPickerGroup, EmojiPickerItem, EmojiPickerSection } from "@violet/ui";
import { Clock, Heart } from "lucide-react";
import type { ReactNode } from "react";
import {
	type EmojiDensity,
	type EmojiDirectory,
	getEmojiDensity,
	getEmojiGroupDensity,
	getEmojiUnavailableReason,
} from "../model/emoji-catalog";
import { EmojiContent } from "./EmojiContent";

interface PickerGroupOptions {
	selectedIds?: ReadonlySet<number>;
	uploadAction?: ReactNode;
}

/** 占位符与实际插入共用实体编码，禁用原因与选择规则共用目录策略。 */
export function toEmojiPickerItem(
	emoji: Emoji,
	selectedIds?: ReadonlySet<number>,
): EmojiPickerItem {
	return {
		id: emojiKey(emoji),
		name: emoji.name.replace(/^\[|\]$/g, ""),
		content: <EmojiContent emoji={emoji} />,
		placeholder: toEmojiToken(emoji),
		aliases: emoji.meta?.alias?.split(/[\s,，]+/).filter(Boolean),
		selected: selectedIds?.has(emoji.id),
		disabledReason: getEmojiUnavailableReason(emoji),
	};
}

function createRecentGroup(
	recent: readonly Emoji[],
	selectedIds?: ReadonlySet<number>,
): EmojiPickerGroup {
	const itemsByDensity: Record<EmojiDensity, EmojiPickerItem[]> = {
		small: [],
		large: [],
		text: [],
	};
	for (const emoji of recent) {
		const density = getEmojiDensity(emoji);
		itemsByDensity[density].push(toEmojiPickerItem(emoji, selectedIds));
	}
	const sections: EmojiPickerSection[] = [
		{ id: "small", label: "小表情", density: "small", items: itemsByDensity.small },
		{ id: "large", label: "大表情", density: "large", items: itemsByDensity.large },
		{ id: "text", label: "颜文字", density: "text", items: itemsByDensity.text },
	];
	const populatedSections = sections.filter((section) => section.items.length > 0);
	if (populatedSections.length === 0) {
		populatedSections.push({
			id: "recent",
			label: "最近使用",
			density: "small",
			items: [],
			emptyMessage: "选过的表情会出现在这里，回应和写评论共用最近记录。",
		});
	}
	return {
		id: "recent",
		label: "最近使用",
		// EmojiPicker.dc.html 的组页签图形为 17px，不使用通用图标档位。
		icon: <Clock size={17} strokeWidth={1.75} />,
		sections: populatedSections,
	};
}

function createPersonalGroup(
	personal: NonNullable<EmojiDirectory["personal"]>,
	options: PickerGroupOptions,
): EmojiPickerGroup {
	const { owned, favorited } = personal;
	const sections: EmojiPickerSection[] = [
		{
			id: "owned",
			label: "我上传的",
			density: "large",
			items: owned.map((emoji) => toEmojiPickerItem(emoji, options.selectedIds)),
			action: options.uploadAction,
		},
	];
	if (owned.length === 0 && favorited.length === 0) {
		sections[0].emptyMessage = "上传图片，或者在正文里右键收藏别人用过的表情";
	}
	if (favorited.length > 0) {
		sections.push({
			id: "favorites",
			label: "我收藏的",
			density: "large",
			items: favorited.map((emoji) => toEmojiPickerItem(emoji, options.selectedIds)),
		});
	}
	return {
		id: "mine",
		label: "收藏",
		icon: <Heart size={17} strokeWidth={1.75} />,
		sections,
	};
}

function createPublicGroup(group: EmojiGroup, selectedIds?: ReadonlySet<number>): EmojiPickerGroup {
	const id = String(group.id);
	const cover = group.cover_url;
	const icon = cover && isImageURL(cover) ? <img src={cover} alt="" /> : undefined;
	return {
		id,
		label: group.name,
		icon,
		sections: [
			{
				id,
				label: group.name,
				density: getEmojiGroupDensity(group),
				items: group.emojis.map((emoji) => toEmojiPickerItem(emoji, selectedIds)),
			},
		],
	};
}

/** 只做展示投影；请求、最近记录写入与登录状态由宿主管理。 */
export function createEmojiPickerGroups(
	directory: EmojiDirectory,
	recent: readonly Emoji[],
	options: PickerGroupOptions,
): EmojiPickerGroup[] {
	const groups = [createRecentGroup(recent, options.selectedIds)];
	if (directory.personal) {
		groups.push(createPersonalGroup(directory.personal, options));
	}
	for (const group of directory.groups) {
		groups.push(createPublicGroup(group, options.selectedIds));
	}
	return groups;
}
