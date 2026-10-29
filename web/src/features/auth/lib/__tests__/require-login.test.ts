import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authKeys } from "../../api/keys";
import { requireLogin } from "../require-login";

const sessionActive = vi.hoisted(() => ({ value: false }));
vi.mock("@shared/api/session", () => ({ isSessionActive: () => sessionActive.value }));

const location = { href: "/users/alice/usage?range=7d" };

function args(isAuthenticated: boolean, queryClient = new QueryClient()) {
	return { context: { queryClient, auth: { isAuthenticated } }, location };
}

function thrown(fn: () => void): unknown {
	try {
		fn();
	} catch (error) {
		return error;
	}
	return undefined;
}

describe("requireLogin", () => {
	beforeEach(() => {
		sessionActive.value = false;
	});

	it("未登录：跳转登录页并带回跳地址", () => {
		const error = thrown(() => requireLogin(args(false)));
		expect(error).toMatchObject({
			options: { to: "/login", search: { redirect: location.href }, replace: true },
		});
	});

	it("鉴权快照、会话标记、me 缓存任一存在即放行", () => {
		expect(thrown(() => requireLogin(args(true)))).toBeUndefined();

		sessionActive.value = true;
		expect(thrown(() => requireLogin(args(false)))).toBeUndefined();

		sessionActive.value = false;
		const qc = new QueryClient();
		qc.setQueryData(authKeys.me(), { id: "u1" });
		expect(thrown(() => requireLogin(args(false, qc)))).toBeUndefined();
	});
});
