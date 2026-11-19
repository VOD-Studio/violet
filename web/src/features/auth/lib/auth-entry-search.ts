import { safeRedirectTarget } from "./safe-redirect";

/** 注册与重置只携带邮箱和站内回跳地址，不传密码或验证码。 */
export function parseAuthEntrySearch(search: Record<string, unknown>): {
	redirect?: string;
	email?: string;
} {
	const redirect =
		typeof search.redirect === "string" ? safeRedirectTarget(search.redirect) : "/";
	return {
		...(redirect !== "/" ? { redirect } : {}),
		...(typeof search.email === "string" ? { email: search.email } : {}),
	};
}
