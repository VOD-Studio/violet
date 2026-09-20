import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useBrowserPushNotifications } from "../use-browser-push";

const subscription = {
	endpoint: "https://push.example/browser",
	toJSON: () => ({
		endpoint: "https://push.example/browser",
		keys: { p256dh: "key", auth: "auth" },
	}),
	unsubscribe: vi.fn(async () => true),
};

const setup = (
	api: { enabled?: boolean; publicKey?: string; save?: (input: unknown) => Promise<void> } = {},
) => {
	const save = api.save ?? vi.fn(async () => undefined);
	const remove = vi.fn(async () => undefined);
	const registration = {
		pushManager: {
			getSubscription: vi.fn(async () => subscription),
			subscribe: vi.fn(async () => subscription),
		},
	};
	vi.stubGlobal("Notification", { permission: "granted", requestPermission: vi.fn() });
	vi.stubGlobal("PushManager", class {});
	vi.stubGlobal("navigator", {
		serviceWorker: {
			getRegistration: vi.fn().mockResolvedValue(registration),
			register: vi.fn().mockResolvedValue(registration),
			ready: Promise.resolve(registration),
		},
	});
	const { result } = renderHook(() =>
		useBrowserPushNotifications({
			enabled: api.enabled ?? true,
			publicKey: api.publicKey ?? "AQID",
			save,
			remove,
		}),
	);
	return { result, save, remove };
};

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

it("订阅上报只带 endpoint 与密钥，不夹带其他通道的字段", async () => {
	const { result, save } = setup();
	await waitFor(() => expect(result.current.subscribed).toBe(true));
	await act(() => result.current.enable());
	expect(save).toHaveBeenCalledWith({
		endpoint: "https://push.example/browser",
		keys: { p256dh: "key", auth: "auth" },
	});
});

it("通道附加字段随 enable 一并上报", async () => {
	const save = vi.fn(async () => undefined);
	const { result } = setup({ save });
	await act(() => result.current.enable({ show_preview: true }));
	expect(save).toHaveBeenCalledWith(expect.objectContaining({ show_preview: true }));
});

it("站点未启用推送时不申请权限也不上报订阅", async () => {
	const { result, save } = setup({ enabled: false });
	await act(async () => {
		expect(await result.current.enable()).toBe(false);
	});
	expect(save).not.toHaveBeenCalled();
});

it("关闭通知时先注销服务端订阅再退订浏览器", async () => {
	const { result, remove } = setup();
	await waitFor(() => expect(result.current.subscribed).toBe(true));
	await act(() => result.current.disable());
	expect(remove).toHaveBeenCalledWith("https://push.example/browser");
	expect(subscription.unsubscribe).toHaveBeenCalledOnce();
});
