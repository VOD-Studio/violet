import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TweetData, TweetFetcher } from "../unstyled.js";
import { Tweet } from "../unstyled.js";

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((onResolve, onReject) => {
		resolve = onResolve;
		reject = onReject;
	});
	return { promise, resolve, reject };
}

function available(id: string, text: string): TweetData {
	return {
		id,
		url: `https://x.com/jack/status/${id}`,
		availability: "available",
		snapshot: {
			author: { name: "Jack", handle: "jack" },
			text,
		},
	};
}

afterEach(cleanup);

describe("异步请求身份与取消", () => {
	it("切换 ID 立即隐藏旧内容，取消旧信号且忽略不遵守取消的迟到响应", async () => {
		const first = deferred<TweetData>();
		const second = deferred<TweetData>();
		const third = deferred<TweetData>();
		const fetcher = vi
			.fn<TweetFetcher>()
			.mockReturnValueOnce(first.promise)
			.mockReturnValueOnce(second.promise)
			.mockReturnValueOnce(third.promise);
		const view = render(<Tweet id="20" fetcher={fetcher} messages={{ loading: "Pending" }} />);
		await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
		await act(async () => first.resolve(available("20", "First body")));
		expect(screen.getByText("First body")).toBeTruthy();
		view.rerender(<Tweet id="21" fetcher={fetcher} messages={{ loading: "Pending" }} />);
		expect(screen.queryByText("First body")).toBeNull();
		expect(screen.getByRole("status").textContent).toBe("Pending");
		expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
		await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
		view.rerender(<Tweet id="22" fetcher={fetcher} />);
		await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
		await act(async () => third.resolve(available("22", "Current body")));
		await act(async () => second.resolve(available("21", "Late body")));
		expect(screen.getByText("Current body")).toBeTruthy();
		expect(screen.queryByText("Late body")).toBeNull();
		expect(fetcher.mock.calls[1][1].signal.aborted).toBe(true);
	});

	it("相同 ID 更换加载器同样隔离旧结果，卸载取消当前请求", async () => {
		const first = deferred<TweetData>();
		const second = deferred<TweetData>();
		const one = vi.fn<TweetFetcher>().mockReturnValue(first.promise);
		const two = vi.fn<TweetFetcher>().mockReturnValue(second.promise);
		const view = render(<Tweet id="20" fetcher={one} />);
		await waitFor(() => expect(one).toHaveBeenCalledTimes(1));
		view.rerender(<Tweet id="20" fetcher={two} />);
		await waitFor(() => expect(two).toHaveBeenCalledTimes(1));
		expect(one.mock.calls[0][1].signal.aborted).toBe(true);
		await act(async () => first.resolve(available("20", "Obsolete source")));
		expect(screen.queryByText("Obsolete source")).toBeNull();
		view.unmount();
		expect(two.mock.calls[0][1].signal.aborted).toBe(true);
		await act(async () => second.resolve(available("20", "Unmounted body")));
		expect(screen.queryByText("Unmounted body")).toBeNull();
	});

	it("失败显示自定义消息并支持手动重试，重试不触发宿主点击", async () => {
		const fetcher = vi
			.fn<TweetFetcher>()
			.mockRejectedValueOnce(new Error("private upstream diagnostic"))
			.mockResolvedValueOnce(available("20", "Recovered"));
		const onClick = vi.fn();
		const ref = createRef<HTMLElement>();
		render(
			<Tweet
				id="20"
				fetcher={fetcher}
				onClick={onClick}
				ref={ref}
				aria-label="Remote article"
				data-consumer="yes"
				messages={{ error: "App error", retry: "Request again", source: "Original" }}
			/>,
		);
		expect(await screen.findByRole("button", { name: "Request again" })).toBeTruthy();
		expect(screen.getByRole("status").textContent).toBe("App error");
		expect(screen.queryByText("private upstream diagnostic")).toBeNull();
		expect(screen.getByRole("link", { name: "Original" }).getAttribute("href")).toBe(
			"https://x.com/i/web/status/20",
		);
		fireEvent.click(screen.getByRole("button", { name: "Request again" }));
		expect(await screen.findByText("Recovered")).toBeTruthy();
		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(onClick).not.toHaveBeenCalled();
		expect(ref.current).toBe(screen.getByRole("article", { name: "Remote article" }));
		expect(ref.current?.getAttribute("data-consumer")).toBe("yes");
	});

	it("同步抛错也进入错误状态，不泄露异常内容", async () => {
		const fetcher: TweetFetcher = () => {
			throw new Error("secret diagnostic");
		};
		render(<Tweet id="20" fetcher={fetcher} messages={{ retry: "Retry request" }} />);
		expect(await screen.findByRole("button", { name: "Retry request" })).toBeTruthy();
		expect(screen.queryByText("secret diagnostic")).toBeNull();
	});

	it.each([
		"private",
		"unavailable",
		"deleted",
	] as const)("明确 %s 结果不自动重抓也不提供网络失败重试", async (availability) => {
		const fetcher = vi
			.fn<TweetFetcher>()
			.mockResolvedValue({ id: "20", url: "https://x.com/jack/status/20", availability });
		const view = render(
			<Tweet id="20" fetcher={fetcher} messages={{ retry: "Retry request" }} />,
		);
		await waitFor(() =>
			expect(view.container.querySelector("article")?.getAttribute("data-state")).toBe(
				availability,
			),
		);
		expect(screen.queryByRole("button", { name: "Retry request" })).toBeNull();
		view.rerender(<Tweet id="20" fetcher={fetcher} className="consumer-change" />);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
});
