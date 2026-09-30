import { webcrypto } from "node:crypto";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useBrowserPushNotifications } from "../use-browser-push";

const endpoint = "https://push.example/browser";
const setup = (registered = true) => {
	let active = true;
	const channels = { chat: registered, bell: true };
	const subscription = {
		endpoint,
		toJSON: () => ({ endpoint, keys: { p256dh: "key", auth: "auth" } }),
		unsubscribe: vi.fn(async () => {
			active = false;
			return true;
		}),
	};
	const registration = {
		active: { scriptURL: "https://example.test/chat-sw.js" },
		pushManager: {
			getSubscription: vi.fn(async () => (active ? subscription : null)),
			subscribe: vi.fn(async () => subscription),
		},
	};
	const register = vi.fn(async () => registration);
	vi.stubGlobal("crypto", webcrypto);
	vi.stubGlobal("Notification", { permission: "granted", requestPermission: vi.fn() });
	vi.stubGlobal("PushManager", class {});
	vi.stubGlobal("navigator", {
		serviceWorker: {
			getRegistration: vi.fn(async () => registration),
			register,
			ready: Promise.resolve(registration),
		},
	});
	const api = (channel: keyof typeof channels) => ({
		enabled: true,
		publicKey: "AQID",
		check: vi.fn(async () => ({ subscribed: channels[channel] })),
		save: vi.fn(async () => {
			channels[channel] = true;
		}),
		remove: vi.fn(async () => {
			channels[channel] = false;
		}),
	});
	const chat = api("chat");
	const bell = api("bell");
	return { chat, bell, subscription, registration, register, channels };
};

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

it("浏览器已有铃铛订阅时，未登记的聊天通道仍显示关闭", async () => {
	const { chat } = setup(false);
	const { result } = renderHook(() => useBrowserPushNotifications(chat));
	await waitFor(() => expect(result.current.busy).toBe(false));
	expect(result.current.subscribed).toBe(false);
	expect(chat.check).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f]{64}$/));
	expect(chat.save).not.toHaveBeenCalled();
});

it("关闭铃铛后聊天仍可收到推送，重新挂载也不恢复铃铛授权", async () => {
	const { chat, bell, subscription, registration } = setup();
	const chatHook = renderHook(() => useBrowserPushNotifications(chat));
	const bellHook = renderHook(() => useBrowserPushNotifications(bell));
	await waitFor(() => expect(bellHook.result.current.subscribed).toBe(true));
	await act(() => bellHook.result.current.disable());
	expect(subscription.unsubscribe).not.toHaveBeenCalled();
	expect(await registration.pushManager.getSubscription()).toBe(subscription);
	expect(chatHook.result.current.subscribed).toBe(true);
	expect(bell.remove).toHaveBeenCalledWith(endpoint);
	bellHook.unmount();
	const reopened = renderHook(() => useBrowserPushNotifications(bell));
	await waitFor(() => expect(reopened.result.current.busy).toBe(false));
	expect(reopened.result.current.subscribed).toBe(false);
});

it("已授权用户自动注册新版 Worker，不重复订阅或改写通道授权", async () => {
	const { chat, register, registration } = setup();
	const { result } = renderHook(() => useBrowserPushNotifications(chat));
	await waitFor(() => expect(result.current.busy).toBe(false));
	expect(register).toHaveBeenCalledWith("/push-sw.js", { updateViaCache: "none" });
	expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
	expect(chat.save).not.toHaveBeenCalled();
});

it("启用时上报订阅及通道附加字段", async () => {
	const { chat } = setup(false);
	const { result } = renderHook(() => useBrowserPushNotifications(chat));
	await waitFor(() => expect(result.current.busy).toBe(false));
	await act(() => result.current.enable({ show_preview: true }));
	expect(chat.save).toHaveBeenCalledWith({
		endpoint,
		keys: { p256dh: "key", auth: "auth" },
		show_preview: true,
	});
	expect(result.current.subscribed).toBe(true);
});

it("未授权时不弹权限窗口，也不自动登记任何通道", async () => {
	const { chat, register } = setup();
	vi.stubGlobal("Notification", { permission: "default", requestPermission: vi.fn() });
	const { result } = renderHook(() => useBrowserPushNotifications(chat));
	await waitFor(() => expect(result.current.busy).toBe(false));
	expect(result.current.subscribed).toBe(false);
	expect(register).not.toHaveBeenCalled();
	expect(Notification.requestPermission).not.toHaveBeenCalled();
	expect(chat.save).not.toHaveBeenCalled();
});

it("站点未启用推送时不上报订阅", async () => {
	const { chat } = setup();
	const api = { ...chat, enabled: false };
	const { result } = renderHook(() => useBrowserPushNotifications(api));
	await act(async () => {
		expect(await result.current.enable()).toBe(false);
	});
	expect(chat.save).not.toHaveBeenCalled();
});

it("暂时更新不了 Worker 时仍核对已有订阅", async () => {
	const { chat, register } = setup();
	register.mockRejectedValue(new Error("offline"));
	const { result } = renderHook(() => useBrowserPushNotifications(chat));
	await waitFor(() => expect(result.current.subscribed).toBe(true));
});

it("更改预览设置不会暗中开启未授权的聊天通道", async () => {
	const { chat } = setup(false);
	const { result } = renderHook(() => useBrowserPushNotifications(chat));
	await waitFor(() => expect(result.current.busy).toBe(false));
	await act(() => result.current.update({ show_preview: true }));
	expect(chat.save).not.toHaveBeenCalled();
});

it("关闭通知后，迟到的状态查询不会把开关改回开启", async () => {
	const { chat } = setup();
	const { result } = renderHook(() => useBrowserPushNotifications(chat));
	await waitFor(() => expect(result.current.subscribed).toBe(true));
	let finish: (value: { subscribed: boolean }) => void = () => undefined;
	chat.check.mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finish = resolve;
			}),
	);
	act(() => window.dispatchEvent(new Event("focus")));
	await waitFor(() => expect(chat.check).toHaveBeenCalledTimes(2));
	await act(() => result.current.disable());
	await act(async () => finish({ subscribed: true }));
	expect(result.current.subscribed).toBe(false);
});
