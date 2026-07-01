import type { Emoji, EmojiGroup } from "@entities/emoji/model/types";
import { apiGet } from "@shared/api/request";
import { useQuery } from "@tanstack/react-query";
import { adminEmojiKeys } from "./keys";

/**
 * fetchAllEmojiGroupsAdmin - 调后端 GET /admin/emojis/groups 获取全部分组
 *
 * 含未启用分组。后端 ListAllEmojiGroups 直接序列化 EmojiGroupDTO 数组，未走分页封装。
 */
export const fetchAllEmojiGroupsAdmin = async (): Promise<EmojiGroup[]> =>
    apiGet<EmojiGroup[]>("/admin/emojis/groups");

/** useAllEmojiGroupsAdmin - 后台全部分组列表 hook */
export const useAllEmojiGroupsAdmin = () =>
    useQuery({
        queryKey: adminEmojiKeys.adminGroupList(),
        queryFn: fetchAllEmojiGroupsAdmin,
    });

/**
 * fetchGroupEmojisAdmin - 调后端 GET /admin/emojis/groups/{id}/emojis 获取分组内表情
 *
 * @param groupId 分组 ID
 */
export const fetchGroupEmojisAdmin = async (groupId: number): Promise<Emoji[]> =>
    apiGet<Emoji[]>(`/admin/emojis/groups/${groupId}/emojis`);

/** useGroupEmojisAdmin - 后台分组内表情列表 hook */
export const useGroupEmojisAdmin = (groupId: number) =>
    useQuery({
        queryKey: adminEmojiKeys.adminGroupEmojis(groupId),
        queryFn: () => fetchGroupEmojisAdmin(groupId),
        enabled: !!groupId,
    });
