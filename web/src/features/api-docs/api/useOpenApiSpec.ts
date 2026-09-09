import { useQuery } from "@tanstack/react-query";

import type { OpenApiDoc } from "../model/types";

export const openApiSpecKeys = {
	all: ["openapi-spec"] as const,
};

/**
 * 拉取线上 OpenAPI 文档（GET /api/v1/openapi.json）。
 *
 * 走原生 fetch 而非共享 axios client：spec 端点返回裸文档而非
 * `{data, meta}` 信封，不应经过信封解包拦截器。
 */
export const fetchOpenApiSpec = async (): Promise<OpenApiDoc> => {
	const res = await fetch("/api/v1/openapi.json", {
		headers: { Accept: "application/json" },
	});
	if (!res.ok) {
		throw new Error(`OpenAPI 文档获取失败：${res.status}`);
	}
	return (await res.json()) as OpenApiDoc;
};

/**
 * 线上 API 文档查询。staleTime 10 分钟：spec 只随发版变化，
 * 但长驻会话里也该在部署后自然换新。
 */
export const useOpenApiSpec = () =>
	useQuery({
		queryKey: openApiSpecKeys.all,
		queryFn: fetchOpenApiSpec,
		staleTime: 10 * 60_000,
	});
