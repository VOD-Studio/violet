import type { QueryClient } from "@tanstack/react-query";
import { settingsKeys } from "./keys";

const EVENT = "violet:settings-changed";

async function refreshPublicSettings(queryClient: QueryClient) {
	const filter = { queryKey: settingsKeys.public() };
	await queryClient.cancelQueries(filter);
	await queryClient.invalidateQueries(filter);
}

/** 通知当前页面与其他已打开页面刷新公开配置；消息不携带设置或凭据。 */
export function notifySettingsChanged(queryClient: QueryClient) {
	void refreshPublicSettings(queryClient);
	if (typeof window === "undefined") return;
	window.dispatchEvent(new Event(EVENT));
	if (typeof BroadcastChannel !== "undefined") {
		const channel = new BroadcastChannel(EVENT);
		channel.postMessage(EVENT);
		channel.close();
	}
}

/** 在应用装配层订阅设置变更，并由调用方失效额外的页面资源。 */
export function subscribeSettingsChanges(queryClient: QueryClient, onChange: () => void) {
	const invalidate = () => {
		void refreshPublicSettings(queryClient);
		onChange();
	};
	window.addEventListener(EVENT, onChange);
	const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(EVENT);
	if (channel)
		channel.onmessage = (event) => {
			if (event.data === EVENT) invalidate();
		};
	return () => {
		window.removeEventListener(EVENT, onChange);
		channel?.close();
	};
}
