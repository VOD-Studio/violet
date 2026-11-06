import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { presenceKeys } from "../../api/keys";
import { PAUSED_MEDIA_TTL_MS, type PresenceReceipt } from "../../lib/presence";
import type { PresenceDevice } from "../../model/types";
import { useLivePresence } from "../use-live-presence";

const START = new Date("2026-10-28T12:00:10.000Z");

const pausedDevice = (): PresenceDevice => ({
	id: "mbp",
	display_name: "MacBook Pro",
	updated_at: "2026-10-28T12:00:00.000Z",
	expires_at: "2026-10-28T15:00:00.000Z",
	sources: {
		application: { display_name: "Zed" },
		window: null,
		media: {
			session_id: "s1",
			player_name: "QQ 音乐",
			title: "晴天",
			artist: "周杰伦",
			album: null,
			state: "paused",
			duration_ms: 269_000,
			position_ms: 102_000,
			rate: 0,
		},
	},
});

function setup() {
	const client = new QueryClient();
	const receipt: PresenceReceipt = {
		presence: { generated_at: START.toISOString(), devices: [pausedDevice()] },
		receivedAt: START.getTime(),
		pausedSince: { "mbp/s1": START.getTime() },
	};
	client.setQueryData(presenceKeys.current(), receipt);
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
	return { client, ...renderHook(() => useLivePresence(), { wrapper }) };
}

describe("useLivePresence 暂停超时", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(START);
	});
	afterEach(() => vi.useRealTimers());

	it("暂停期间保留媒体，满 5 分钟后即使没有新推送也自动收起，应用不受影响", () => {
		const { result } = setup();
		expect(result.current.lead?.sources.media?.title).toBe("晴天");

		act(() => void vi.advanceTimersByTime(PAUSED_MEDIA_TTL_MS - 1_000));
		expect(result.current.lead?.sources.media).not.toBeNull();

		act(() => void vi.advanceTimersByTime(2_000));
		expect(result.current.lead?.sources.media).toBeNull();
		expect(result.current.lead?.sources.application?.display_name).toBe("Zed");
	});

	it("页面被冻结很久后恢复，重连带来的新快照到达时，已超时的暂停媒体立即收起", () => {
		const { client, result } = setup();
		expect(result.current.lead?.sources.media).not.toBeNull();

		// 后台标签被冻结：时钟走了 10 分钟而定时器一个没触发
		const resumed = new Date(START.getTime() + 10 * 60_000);
		vi.setSystemTime(resumed);
		const fresh: PresenceReceipt = {
			presence: {
				generated_at: resumed.toISOString(),
				devices: [
					{
						...pausedDevice(),
						expires_at: new Date(resumed.getTime() + 45_000).toISOString(),
					},
				],
			},
			receivedAt: resumed.getTime(),
			pausedSince: { "mbp/s1": START.getTime() },
		};
		act(() => {
			client.setQueryData(presenceKeys.current(), fresh);
			// Query 的观察者通知排在 setTimeout(0) 上，只推进这一格，不触发被冻结的 5 分钟定时器
			vi.advanceTimersByTime(1);
		});

		expect(result.current.lead?.sources.media).toBeNull();
		expect(result.current.lead?.sources.application?.display_name).toBe("Zed");
	});
});
