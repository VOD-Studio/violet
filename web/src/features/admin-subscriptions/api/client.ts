import { apiDelete, apiGet, apiPost, apiPut } from "@shared/api/request";
import type {
	CreateSubscriptionRequest,
	FetchReportDTO,
	SubscriptionDTO,
	SubscriptionListResponse,
	UpdateSubscriptionRequest,
} from "../model/types";

const BASE = "/admin/subscriptions";

/** listSubscriptions - 列出全站订阅（分页 + 可选 status 过滤） */
export const listSubscriptions = async (
	status: string,
	page: number,
	limit: number,
): Promise<SubscriptionListResponse> =>
	apiGet<SubscriptionListResponse>(`${BASE}?status=${status}&page=${page}&limit=${limit}`);

/** getSubscription - 查单个订阅详情 */
export const getSubscription = async (id: string): Promise<SubscriptionDTO> =>
	apiGet<SubscriptionDTO>(`${BASE}/${id}`);

/** createSubscription - 创建订阅 */
export const createSubscription = async (
	body: CreateSubscriptionRequest,
): Promise<SubscriptionDTO> => apiPost<SubscriptionDTO>(BASE, body);

/** updateSubscription - 更新订阅配置 */
export const updateSubscription = async (
	id: string,
	body: UpdateSubscriptionRequest,
): Promise<SubscriptionDTO> => apiPut<SubscriptionDTO>(`${BASE}/${id}`, body);

/** pauseSubscription - 手动暂停 */
export const pauseSubscription = async (id: string): Promise<SubscriptionDTO> =>
	apiPost<SubscriptionDTO>(`${BASE}/${id}/pause`, {});

/** resumeSubscription - 手动恢复（清零失败计数） */
export const resumeSubscription = async (id: string): Promise<SubscriptionDTO> =>
	apiPost<SubscriptionDTO>(`${BASE}/${id}/resume`, {});

/** fetchSubscription - 立即拉取一次（手动触发，不等调度器）。
 * 长耗时操作（拉 feed + 逐条抓正文），单独传 5 分钟超时，不受全局 15s 限制。 */
export const fetchSubscription = async (id: string): Promise<FetchReportDTO> =>
	apiPost<FetchReportDTO>(`${BASE}/${id}/fetch`, {}, { timeout: 300000 });

/** deleteSubscription - 删除订阅（连带 entries CASCADE） */
export const deleteSubscription = async (id: string): Promise<null> =>
	apiDelete<null>(`${BASE}/${id}`);
