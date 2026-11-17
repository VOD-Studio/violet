import { ApiError } from "@shared/api/error";

/** 将发送与上传异常转为可展示的原因，不暴露技术异常或堆栈。 */
export function messageDeliveryError(error: unknown, uploading: boolean): string {
	const prefix = uploading ? "图片上传失败" : "消息发送未确认";
	const message = error instanceof Error ? error.message.trim() : "";
	if (/\btimeout\b|\btimed out\b|超时/i.test(message)) {
		return `${prefix}：请求超时，请稍后重试`;
	}
	if (
		(error instanceof ApiError && error.code === "NETWORK_ERROR") ||
		/^(?:Network Error|Failed to fetch|Load failed|offline)$/i.test(message)
	) {
		return `${prefix}：网络连接异常，请检查连接后重试`;
	}
	if (
		/[\u3400-\u9fff]/u.test(message) &&
		message.length <= 200 &&
		!/[\r\n]|\b(?:Error|Exception|stack|SQLSTATE|SELECT|INSERT|UPDATE)\b/i.test(message) &&
		(!(error instanceof ApiError) || (error.status >= 400 && error.status < 500))
	) {
		return `${uploading ? "图片上传失败" : "消息发送失败"}：${message}`;
	}
	return `${prefix}：暂时无法完成请求，请稍后重试`;
}
