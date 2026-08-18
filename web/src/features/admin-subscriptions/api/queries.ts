import type { PagedResponse, PageQuery } from "@shared/api/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
	CreateSubscriptionRequest,
	SubscriptionDTO,
	UpdateSubscriptionRequest,
} from "../model/types";
import * as api from "./client";
import { subscriptionKeys } from "./keys";

/** useSubscriptions - 订阅列表 hook（分页 + status 过滤） */
export const useSubscriptions = (query: { status?: string } & PageQuery = {}) => {
	const { status = "", ...paging } = query;
	return useQuery({
		queryKey: subscriptionKeys.list(status, paging),
		queryFn: () => api.listSubscriptions(status, paging),
	});
};

/** useSubscription - 单个订阅详情 hook */
export const useSubscription = (id: string) =>
	useQuery({
		queryKey: subscriptionKeys.detail(id),
		queryFn: () => api.getSubscription(id),
		enabled: !!id,
	});

/** useCreateSubscription - 创建订阅 hook */
export const useCreateSubscription = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: CreateSubscriptionRequest) => api.createSubscription(body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: subscriptionKeys.all });
			toast.success("订阅已创建");
		},
		onError: (e: Error) => toast.error(`创建失败：${e.message}`),
	});
};

/** useUpdateSubscription - 更新订阅 hook */
export const useUpdateSubscription = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, body }: { id: string; body: UpdateSubscriptionRequest }) =>
			api.updateSubscription(id, body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: subscriptionKeys.all });
			toast.success("订阅已更新");
		},
		onError: (e: Error) => toast.error(`更新失败：${e.message}`),
	});
};

/** usePauseSubscription - 暂停订阅 hook */
export const usePauseSubscription = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.pauseSubscription(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: subscriptionKeys.all });
			toast.success("订阅已暂停");
		},
		onError: (e: Error) => toast.error(`暂停失败：${e.message}`),
	});
};

/** useResumeSubscription - 恢复订阅 hook（清零失败计数） */
export const useResumeSubscription = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.resumeSubscription(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: subscriptionKeys.all });
			toast.success("订阅已恢复");
		},
		onError: (e: Error) => toast.error(`恢复失败：${e.message}`),
	});
};

/** useDeleteSubscription - 删除订阅 hook */
export const useDeleteSubscription = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.deleteSubscription(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: subscriptionKeys.all });
			toast.success("订阅已删除");
		},
		onError: (e: Error) => toast.error(`删除失败：${e.message}`),
	});
};
