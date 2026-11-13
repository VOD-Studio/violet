import { apiGet } from "@shared/api/request";
import type { SiteIdentity } from "../model/types";

export function fetchSiteIdentity(): Promise<SiteIdentity> {
	return apiGet<SiteIdentity>("/site-identity");
}
