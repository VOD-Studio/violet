import { apiGet } from "@shared/api/request";
import type { SiteIdentity } from "../model/types";

/**
 * 匿名读取服务端归一后的公开站点身份。
 *
 * @returns 已解包的公开身份；请求失败时拒绝 Promise，不伪造站点资料。
 */
export function fetchSiteIdentity(): Promise<SiteIdentity> {
	return apiGet<SiteIdentity>("/site-identity");
}
