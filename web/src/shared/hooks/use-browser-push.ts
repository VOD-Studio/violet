/**
 * 浏览器 Web Push 授权的通用流程：权限申请 → service worker 注册 → 订阅上报。
 *
 * @remarks 一个浏览器作用域只能注册一个 service worker，聊天与站内通知共用
 * `/push-sw.js`，各自的订阅表在服务端互相独立，因此授权开关也是两次独立决定。
 */

import { useSessionStore } from "@shared/api/session";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/** 上报服务端的浏览器订阅数据。 */
export interface BrowserPushSubscriptionPayload {
	endpoint: string;
	keys: { p256dh: string; auth: string };
}

export interface BrowserPushApi<TExtra extends object> {
	/** 站点是否启用推送（VAPID 公钥与后端密钥都就位）。 */
	enabled: boolean;
	publicKey: string;
	check: (endpointHash: string) => Promise<{ subscribed: boolean }>;
	save: (input: BrowserPushSubscriptionPayload & TExtra) => Promise<unknown>;
	remove: (endpoint: string) => Promise<unknown>;
}

/** 各通知通道自己的订阅附加字段，例如聊天的 show_preview。 */
type SubscriptionExtra = Record<string, unknown>;

/**
 * 管理一类通知通道的浏览器推送订阅。
 *
 * @typeParam TExtra - 该通道订阅记录的附加字段，随 enable/update 一并上报
 * @param api - 通道自身的配置查询与订阅增删 mutation
 */
export function useBrowserPushNotifications<
	TExtra extends SubscriptionExtra = Record<never, never>,
>(api: BrowserPushApi<TExtra>) {
	const { enabled, publicKey, check, save, remove } = api;
	const sessionVersion = useSessionStore((state) => state.sessionVersion);
	const revision = useRef(0);
	const [busy, setBusy] = useState(false);
	const [subscribed, setSubscribed] = useState<boolean | null>(null);
	const supported =
		typeof window !== "undefined" &&
		"Notification" in window &&
		"serviceWorker" in navigator &&
		"PushManager" in window;

	useEffect(() => {
		let cancelled = false;
		setSubscribed(null);
		const refresh = async () => {
			const current = ++revision.current;
			let registered = false;
			try {
				if (supported && enabled && Notification.permission === "granted") {
					const existing = await navigator.serviceWorker.getRegistration("/");
					if (existing) {
						const registration = await registerPushWorker().catch(() => existing);
						const subscription = await registration.pushManager.getSubscription();
						if (subscription) {
							const hash = await hashEndpoint(subscription.endpoint);
							registered = (await check(hash)).subscribed === true;
						}
					}
				}
			} catch {
				registered = false;
			}
			if (
				!cancelled &&
				current === revision.current &&
				sessionVersion === useSessionStore.getState().sessionVersion
			)
				setSubscribed(registered);
		};
		void refresh();
		window.addEventListener("focus", refresh);
		window.addEventListener("online", refresh);
		window.addEventListener("browser-push-changed", refresh);
		return () => {
			cancelled = true;
			window.removeEventListener("focus", refresh);
			window.removeEventListener("online", refresh);
			window.removeEventListener("browser-push-changed", refresh);
		};
	}, [check, enabled, supported, sessionVersion]);

	/** 取回当前浏览器的订阅；没有则按 VAPID 公钥新建。未授权时返回 null。 */
	const ensureSubscription = useCallback(async () => {
		const permission =
			Notification.permission === "default"
				? await Notification.requestPermission()
				: Notification.permission;
		if (permission !== "granted") {
			toast.info("浏览器通知权限未开启");
			return null;
		}
		await registerPushWorker();
		const registration = await navigator.serviceWorker.ready;
		const existing = await registration.pushManager.getSubscription();
		return (
			existing ??
			(await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: decodePushKey(publicKey),
			}))
		);
	}, [publicKey]);

	const enable = useCallback(
		async (extra?: TExtra) => {
			if (!supported || !enabled || !publicKey) {
				toast.error("当前环境未配置浏览器通知");
				return false;
			}
			revision.current++;
			setBusy(true);
			try {
				const subscription = await ensureSubscription();
				if (!subscription) return false;
				await saveSubscription(save, subscription, extra);
				setSubscribed(true);
				window.dispatchEvent(new Event("browser-push-changed"));
				toast.success("浏览器通知已启用");
				return true;
			} catch {
				toast.error("浏览器通知启用失败");
				return false;
			} finally {
				setBusy(false);
			}
		},
		[enabled, ensureSubscription, publicKey, save, supported],
	);

	const disable = useCallback(async () => {
		if (!supported) return;
		revision.current++;
		setBusy(true);
		try {
			const subscription = await getPushSubscription();
			if (subscription) {
				await remove(subscription.endpoint);
			}
			setSubscribed(false);
			window.dispatchEvent(new Event("browser-push-changed"));
			toast.success("浏览器通知已关闭");
		} catch {
			toast.error("浏览器通知关闭失败");
		} finally {
			setBusy(false);
		}
	}, [remove, supported]);

	/** 订阅已存在时改写附加字段（不重新申请权限）。 */
	const update = useCallback(
		async (extra?: TExtra) => {
			if (!supported || !enabled || !subscribed) return;
			const subscription = await getPushSubscription();
			if (!subscription) return;
			await saveSubscription(save, subscription, extra);
		},
		[enabled, save, subscribed, supported],
	);

	return {
		enabled,
		supported,
		subscribed: subscribed === true,
		permission:
			typeof window === "undefined" || !("Notification" in window)
				? "unsupported"
				: Notification.permission,
		busy: busy || (supported && subscribed === null),
		enable,
		disable,
		update,
	};
}

async function saveSubscription<TExtra extends SubscriptionExtra>(
	save: (input: BrowserPushSubscriptionPayload & TExtra) => Promise<unknown>,
	subscription: PushSubscription,
	extra?: TExtra,
) {
	const json = subscription.toJSON();
	if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
		throw new Error("推送订阅数据不完整");
	}
	await save({
		endpoint: json.endpoint,
		keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
		...extra,
	} as BrowserPushSubscriptionPayload & TExtra);
}

/** 已注册 service worker 上的推送订阅；未注册或无订阅返回 null。 */
async function getPushSubscription(): Promise<PushSubscription | null> {
	const registration = await navigator.serviceWorker.getRegistration("/");
	return (await registration?.pushManager.getSubscription()) ?? null;
}

function decodePushKey(value: string) {
	const padding = "=".repeat((4 - (value.length % 4)) % 4);
	const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
	const raw = window.atob(base64);
	return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function registerPushWorker() {
	return navigator.serviceWorker.register("/push-sw.js", { updateViaCache: "none" });
}

async function hashEndpoint(endpoint: string) {
	const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
	return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
