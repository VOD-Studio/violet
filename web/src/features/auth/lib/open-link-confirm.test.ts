import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ApiError } from "@shared/api/error";

import { useLinkConfirmStore } from "../model/link-confirm-store";
import { openLinkConfirmFromError } from "./open-link-confirm";

describe("openLinkConfirmFromError", () => {
	beforeEach(() => {
		useLinkConfirmStore.getState().close();
	});

	afterEach(() => {
		useLinkConfirmStore.getState().close();
	});

	it("409 LINK_CONFIRMATION_REQUIRED 打开确认弹窗并透传字段", () => {
		const err = new ApiError({
			error: "LINK_CONFIRMATION_REQUIRED",
			message: "该邮箱 s***@rua.plus 已注册账号",
			status: 409,
			data: {
				link_token: "tok-1",
				email: "s***@rua.plus",
				has_password: true,
				provider: "GitHub",
			},
		});

		expect(openLinkConfirmFromError(err)).toBe(true);
		expect(useLinkConfirmStore.getState().payload).toEqual({
			linkToken: "tok-1",
			email: "s***@rua.plus",
			hasPassword: true,
			provider: "GitHub",
		});
	});

	it("非 409 错误不触发弹窗", () => {
		const err = new ApiError({ error: "UNAUTHORIZED", message: "x", status: 401 });
		expect(openLinkConfirmFromError(err)).toBe(false);
		expect(useLinkConfirmStore.getState().payload).toBeNull();
	});

	it("409 但缺 link_token 的畸形响应不触发", () => {
		const err = new ApiError({
			error: "LINK_CONFIRMATION_REQUIRED",
			message: "x",
			status: 409,
			data: { email: "a***@x.com" },
		});
		expect(openLinkConfirmFromError(err)).toBe(false);
	});

	it("普通 Error 不触发", () => {
		expect(openLinkConfirmFromError(new Error("boom"))).toBe(false);
	});
});
