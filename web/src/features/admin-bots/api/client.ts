import { apiDelete, apiGetPaged, apiPatch, apiPost } from "@shared/api/request";
import type { PagedResponse, PageQuery } from "@shared/api/types";
import type { BotDTO, CreateBotRequest, UpdateBotRequest } from "../model/types";

const BASE = "/admin/chat-bots";

export const listBots = async (query: PageQuery): Promise<PagedResponse<BotDTO>> =>
	apiGetPaged<BotDTO>(BASE, { params: query });

export const createBot = async (body: CreateBotRequest): Promise<BotDTO> =>
	apiPost<BotDTO>(BASE, body);

export const updateBot = async (id: string, body: UpdateBotRequest): Promise<BotDTO> =>
	apiPatch<BotDTO>(`${BASE}/${id}`, body);

// 重置即作废旧凭据：持有旧 token 的外部程序下一次请求就 401。
export const regenerateBotToken = async (id: string): Promise<BotDTO> =>
	apiPost<BotDTO>(`${BASE}/${id}/regenerate-token`);

/**
 * 回显明文凭据。
 *
 * @remarks 走 POST 而非 GET：明文不得出现在 URL 里（浏览器历史与反代理访问日志都存 URL）。
 */
export const revealBotToken = async (id: string): Promise<BotDTO> =>
	apiPost<BotDTO>(`${BASE}/${id}/token`);

export const deleteBot = async (id: string): Promise<null> => apiDelete<null>(`${BASE}/${id}`);
