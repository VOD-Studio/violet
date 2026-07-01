import { apiGet } from "@shared/api/request";
import { useQuery } from "@tanstack/react-query";
import type { EmojiGroup } from "../model/types";
import { emojiKeys } from "./keys";

/**
 * fetchAllEmojis - 调后端 GET /emojis 获取所有启用表情分组
 *
 * 公开接口，仅含 is_enabled 为 true 的分组。
 */
export const fetchAllEmojis = async (): Promise<EmojiGroup[]> => apiGet<EmojiGroup[]>("/emojis");

/** useAllEmojis - 全部启用表情分组 hook */
export const useAllEmojis = () =>
    useQuery({
        queryKey: emojiKeys.publicGroupList(),
        queryFn: fetchAllEmojis,
    });

/**
 * fetchEmojiGroupByName - 调后端 GET /emojis/groups/{name} 获取指定分组
 *
 * @param name 分组名称，不存在时后端返回 404
 */
export const fetchEmojiGroupByName = async (name: string): Promise<EmojiGroup> =>
    apiGet<EmojiGroup>(`/emojis/groups/${name}`);

/** useEmojiGroupByName - 按名称获取分组 hook，传空串时不启用查询 */
export const useEmojiGroupByName = (name: string) =>
    useQuery({
        queryKey: emojiKeys.publicGroupByName(name),
        queryFn: () => fetchEmojiGroupByName(name),
        enabled: !!name,
    });
