import type { UserDTO } from "@entities/user/model/types";
import { authKeys } from "@features/auth/api/keys";
import { useLogout } from "@features/auth/api/mutations";
import { useMe } from "@features/auth/api/queries";
import { httpClient } from "@shared/api/http";
import { useLoginDialogStore } from "@shared/api/login-dialog-store";
import { useSessionStore } from "@shared/api/session";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { usageKeys } from "../../api/usage-queries";
import type { UsageSummary } from "../../model/usage";
import { UsageSection } from "../UsageSection";

const user: UserDTO = {
	id: "usage-alice",
	username: "alice",
	display_name: "",
	email: "alice@example.com",
	avatar_url: "",
	cover_url: "",
	bio: "",
	role: "user",
	is_root: false,
	email_verified: true,
	is_active: true,
	created_at: "2026-01-01T00:00:00Z",
	has_password: true,
	google_bound: false,
	github_bound: false,
	permissions: [],
};
const summary: UsageSummary = {
	requests: 30,
	errors: 3,
	error_rate: 0.1,
	total_tokens: 12345,
	input_tokens: 4000,
	output_tokens: 2345,
	cache_read_tokens: 5000,
	cache_write_tokens: 1000,
	reasoning_tokens: 500,
	cache_rate: 0.5,
	api_cost_estimate: 1.25,
	avg_duration_ms: 1200,
	avg_ttft_ms: 200,
	avg_tokens_per_second: 42,
};
const originalAdapter = httpClient.defaults.adapter;
const originalRetry = httpClient.defaults["axios-retry"];
let qc: QueryClient;
let failedEndpoint: string | undefined;
let empty = false;
let requests: InternalAxiosRequestConfig[];
let pending: Promise<void> | undefined;

function SessionView() {
	const { data: me } = useMe();
	const logout = useLogout();
	return me ? (
		<>
			<button type="button" onClick={() => logout.mutate()}>
				退出账号
			</button>
			<UsageSection />
		</>
	) : (
		<p>已退出</p>
	);
}

beforeEach(() => {
	qc = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	qc.setQueryData(authKeys.me(), user);
	useSessionStore.setState({ sessionActive: true, sessionVersion: 1 });
	useLoginDialogStore.setState({ isOpen: false });
	failedEndpoint = undefined;
	empty = false;
	pending = undefined;
	requests = [];
	httpClient.defaults["axios-retry"] = { retries: 0 };
	httpClient.defaults.adapter = async (config) => {
		requests.push(config);
		if (config.url === failedEndpoint) {
			throw new AxiosError("服务暂时不可用", "ERR_BAD_RESPONSE", config, undefined, {
				data: { error: "INTERNAL_ERROR", message: "服务暂时不可用" },
				status: 503,
				statusText: "Service Unavailable",
				headers: {},
				config,
			});
		}
		if (pending && config.params?.range === "90d") await pending;
		const count = Number.parseInt(config.params?.range ?? "30d", 10);
		let data: unknown;
		switch (config.url) {
			case "/omp-usage/summary":
				data = { ...summary, requests: empty ? 0 : count };
				break;
			case "/omp-usage/models":
				data = {
					models: empty
						? []
						: [
								{
									...summary,
									provider: "test-provider",
									model: `model-${count}`,
									requests: count,
									cost: 1.25,
								},
							],
				};
				break;
			case "/omp-usage/timeseries":
				data = {
					bucket: "day",
					points: [
						{
							timestamp: "2026-10-23T00:00:00Z",
							requests: empty ? 0 : count,
							errors: 3,
							total_tokens: 12345,
							api_cost_estimate: 1.25,
						},
					],
				};
				break;
			case "/auth/logout":
				data = { message: "ok" };
				break;
			default:
				throw new Error(`Unexpected request: ${config.url}`);
		}
		return { data: { data }, status: 200, statusText: "OK", headers: {}, config };
	};
});

afterEach(() => {
	cleanup();
	qc.clear();
	httpClient.defaults.adapter = originalAdapter;
	httpClient.defaults["axios-retry"] = originalRetry;
	useSessionStore.setState({ sessionActive: false, sessionVersion: 0 });
	useLoginDialogStore.setState({ isOpen: false });
});

function renderUsage() {
	return render(
		<QueryClientProvider client={qc}>
			<SessionView />
		</QueryClientProvider>,
	);
}

describe("个人用量", () => {
	it("切换 7/30/90 天后显示对应模型，不把账号标识发送到聚合接口", async () => {
		renderUsage();
		await screen.findByText("model-30");
		for (const days of [7, 90, 30]) {
			fireEvent.click(screen.getByRole("button", { name: `近 ${days} 天` }));
			await screen.findByText(`model-${days}`);
			expect(
				screen.getByRole("button", { name: `近 ${days} 天` }).getAttribute("aria-pressed"),
			).toBe("true");
		}
		const usageRequests = requests.filter((request) => request.url?.startsWith("/omp-usage/"));
		for (const range of ["7d", "30d", "90d"]) {
			for (const endpoint of ["summary", "models", "timeseries"]) {
				expect(
					usageRequests.some(
						(request) =>
							request.url === `/omp-usage/${endpoint}` &&
							request.params.range === range,
					),
				).toBe(true);
			}
		}
		expect(
			usageRequests.every((request) =>
				Object.keys(request.params).every((key) => key === "range" || key === "bucket"),
			),
		).toBe(true);
	});

	it.each([
		"summary",
		"models",
		"timeseries",
	])("%s 失败显示重试而非空数据，恢复后展示统计", async (endpoint) => {
		failedEndpoint = `/omp-usage/${endpoint}`;
		renderUsage();
		expect(await screen.findByRole("alert")).not.toBeNull();
		expect(screen.queryByRole("button", { name: "刷新用量" })).toBeNull();
		failedEndpoint = undefined;
		fireEvent.click(screen.getByRole("button", { name: "重试" }));
		await screen.findByText("model-30");
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("空数据可以刷新恢复统计", async () => {
		empty = true;
		renderUsage();
		await screen.findByRole("button", { name: "刷新用量" });
		expect(screen.queryByRole("table")).toBeNull();
		empty = false;
		fireEvent.click(screen.getByRole("button", { name: "刷新用量" }));
		await screen.findByText("model-30");
	});

	it("实际登出移除全部档位私有缓存并取消在途响应，保留公开缓存", async () => {
		qc.setQueryData(["public-catalog"], ["public"]);
		renderUsage();
		await screen.findByText("model-30");
		fireEvent.click(screen.getByRole("button", { name: "近 7 天" }));
		await screen.findByText("model-7");
		const { promise, resolve: finish } = Promise.withResolvers<void>();
		pending = promise;
		fireEvent.click(screen.getByRole("button", { name: "近 90 天" }));
		await waitFor(() =>
			expect(requests.filter((request) => request.params?.range === "90d")).toHaveLength(3),
		);
		fireEvent.click(screen.getByRole("button", { name: "退出账号" }));
		await screen.findByText("已退出");
		expect(
			qc.getQueriesData({ queryKey: usageKeys.all }).some(([, data]) => data !== undefined),
		).toBe(false);
		expect(
			requests
				.filter((request) => request.params?.range === "90d")
				.every((request) => request.signal?.aborted),
		).toBe(true);
		await act(async () => {
			finish();
			await pending;
		});
		expect(
			qc.getQueriesData({ queryKey: usageKeys.all }).some(([, data]) => data !== undefined),
		).toBe(false);
		expect(qc.getQueryData(["public-catalog"])).toEqual(["public"]);
		expect(useSessionStore.getState().sessionActive).toBe(false);
	});

	it("未登录不发用量请求", async () => {
		qc.setQueryData(authKeys.me(), null);
		renderUsage();
		await screen.findByText("已退出");
		expect(requests).toEqual([]);
	});
});
