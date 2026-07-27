import { apiDelete, apiGet, apiPost } from "@shared/api/request";
import type { CreatePATRequest, PATDTO } from "../model/types";

const BASE = "/admin/api-tokens";

/** listPATs - 列出当前用户的全部 PAT（GET /admin/api-tokens） */
export const listPATs = async (): Promise<PATDTO[]> => apiGet<PATDTO[]>(BASE);

/** createPAT - 创建 PAT（POST /admin/api-tokens），返回一次性明文 token */
export const createPAT = async (body: CreatePATRequest): Promise<PATDTO> =>
    apiPost<PATDTO>(BASE, body);

/** deletePAT - 吊销 PAT（DELETE /admin/api-tokens/:id） */
export const deletePAT = async (id: string): Promise<null> => apiDelete<null>(`${BASE}/${id}`);
