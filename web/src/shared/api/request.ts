import type { AxiosRequestConfig } from "axios";
import { httpClient, type UnpackedResponse } from "./http";
import type { PagedResponse } from "./types";

/**
 * 请求辅助层
 *
 * httpClient 的 response interceptor 已把后端统一信封拆成
 * { data, pagination } 即 UnpackedResponse。本层在其上再解一层，
 * 让业务层直接拿到业务数据，消除各处重复的 res.data.data 取值。
 *
 * 约定：所有 /api/v1 接口都走统一信封，故此处假定响应已被 unpack。
 */

/**
 * GET 单值接口，返回业务数据
 *
 * @param url 相对 baseURL 的路径，如 /auth/me
 * @param config axios 配置，常用于传 params
 */
export const apiGet = async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const res = await httpClient.get<UnpackedResponse<T>>(url, config);
    return res.data.data;
};

/**
 * GET 分页列表接口，返回数据列表与分页元数据
 *
 * @param url 相对 baseURL 的路径
 * @param config axios 配置，通常传 { params: { page, limit, ... } }
 */
export const apiGetPaged = async <T>(
    url: string,
    config?: AxiosRequestConfig,
): Promise<PagedResponse<T>> => {
    const res = await httpClient.get<PagedResponse<T>>(url, config);
    return res.data;
};

/**
 * POST 写接口，返回业务数据
 *
 * @param url 相对 baseURL 的路径
 * @param body 请求体，省略时发送空体
 * @param config axios 配置，文件上传等场景需覆盖 headers
 */
export const apiPost = async <T>(
    url: string,
    body?: unknown,
    config?: AxiosRequestConfig,
): Promise<T> => {
    const res = await httpClient.post<UnpackedResponse<T>>(url, body, config);
    return res.data.data;
};

/**
 * PUT 写接口，返回业务数据
 */
export const apiPut = async <T>(
    url: string,
    body?: unknown,
    config?: AxiosRequestConfig,
): Promise<T> => {
    const res = await httpClient.put<UnpackedResponse<T>>(url, body, config);
    return res.data.data;
};

/**
 * PATCH 写接口，返回业务数据
 */
export const apiPatch = async <T>(
    url: string,
    body?: unknown,
    config?: AxiosRequestConfig,
): Promise<T> => {
    const res = await httpClient.patch<UnpackedResponse<T>>(url, body, config);
    return res.data.data;
};

/**
 * DELETE 写接口，返回业务数据，删除类接口通常 data 为 null
 */
export const apiDelete = async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const res = await httpClient.delete<UnpackedResponse<T>>(url, config);
    return res.data.data;
};
