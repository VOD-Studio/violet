import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { BotDTO, CreateBotRequest, UpdateBotRequest } from "../model/types";
import * as api from "./client";
import { botKeys } from "./keys";

export const useBots = (query: Parameters<typeof api.listBots>[0]) =>
	useQuery({ queryKey: botKeys.list(query), queryFn: () => api.listBots(query) });

/**
 * 注册 Bot。
 *
 * @remarks 响应里的 token 是明文唯一一次露面，调用方必须立刻展示给操作者。
 */
export const useCreateBot = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: CreateBotRequest) => api.createBot(body),
		onSuccess: (bot) => {
			qc.invalidateQueries({ queryKey: botKeys.all });
			toast.success(`Bot「${bot.name}」已注册`);
		},
		onError: (e: Error) => toast.error(`注册失败：${e.message}`),
	});
};

export const useUpdateBot = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, body }: { id: string; body: UpdateBotRequest }) =>
			api.updateBot(id, body),
		onSuccess: () => qc.invalidateQueries({ queryKey: botKeys.all }),
		onError: (e: Error) => toast.error(`更新失败：${e.message}`),
	});
};

export const useRegenerateBotToken = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.regenerateBotToken(id),
		onSuccess: (bot) => {
			qc.invalidateQueries({ queryKey: botKeys.all });
			toast.success(`已重置「${bot.name}」的 token，旧 token 即刻失效`);
		},
		onError: (e: Error) => toast.error(`重置失败：${e.message}`),
	});
};

export const useDeleteBot = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.deleteBot(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: botKeys.all });
			toast.success("Bot 已吊销");
		},
		onError: (e: Error) => toast.error(`吊销失败：${e.message}`),
	});
};

export type { BotDTO };
