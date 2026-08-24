/**
 * customemoji feature 读写层：我的表情查询 + 上传/删除/收藏/移出 mutation。
 *
 * 均要求登录（调用方按登录态决定是否 enabled/挂载），成功后统一失效
 * customEmojiKeys.mine()——份额、owned/favorited 分组均从这一份聚合数据派生，
 * 不单独维护子缓存，避免多处手动同步。
 */
import { apiDelete, apiGet, apiPost } from "@shared/api/request";
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

/** useMyCustomEmojis - 我的表情（自传+收藏）。enabled 由调用方按登录态传入，未登录不发请求。 */
export const useMyCustomEmojis = (enabled: boolean) =>
	useQuery({
		queryKey: customEmojiKeys.mine(),
		queryFn: fetchMine,
		enabled,
	});

/** useCreateCustomEmoji - 上传自定义表情（url 来自已有 POST /uploads/emoji 上传结果两步流） */
export const useCreateCustomEmoji = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: CreateCustomEmojiInput) =>
			apiPost<CustomEmojiRawDTO>("/custom-emojis", body),
		onSuccess: () => qc.invalidateQueries({ queryKey: customEmojiKeys.mine() }),
		onError: (e: Error) => toast.error(e.message),
	});
};

/** useDeleteCustomEmoji - 删除自己上传的表情，或管理员强制下架任意用户的表情 */
export const useDeleteCustomEmoji = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => apiDelete<null>(`/custom-emojis/${id}`),
		onSuccess: () => qc.invalidateQueries({ queryKey: customEmojiKeys.mine() }),
		onError: (e: Error) => toast.error(e.message),
	});
};

/** useFavoriteCustomEmoji - 收藏一个表情（引用式，非拷贝） */
export const useFavoriteCustomEmoji = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => apiPost<null>(`/custom-emojis/${id}/favorite`),
		onSuccess: () => qc.invalidateQueries({ queryKey: customEmojiKeys.mine() }),
		onError: (e: Error) => toast.error(e.message),
	});
};

/** useUnfavoriteCustomEmoji - 移出收藏 */
export const useUnfavoriteCustomEmoji = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => apiDelete<null>(`/custom-emojis/${id}/favorite`),
		onSuccess: () => qc.invalidateQueries({ queryKey: customEmojiKeys.mine() }),
		onError: (e: Error) => toast.error(e.message),
	});
};
