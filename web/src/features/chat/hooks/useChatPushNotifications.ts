import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
	useChatPushConfig,
	useDeleteChatPushSubscription,
	useSaveChatPushSubscription,
} from "../api/queries";

/** 管理聊天设置中的浏览器 Web Push 授权、订阅和取消订阅。 */
export function useChatPushNotifications() {
	const { data: config } = useChatPushConfig();
	const save = useSaveChatPushSubscription();
	const remove = useDeleteChatPushSubscription();
	const [busy, setBusy] = useState(false);
	const supported =
		typeof window !== "undefined" &&
		"Notification" in window &&
		"serviceWorker" in navigator &&
		"PushManager" in window;
	const enable = useCallback(
		async (showPreview: boolean) => {
			if (!supported || !config?.enabled || !config.public_key) {
				toast.error("当前环境未配置浏览器通知");
				return false;
			}
			setBusy(true);
			try {
				const permission =
					Notification.permission === "default"
						? await Notification.requestPermission()
						: Notification.permission;
				if (permission !== "granted") {
					toast.info("浏览器通知权限未开启");
					return false;
				}
				const registration = await navigator.serviceWorker.register("/chat-sw.js");
				const existing = await registration.pushManager.getSubscription();
				const subscription =
					existing ??
					(await registration.pushManager.subscribe({
						userVisibleOnly: true,
						applicationServerKey: decodeKey(config.public_key),
					}));
				const json = subscription.toJSON();
				if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth)
					throw new Error("推送订阅数据不完整");
				await save.mutateAsync({
					endpoint: json.endpoint,
					keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
					show_preview: showPreview,
				});
				toast.success("浏览器通知已启用");
				return true;
			} catch {
				toast.error("浏览器通知启用失败");
				return false;
			} finally {
				setBusy(false);
			}
		},
		[config, save, supported],
	);
	const disable = useCallback(async () => {
		if (!supported) return;
		setBusy(true);
		try {
			const registration = await navigator.serviceWorker.getRegistration("/");
			const subscription = await registration?.pushManager.getSubscription();
			if (subscription) {
				await remove.mutateAsync(subscription.endpoint);
				await subscription.unsubscribe();
			}
			toast.success("浏览器通知已关闭");
		} catch {
			toast.error("浏览器通知关闭失败");
		} finally {
			setBusy(false);
		}
	}, [remove, supported]);
	const updatePreview = useCallback(
		async (showPreview: boolean) => {
			if (!supported || !config?.enabled || Notification.permission !== "granted") return;
			const registration = await navigator.serviceWorker.getRegistration("/");
			const subscription = await registration?.pushManager.getSubscription();
			const json = subscription?.toJSON();
			if (!json?.endpoint || !json.keys?.p256dh || !json.keys.auth) return;
			await save.mutateAsync({
				endpoint: json.endpoint,
				keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
				show_preview: showPreview,
			});
		},
		[config, save, supported],
	);
	return {
		enabled: config?.enabled ?? false,
		supported,
		permission:
			typeof window === "undefined" || !("Notification" in window)
				? "unsupported"
				: Notification.permission,
		busy,
		enable,
		disable,
		updatePreview,
	};
}

function decodeKey(value: string) {
	const padding = "=".repeat((4 - (value.length % 4)) % 4);
	const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
	const raw = window.atob(base64);
	return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}
