import { httpClient } from "@shared/api/http";
import { useSessionStore } from "@shared/api/session";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { adminSeriesKeys } from "../keys";
import { useReorderChapters, useReorderSections } from "../mutations";

interface SaveState {
	pending: boolean;
	save: () => Promise<unknown>;
}

function useSaveSections(): SaveState {
	const mutation = useReorderSections("book");
	return {
		pending: mutation.isPending,
		save: () => mutation.mutateAsync(["section-b", "section-a"]),
	};
}

function useSaveChapters(): SaveState {
	const mutation = useReorderChapters("book");
	return {
		pending: mutation.isPending,
		save: () =>
			mutation.mutateAsync([{ section_id: "", ordered_post_ids: ["post-b", "post-a"] }]),
	};
}

const originalAdapter = httpClient.defaults.adapter;
let queryClient: QueryClient;

beforeEach(() => {
	queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	useSessionStore.setState({ sessionActive: true, sessionVersion: 1 });
	httpClient.defaults.adapter = async (config) => ({
		data: { data: null },
		status: 200,
		statusText: "OK",
		headers: {},
		config,
	});
});

afterEach(() => {
	cleanup();
	queryClient.clear();
	httpClient.defaults.adapter = originalAdapter;
	useSessionStore.setState({ sessionActive: false, sessionVersion: 0 });
});

it.each([
	["卷", useSaveSections],
	["章节", useSaveChapters],
] as const)("%s保存成功后仍待列表和详情回填，不提前结束 pending", async (_label, useSave) => {
	const listRefresh = Promise.withResolvers<number>();
	const detailRefresh = Promise.withResolvers<number>();
	const wrapper = ({ children }: PropsWithChildren) => (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
	const { result } = renderHook(
		() => {
			useQuery({
				queryKey: adminSeriesKeys.lists(),
				queryFn: () => listRefresh.promise,
				initialData: 0,
				staleTime: Number.POSITIVE_INFINITY,
			});
			useQuery({
				queryKey: adminSeriesKeys.detail("book"),
				queryFn: () => detailRefresh.promise,
				initialData: 0,
				staleTime: Number.POSITIVE_INFINITY,
			});
			return useSave();
		},
		{ wrapper },
	);
	let finished = false;
	let saved: Promise<unknown>;
	act(() => {
		saved = result.current.save().then(() => {
			finished = true;
		});
	});
	await waitFor(() => expect(result.current.pending).toBe(true));
	await waitFor(() => {
		expect(queryClient.getQueryState(adminSeriesKeys.detail("book"))?.fetchStatus).toBe(
			"fetching",
		);
	});
	expect(finished).toBe(false);
	await act(async () => {
		detailRefresh.resolve(1);
		await detailRefresh.promise;
	});
	expect(result.current.pending).toBe(true);
	expect(finished).toBe(false);
	await act(async () => {
		listRefresh.resolve(1);
		await saved;
	});
	await waitFor(() => expect(result.current.pending).toBe(false));
	expect(finished).toBe(true);
});
