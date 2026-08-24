/**
 * customemoji feature 读写层：我的表情查询 + 上传/删除/收藏/移出 mutation。
 *
 * 均要求登录（调用方按登录态决定是否 enabled/挂载），成功后统一失效
 * 当前会话版本的 mine query——份额、owned/favorited 分组均从这一聚合数据派生。
 */
import { apiDelete, apiGet, apiPost } from "@shared/api/request";
import { useSessionStore } from "@shared/api/session";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
	CreateCustomEmojiInput,
	CustomEmojiRawDTO,
	MineCustomEmojis,
	MineCustomEmojisRawDTO,
} from "../model/types";
import { toMineCustomEmojis } from "../model/types";
import { customEmojiKeys } from "./keys";

const fetchMine = async (): Promise<MineCustomEmojis> => {
	const raw = await apiGet<MineCustomEmojisRawDTO>("/custom-emojis/mine");
	return toMineCustomEmojis(raw);
};

/** 我的表情（自传+收藏）。enabled 由调用方按登录态传入，未登录不发请求。 */
export const useMyCustomEmojis = (enabled: boolean) => {
	const sessionVersion = useSessionStore((state) => state.sessionVersion);
	return useQuery({
		queryKey: customEmojiKeys.mine(sessionVersion),
		queryFn: fetchMine,
		enabled,
		gcTime: 0,
	});
};

/** 创建自定义表情；url 来自已有 /uploads/emoji 上传结果。 */
export const useCreateCustomEmoji = () => {
	const qc = useQueryClient();
	const sessionVersion = useSessionStore((state) => state.sessionVersion);
	return useMutation({
		mutationFn: (body: CreateCustomEmojiInput) =>
			apiPost<CustomEmojiRawDTO>("/custom-emojis", body),
		onSuccess: () => qc.invalidateQueries({ queryKey: customEmojiKeys.mine(sessionVersion) }),
		onError: (e: Error) => toast.error(e.message),
	});
};

/** 删除自定义表情；上传者本人或管理员可执行。 */
export const useDeleteCustomEmoji = () => {
	const qc = useQueryClient();
	const sessionVersion = useSessionStore((state) => state.sessionVersion);
	return useMutation({
		mutationFn: (id: string) => apiDelete<null>(`/custom-emojis/${id}`),
		onSuccess: () => qc.invalidateQueries({ queryKey: customEmojiKeys.mine(sessionVersion) }),
		onError: (e: Error) => toast.error(e.message),
	});
};

/** 收藏自定义表情；收藏是引用关系而非图片拷贝。 */
export const useFavoriteCustomEmoji = () => {
	const qc = useQueryClient();
	const sessionVersion = useSessionStore((state) => state.sessionVersion);
	return useMutation({
		mutationFn: (id: string) => apiPost<null>(`/custom-emojis/${id}/favorite`),
		onSuccess: () => qc.invalidateQueries({ queryKey: customEmojiKeys.mine(sessionVersion) }),
		onError: (e: Error) => toast.error(e.message),
	});
};

/** 移出自定义表情收藏。 */
export const useUnfavoriteCustomEmoji = () => {
	const qc = useQueryClient();
	const sessionVersion = useSessionStore((state) => state.sessionVersion);
	return useMutation({
		mutationFn: (id: string) => apiDelete<null>(`/custom-emojis/${id}/favorite`),
		onSuccess: () => qc.invalidateQueries({ queryKey: customEmojiKeys.mine(sessionVersion) }),
		onError: (e: Error) => toast.error(e.message),
	});
};
