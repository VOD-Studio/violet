import { apiDelete, apiGetPaged, apiPost } from "@shared/api/request";
import type { PagedResponse, PageQuery } from "@shared/api/types";
import type { CreatePATRequest, PATDTO } from "../model/types";

const BASE = "/admin/api-tokens";

/** listPATs - 分页列出当前用户的 PAT（GET /admin/api-tokens?page=&limit=） */
export const listPATs = async (query: PageQuery): Promise<PagedResponse<PATDTO>> =>
	apiGetPaged<PATDTO>(BASE, { params: query });

/** createPAT - 创建 PAT（POST /admin/api-tokens），返回一次性明文 token */
export const createPAT = async (body: CreatePATRequest): Promise<PATDTO> =>
	apiPost<PATDTO>(BASE, body);

/** deletePAT - 吊销 PAT（DELETE /admin/api-tokens/:id） */
export const deletePAT = async (id: string): Promise<null> => apiDelete<null>(`${BASE}/${id}`);
