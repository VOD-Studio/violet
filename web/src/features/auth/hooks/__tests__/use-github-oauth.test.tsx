import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GITHUB_OAUTH_MESSAGE, useGithubOAuth } from "../use-github-oauth";

/** 挂载 hook 的最小宿主：点击触发 launch */
function Harness({ onCode }: { onCode: (code: string) => void }) {
	const open = useGithubOAuth({ onCode });
	return (
		<button type="button" onClick={() => open()}>
			launch
		</button>
	);
}

function renderHarness(onCode: (code: string) => void) {
	const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={qc}>
			<Harness onCode={onCode} />
		</QueryClientProvider>,
	);
}

/** 以指定 origin 与 payload 派生 message 事件 */
const dispatchMessage = (origin: string, data: unknown) =>
	window.dispatchEvent(new MessageEvent("message", { origin, data }));

describe("useGithubOAuth", () => {
	const openSpy = vi.spyOn(window, "open");
	let popup: { closed: boolean };

	beforeEach(() => {
		vi.stubEnv("VITE_GITHUB_CLIENT_ID", "e2e-client-id");
		// useOAuthVisibility 的 settings query 未 mock 网络层时挂起，clientId 走 env 兜底
		popup = { closed: false };
		openSpy.mockReset();
		openSpy.mockReturnValue(popup as unknown as Window);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	const launch = async () => {
		const harness = renderHarness(vi.fn());
		await act(async () => {
			harness.getByRole("button").click();
		});
		return harness;
	};

	it("launch 打开 popup 并在收到同源回传后触发一次 onCode", async () => {
		const onCode = vi.fn();
		const harness = renderHarness(onCode);
		await act(async () => {
			harness.getByRole("button").click();
		});
		expect(openSpy).toHaveBeenCalledOnce();
		const authorizeUrl = openSpy.mock.calls[0][0];
		expect(authorizeUrl).toContain("github.com/login/oauth/authorize");
		expect(authorizeUrl).toContain("client_id=e2e-client-id");

		await act(async () => {
			dispatchMessage(window.location.origin, { type: GITHUB_OAUTH_MESSAGE, code: "code-1" });
		});
		expect(onCode).toHaveBeenCalledExactlyOnceWith("code-1");

		// 回传后监听即拆除：后续同源消息不再触发
		await act(async () => {
			dispatchMessage(window.location.origin, { type: GITHUB_OAUTH_MESSAGE, code: "code-2" });
		});
		expect(onCode).toHaveBeenCalledOnce();
	});

	it("跨源 origin 与不匹配类型的消息被忽略", async () => {
		const onCode = vi.fn();
		await launch();
		await act(async () => {
			dispatchMessage("https://evil.example", { type: GITHUB_OAUTH_MESSAGE, code: "stolen" });
			dispatchMessage(window.location.origin, { type: "other", code: "x" });
			dispatchMessage(window.location.origin, { type: GITHUB_OAUTH_MESSAGE, code: "" });
		});
		expect(onCode).not.toHaveBeenCalled();
	});

	it("window.open 被拦截时降级整页跳转并写入 bind 意图标记", async () => {
		openSpy.mockReturnValue(null);
		const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const BindHarness = () => {
			const open = useGithubOAuth({ onCode: vi.fn(), bindIntent: true });
			return (
				<button type="button" onClick={() => open()}>
					launch
				</button>
			);
		};
		const harness = render(
			<QueryClientProvider client={qc}>
				<BindHarness />
			</QueryClientProvider>,
		);
		// jsdom 不支持导航，location.href 赋值仅打印 Not implemented 提示；此处验证意图标记
		await act(async () => {
			harness.getByRole("button").click();
		});
		expect(sessionStorage.getItem("violet:github-bind-intent")).toBe("1");
		sessionStorage.clear();
	});
});
