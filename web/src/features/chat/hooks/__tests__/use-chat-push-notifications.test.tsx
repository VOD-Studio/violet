import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useChatPushNotifications } from "../useChatPushNotifications";

const { save, remove } = vi.hoisted(() => ({ save: vi.fn(), remove: vi.fn() }));
vi.mock("../../api/queries", () => ({
	useChatPushConfig: () => ({ data: { enabled: true, public_key: "AQID" } }),
	useSaveChatPushSubscription: () => ({ mutateAsync: save }),
	useDeleteChatPushSubscription: () => ({ mutateAsync: remove }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

it("已有通知权限时，关闭订阅后仍可重新启用", async () => {
	let active = true;
	const subscription = {
		endpoint: "https://push.example/subscription",
		toJSON: () => ({
			endpoint: "https://push.example/subscription",
			keys: { p256dh: "key", auth: "auth" },
		}),
		unsubscribe: vi.fn(async () => {
			active = false;
			return true;
		}),
	};
	const registration = {
		pushManager: {
			getSubscription: vi.fn(async () => (active ? subscription : null)),
			subscribe: vi.fn(async () => {
				active = true;
				return subscription;
			}),
		},
	};
	vi.stubGlobal("Notification", { permission: "granted" });
	vi.stubGlobal("PushManager", class {});
	vi.stubGlobal("navigator", {
		serviceWorker: {
			getRegistration: vi.fn().mockResolvedValue(registration),
			register: vi.fn().mockResolvedValue(registration),
			ready: Promise.resolve(registration),
		},
	});
	const { result } = renderHook(useChatPushNotifications);
	await waitFor(() => expect(result.current.subscribed).toBe(true));
	await act(() => result.current.disable());
	expect(result.current.subscribed).toBe(false);
	expect(Notification.permission).toBe("granted");
	await act(() => result.current.enable(false));
	expect(result.current.subscribed).toBe(true);
	expect(registration.pushManager.subscribe).toHaveBeenCalledOnce();
	expect(save).toHaveBeenCalledOnce();
});
