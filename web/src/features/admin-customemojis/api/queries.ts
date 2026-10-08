import { customEmojiKeys } from "@features/customemoji/api/keys";
import type { PageQuery } from "@shared/api/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "./client";
import { adminCustomEmojiKeys } from "./keys";

export const useAdminCustomEmojis = (query: { keyword?: string } & PageQuery = {}) => {
	const { keyword = "", ...paging } = query;
	return useQuery({
		queryKey: adminCustomEmojiKeys.list(keyword, paging),
		queryFn: () => api.listAdminCustomEmojis(keyword, paging),
	});
};

export const useAdminDeleteCustomEmoji = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.deleteCustomEmoji(id),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: adminCustomEmojiKeys.all });
			void qc.invalidateQueries({ queryKey: customEmojiKeys.all });
			toast.success("表情已下架");
		},
		onError: (e: Error) => toast.error(`下架失败：${e.message}`),
	});
};
