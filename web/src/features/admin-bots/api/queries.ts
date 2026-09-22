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
 * @remarks 响应里的 token 是刚签发的明文；之后靠 useRevealBotToken 随时回看。
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

/**
 * 回显 Bot 当前的明文凭据。
 *
 * @remarks 走 mutation 不进查询缓存：凭据只存在调用方的本地 state 里，关掉展示卡即丢弃。
 * 库里无密文可解（早于密文列创建、未配密钥或密钥已换）时后给 400，错误文案直接转给操作者。
 */
export const useRevealBotToken = () =>
	useMutation({
		mutationFn: (id: string) => api.revealBotToken(id),
		onError: (e: Error) => toast.error(e.message),
	});

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
