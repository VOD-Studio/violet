import { apiGet } from "@shared/api/request";
import { useQuery } from "@tanstack/react-query";
import type { EmojiGroup } from "../model/types";
import { emojiKeys } from "./keys";

/**
 * fetchAllEmojis - 调后端 GET /emojis 获取所有启用表情分组
 *
 * 公开接口，返回含 emojis 子列表的分组数组，仅含 is_enabled 为 true 的分组。
 *
 * @returns 启用的表情分组数组
 */
export const fetchAllEmojis = async (): Promise<EmojiGroup[]> => apiGet<EmojiGroup[]>("/emojis");

/**
 * useAllEmojis - 全部启用表情分组 hook
 *
 * 公开数据，缓存 key 固定无参数。staleTime 与重试策略沿用 QueryClient 默认。
 */
export const useAllEmojis = () =>
	useQuery({
		queryKey: emojiKeys.publicGroupList(),
		queryFn: fetchAllEmojis,
	});

/**
 * fetchEmojiGroupByName - 调后端 GET /emojis/groups/{name} 获取指定分组
 *
 * 按分组名称查询，返回该分组及其表情列表，名称不存在时后端返回 404。
 *
 * @param name 分组名称
 * @returns 分组详情含表情列表
 */
export const fetchEmojiGroupByName = async (name: string): Promise<EmojiGroup> =>
	apiGet<EmojiGroup>(`/emojis/groups/${name}`);

/**
 * useEmojiGroupByName - 按名称获取分组 hook
 *
 * @param name 分组名称，传空串时不启用查询避免无效请求
 */
export const useEmojiGroupByName = (name: string) =>
	useQuery({
		queryKey: emojiKeys.publicGroupByName(name),
		queryFn: () => fetchEmojiGroupByName(name),
		enabled: !!name,
	});

/**
 * fetchAllEmojiGroupsAdmin - 调后端 GET /admin/emojis/groups 获取全部分组
 *
 * 后台接口，含未启用分组。后端 ListAllEmojiGroups handler 直接序列化
 * EmojiGroupDTO 数组，未走分页封装，故用 apiGet 取数组而非 apiGetPaged。
 *
 * @returns 全部表情分组数组含未启用
 */
export const fetchAllEmojiGroupsAdmin = async (): Promise<EmojiGroup[]> =>
	apiGet<EmojiGroup[]>("/admin/emojis/groups");

/**
 * useAllEmojiGroupsAdmin - 后台全部分组列表 hook
 *
 * 管理员身份由 httpClient 自动携带 cookie。写操作后需手动 invalidate
 * emojiKeys.adminGroupList()。
 */
export const useAllEmojiGroupsAdmin = () =>
	useQuery({
		queryKey: emojiKeys.adminGroupList(),
		queryFn: fetchAllEmojiGroupsAdmin,
	});

/**
 * fetchGroupEmojisAdmin - 调后端 GET /admin/emojis/groups/{id}/emojis 获取分组内表情
 *
 * 后台接口，返回指定分组下的全部表情，按 sort_order 排序。
 *
 * @param groupId 分组 ID
 * @returns 分组内表情数组
 */
export const fetchGroupEmojisAdmin = async (groupId: number): Promise<EmojiGroup["emojis"]> =>
	apiGet<EmojiGroup["emojis"]>(`/admin/emojis/groups/${groupId}/emojis`);

/**
 * useGroupEmojisAdmin - 后台分组内表情列表 hook
 *
 * @param groupId 分组 ID，传 0 时不启用查询
 */
export const useGroupEmojisAdmin = (groupId: number) =>
	useQuery({
		queryKey: emojiKeys.adminGroupEmojis(groupId),
		queryFn: () => fetchGroupEmojisAdmin(groupId),
		enabled: !!groupId,
	});
