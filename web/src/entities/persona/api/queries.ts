import { activePersonaKeys } from "@entities/persona/api/keys";
import type { PublicPersona } from "@entities/persona/model/types";
import { ApiError } from "@shared/api/error";
import { apiGet } from "@shared/api/request";
import { useQuery } from "@tanstack/react-query";

/** 读取当前公开人设；尚未激活时返回 null。 */
export async function fetchActivePersona(locale = ""): Promise<PublicPersona | null> {
	try {
		return await apiGet<PublicPersona>("/persona", {
			params: locale ? { locale } : undefined,
		});
	} catch (error) {
		if (error instanceof ApiError && error.status === 404) return null;
		throw error;
	}
}

/** 当前公开人设查询。 */
export function useActivePersona(locale = "") {
	return useQuery({
		queryKey: activePersonaKeys.current(locale),
		queryFn: () => fetchActivePersona(locale),
	});
}
