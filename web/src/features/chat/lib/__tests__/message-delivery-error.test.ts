import { ApiError } from "@shared/api/error";
import { describe, expect, it } from "vitest";
import { messageDeliveryError } from "../message-delivery-error";

describe("messageDeliveryError", () => {
	it("超时不能声称服务端一定没有收到消息", () => {
		const error = new ApiError({
			error: "UNKNOWN",
			status: 0,
			message: "timeout of 15000ms exceeded",
		});
		expect(messageDeliveryError(error, false)).toBe("消息发送未确认：请求超时，请稍后重试");
	});

	it("复用公共网络异常分类，上传失败不声称消息已提交", () => {
		expect(messageDeliveryError(ApiError.network(), true)).toBe(
			"图片上传失败：网络连接异常，请检查连接后重试",
		);
	});

	it("保留明确的中文业务拒绝原因", () => {
		const error = new ApiError({ error: "FORBIDDEN", status: 403, message: "你已被禁言" });
		expect(messageDeliveryError(error, false)).toBe("消息发送失败：你已被禁言");
	});

	it.each([
		new Error("Cannot read properties of undefined"),
		new Error("请求失败\n at deliver (chat-outbox.ts:10)"),
		new ApiError({ error: "INTERNAL_ERROR", status: 500, message: "数据库连接失败" }),
		{ message: "未知内部异常" },
		undefined,
	])("未知异常和堆栈不泄漏技术细节", (error) => {
		expect(messageDeliveryError(error, false)).toBe(
			"消息发送未确认：暂时无法完成请求，请稍后重试",
		);
	});
});
