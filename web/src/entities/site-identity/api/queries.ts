import { queryOptions, useQuery } from "@tanstack/react-query";
import { fetchSiteIdentity } from "./client";

/**
 * 为路由预取与组件读取提供同一份公开身份查询。
 *
 * @remarks 同键缓存保持新鲜 60 秒；SSR 每个请求的 QueryClient 仍独立。
 */
export function siteIdentityQueryOptions() {
	return queryOptions({
		queryKey: ["site-identity"],
		queryFn: fetchSiteIdentity,
		staleTime: 60_000,
	});
}

/**
 * 读取公开身份，不挂起公共页头的渲染。
 *
 * @returns 查询状态；首次请求完成前 data 为 undefined，调用方负责加载与失败展示。
 */
export function useSiteIdentity() {
	return useQuery(siteIdentityQueryOptions());
}
