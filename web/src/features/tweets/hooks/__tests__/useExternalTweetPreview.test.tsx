import { apiPost } from "@shared/api/request";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ExternalTweetPreview, useExternalTweetPreview } from "../useExternalTweetPreview";

vi.mock("@shared/api/request", () => ({ apiPost: vi.fn() }));

function result(id: string): ExternalTweetPreview {
	return {
		external_tweet: {
			id,
			source_id: id,
			canonical_url: `https://x.com/jack/status/${id}`,
			snapshot_version: "v1",
			availability: "available",
			snapshot: {
				author: {
					id: "12",
					name: "Jack",
					handle: "jack",
					url: "https://x.com/jack",
					avatar_url: "",
				},
				text: id,
				segments: null,
				published_at: "2026-01-01T00:00:00Z",
				completeness: "complete",
				media: null,
				warnings: null,
			},
		},
		preview_token: "a".repeat(64),
		expires_at: new Date(Date.now() + 5000).toISOString(),
		can_publish: true,
		warnings: [],
	};
}

beforeEach(() => {
	vi.mocked(apiPost).mockReset();
});
afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe("useExternalTweetPreview", () => {
	it("新链接结果优先，忽略取消失败而迟到的旧响应", async () => {
		let first!: (value: ExternalTweetPreview) => void;
		let second!: (value: ExternalTweetPreview) => void;
		vi.mocked(apiPost)
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						first = resolve;
					}),
			)
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						second = resolve;
					}),
			);
		const hook = renderHook(useExternalTweetPreview);
		act(() => hook.result.current.setUrl("https://x.com/jack/status/20"));
		let work1!: Promise<void>;
		act(() => {
			work1 = hook.result.current.load();
		});
		const oldSignal = vi.mocked(apiPost).mock.calls[0][2]?.signal;
		act(() => hook.result.current.setUrl("https://x.com/jack/status/21"));
		expect(oldSignal?.aborted).toBe(true);
		let work2!: Promise<void>;
		act(() => {
			work2 = hook.result.current.load();
		});
		await act(async () => {
			second(result("21"));
			await work2;
		});
		await act(async () => {
			first(result("20"));
			await work1;
		});
		expect(hook.result.current.preview?.external_tweet.source_id).toBe("21");
		expect(hook.result.current.loading).toBe(false);
	});

	it("取消后不接受迟到结果，卸载时中止请求", async () => {
		let resolve!: (value: ExternalTweetPreview) => void;
		vi.mocked(apiPost).mockImplementation(
			() =>
				new Promise((done) => {
					resolve = done;
				}),
		);
		const hook = renderHook(useExternalTweetPreview);
		act(() => hook.result.current.setUrl("https://x.com/jack/status/20"));
		let work!: Promise<void>;
		act(() => {
			work = hook.result.current.load();
		});
		act(() => hook.result.current.reset());
		await act(async () => {
			resolve(result("20"));
			await work;
		});
		expect(hook.result.current.preview).toBeNull();
		expect(hook.result.current.url).toBe("");
		act(() => hook.result.current.setUrl("https://x.com/jack/status/21"));
		act(() => {
			void hook.result.current.load();
		});
		const signal = vi.mocked(apiPost).mock.calls[1][2]?.signal;
		hook.unmount();
		expect(signal?.aborted).toBe(true);
	});

	it("凭证按返回时效过期，错误可重试且不签发空预览", async () => {
		vi.useFakeTimers();
		vi.mocked(apiPost)
			.mockRejectedValueOnce(new Error("媒体准备失败"))
			.mockResolvedValueOnce(result("20"));
		const hook = renderHook(useExternalTweetPreview);
		act(() => hook.result.current.setUrl("https://x.com/jack/status/20"));
		await act(() => hook.result.current.load());
		expect(hook.result.current.error).toBe("媒体准备失败");
		expect(hook.result.current.preview).toBeNull();
		await act(() => hook.result.current.load());
		act(() => vi.advanceTimersByTime(5001));
		expect(hook.result.current.expired).toBe(true);
	});
});
