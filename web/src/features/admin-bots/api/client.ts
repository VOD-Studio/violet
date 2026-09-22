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

export const deleteBot = async (id: string): Promise<null> => apiDelete<null>(`${BASE}/${id}`);
