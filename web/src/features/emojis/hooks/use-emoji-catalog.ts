import { rememberEmoji, useRecentEmojiKeys } from "@entities/emoji/model/recent";
import type { Emoji, EmojiGroup } from "@entities/emoji/model/types";
import { useMyCustomEmojis } from "@features/customemoji/api/queries";
import type { MineCustomEmojis } from "@features/customemoji/model/types";
import { useSessionStore } from "@shared/api/session";
import { useCallback, useMemo } from "react";
import { useAllEmojis } from "../api/queries";
import {
	createEmojiDirectory,
	type EmojiDirectory,
	getEmojiUnavailableReason,
} from "../model/emoji-catalog";

const EMPTY_GROUPS: readonly EmojiGroup[] = [];
const EMPTY_PERSONAL: MineCustomEmojis = { owned: [], favorited: [] };

interface EmojiCatalogOptions {
	showMyEmojis?: boolean;
	selectedIds?: ReadonlySet<number>;
}

interface EmojiCatalog {
	directory: EmojiDirectory;
	recentKeys: readonly string[];
	publicQuery: ReturnType<typeof useAllEmojis>;
	mineQuery: ReturnType<typeof useMyCustomEmojis>;
	/** 有效选择才写入最近；未知、已回应及不可用项返回 undefined。 */
	select: (key: string) => Emoji | undefined;
}

/**
 * 私人目录只在登录且允许展示时参与解析；浏览不会写入最近记录。
 *
 * @returns 按接口数据变化缓存的目录、本机最近键序、查询状态与选值操作。
 */
export function useEmojiCatalog({
	showMyEmojis = true,
	selectedIds,
}: EmojiCatalogOptions = {}): EmojiCatalog {
	const loggedIn = useSessionStore((state) => state.sessionActive);
	const publicQuery = useAllEmojis();
	const mineQuery = useMyCustomEmojis(loggedIn && showMyEmojis);
	const recentKeys = useRecentEmojiKeys();
	const publicGroups = publicQuery.data ?? EMPTY_GROUPS;
	const personal = loggedIn && showMyEmojis ? (mineQuery.data ?? EMPTY_PERSONAL) : null;
	const directory = useMemo(
		() => createEmojiDirectory(publicGroups, personal),
		[publicGroups, personal],
	);

	const select = useCallback(
		(key: string): Emoji | undefined => {
			const emoji = directory.byKey.get(key);
			if (!emoji || selectedIds?.has(emoji.id) || getEmojiUnavailableReason(emoji)) {
				return undefined;
			}
			rememberEmoji(emoji);
			return emoji;
		},
		[directory, selectedIds],
	);

	return { directory, recentKeys, publicQuery, mineQuery, select };
}
