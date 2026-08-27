/**
 * emojis feature 写操作层：表情图片上传。
 *
 * 与 admin-emojis（后台维护系统表情目录）、customemoji（用户自助上传自定义
 * 表情）共用同一个上传端点，故落在公共 emojis feature，避免两处重复实现
 * （AGENTS.md「公共组件提炼」约定）。
 */
import type { EmojiUploadResult } from "@entities/emoji/model/types";
import { apiPost } from "@shared/api/request";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * useUploadEmoji - 上传表情图片，POST /uploads/emoji
 *
 * multipart/form-data，服务端嗅探真实 MIME 防伪造，返回相对 URL。
 * 文件不落库，仅返回 URL，故无需 invalidate。
 */
export const useUploadEmoji = () =>
	useMutation({
		mutationFn: async (file: File) => {
			const form = new FormData();
			form.append("file", file);
			return apiPost<EmojiUploadResult>("/uploads/emoji", form);
		},
		onError: (e: Error) => toast.error(e.message),
	});
