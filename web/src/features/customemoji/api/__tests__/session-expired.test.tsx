/// <reference lib="es2024.promise" />
import "@features/auth/api/queries";
import { useMyCustomEmojis } from "@features/customemoji/api/queries";
import { httpClient } from "@shared/api/http";
import { useLoginDialogStore } from "@shared/api/login-dialog-store";
import { clientQueryClient } from "@shared/api/query-client";
import { useSessionStore } from "@shared/api/session";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";
import type { ReactNode } from "react";
import { afterEach, expect, it } from "vitest";

const originalAdapter = httpClient.defaults.adapter;

afterEach(() => {
	cleanup();
	clientQueryClient.clear();
	httpClient.defaults.adapter = originalAdapter;
	useSessionStore.setState({ sessionActive: false, sessionVersion: 0 });
	useLoginDialogStore.setState({ isOpen: false });
});

it("挂载中的个人表情收到401后暂停请求，原地重登后恢复读取", async () => {
	clientQueryClient.clear();
	useSessionStore.setState({ sessionActive: true, sessionVersion: 1 });
	useLoginDialogStore.setState({ isOpen: false });
	let requests = 0;
	let expired = true;
	const { promise: pendingResponse, resolve } = Promise.withResolvers<AxiosResponse>();
	httpClient.defaults.adapter = async (config) => {
		requests += 1;
		if (expired) {
			// 保留第四次响应，以便断言重复请求而不让失效循环占满事件队列。
			if (requests >= 4) return pendingResponse;
			throw new AxiosError("会话失效", "ERR_BAD_REQUEST", config, undefined, {
				data: { error: "UNAUTHORIZED", message: "会话失效" },
				status: 401,
				statusText: "Unauthorized",
				headers: {},
				config,
			});
		}
		return {
			data: {
				data: {
					owned: [{ id: "current", name: "当前账号收藏", url: "/current.gif" }],
					favorited: [],
				},
			},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	};
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={clientQueryClient}>{children}</QueryClientProvider>
	);
	const query = renderHook(
		() => {
			const mine = useMyCustomEmojis(true);
			return { data: mine.data, isLoading: mine.isLoading };
		},
		{ wrapper },
	);
	await waitFor(() => expect(useLoginDialogStore.getState().isOpen).toBe(true));
	await act(async () => {
		const { promise, resolve: finishFrame } = Promise.withResolvers<void>();
		setTimeout(finishFrame, 20);
		await promise;
	});
	try {
		expect(requests).toBe(1);
		expect(query.result.current.data).toBeUndefined();
		expect(useSessionStore.getState().sessionActive).toBe(true);
		expired = false;
		act(() => useLoginDialogStore.getState().close());
		await waitFor(() => expect(query.result.current.data?.owned[0]?.name).toBe("当前账号收藏"));
		expect(requests).toBe(2);
	} finally {
		query.unmount();
		clientQueryClient.clear();
		resolve({
			data: { data: { owned: [], favorited: [] } },
			status: 200,
			statusText: "OK",
			headers: {},
			config: { headers: new AxiosHeaders() },
		});
	}
});
