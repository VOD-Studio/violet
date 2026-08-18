import { apiDelete, apiGet, apiGetPaged, apiPost, apiPut } from "@shared/api/request";
import type { PageQuery, PagedResponse } from "@shared/api/types";
import type {
	CreateSubscriptionRequest,
	SubscriptionDTO,
	UpdateSubscriptionRequest,
} from "../model/types";

const BASE = "/admin/subscriptions";

/** listSubscriptions - 列出全站订阅（分页 + 可选 status 过滤） */
export const listSubscriptions = async (
	status: string,
	query: PageQuery,
): Promise<PagedResponse<SubscriptionDTO>> =>
	apiGetPaged<SubscriptionDTO>(BASE, { params: { status, ...query } });

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

/** fetchSubscription - 异步触发抓取（立即返回 202，后台 goroutine 执行）。
 * 完成后通过通知系统推送结果（PRD-0015 N5）。不再阻塞等待 FetchReport。 */
export const fetchSubscription = async (id: string): Promise<null> =>
	apiPost<null>(`${BASE}/${id}/fetch`);
/** deleteSubscription - 删除订阅（连带 entries CASCADE） */
export const deleteSubscription = async (id: string): Promise<null> =>
	apiDelete<null>(`${BASE}/${id}`);
