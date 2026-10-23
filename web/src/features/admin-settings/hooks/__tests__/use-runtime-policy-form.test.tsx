import type { RuntimePolicyView, UploadQueuePolicy } from "@entities/runtime-policy/model/types";
import { useRuntimePolicyForm } from "@features/admin-settings/hooks/use-runtime-policy-form";
import {
	changedPolicyFields,
	changedRateLimitFields,
} from "@features/admin-settings/lib/runtime-policy-changes";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@features/auth/hooks/usePermissions", () => ({ useHasPermission: () => true }));
vi.mock("@tanstack/react-router", () => ({ useBlocker: vi.fn() }));

const initial: RuntimePolicyView<UploadQueuePolicy> = {
	version: 4,
	values: { max_concurrent_files: 3 },
	defaults: { max_concurrent_files: 3 },
	sources: { max_concurrent_files: "application" },
	runtime: {
		version: 4,
		values: { max_concurrent_files: 3 },
		status: "applied",
		activation: "browser_scheduling",
		instance_id: "a",
		applied_at: "",
		last_checked_at: "",
	},
	presets: [
		{ id: "bulk", label: "批量", description: "提高并发", values: { max_concurrent_files: 6 } },
	],
};

describe("策略草稿", () => {
	it("预设不写服务端，手改标记自定义，后台刷新不覆盖草稿", async () => {
		const client = new QueryClient();
		const save = vi.fn().mockResolvedValue(initial);
		const wrapper = ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={client}>{children}</QueryClientProvider>
		);
		const { result } = renderHook(
			() =>
				useRuntimePolicyForm(
					useQuery({ queryKey: ["policy-test"], queryFn: async () => initial }),
					save,
					changedPolicyFields,
				),
			{ wrapper },
		);
		await waitFor(() => expect(result.current.draft).toEqual(initial.values));
		act(() => result.current.preset("bulk"));
		expect(result.current.draft).toEqual({ max_concurrent_files: 6 });
		expect(result.current.selection).toBe("bulk");
		expect(save).not.toHaveBeenCalled();
		act(() => result.current.change({ max_concurrent_files: 5 }));
		expect(result.current.selection).toBe("custom");
		act(() =>
			client.setQueryData(["policy-test"], {
				...initial,
				version: 5,
				values: { max_concurrent_files: 1 },
			}),
		);
		expect(result.current.draft).toEqual({ max_concurrent_files: 5 });
		expect(result.current.baseline?.version).toBe(4);
		client.clear();
	});

	it("保存、后台刷新、重载和恢复默认后按实际值重新匹配预设", async () => {
		const client = new QueryClient();
		let server: RuntimePolicyView<UploadQueuePolicy> = {
			...initial,
			presets: [
				...initial.presets,
				{
					id: "daily",
					label: "日常",
					description: "默认并发",
					values: { max_concurrent_files: 3 },
				},
			],
		};
		const save = vi.fn(async () => server);
		const wrapper = ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={client}>{children}</QueryClientProvider>
		);
		const { result, unmount } = renderHook(
			() =>
				useRuntimePolicyForm(
					useQuery({ queryKey: ["policy-selection"], queryFn: async () => server }),
					save,
					changedPolicyFields,
				),
			{ wrapper },
		);
		const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
		try {
			await waitFor(() => expect(result.current.selection).toBe("daily"));
			act(() => result.current.preset("bulk"));
			server = { ...server, version: 5, values: { max_concurrent_files: 6 } };
			await act(() => result.current.submit());
			expect(result.current.selection).toBe("bulk");
			expect(result.current.dirty).toBe(false);

			server = { ...server, version: 6, values: { max_concurrent_files: 1 } };
			act(() => client.setQueryData(["policy-selection"], server));
			await waitFor(() => expect(result.current.draft?.max_concurrent_files).toBe(1));
			expect(result.current.selection).toBe("custom");

			act(() => result.current.resetDefaults());
			expect(result.current.selection).toBe("defaults");
			server = { ...server, version: 7, values: { max_concurrent_files: 3 } };
			await act(() => result.current.submit());
			expect(result.current.selection).toBe("daily");
			expect(result.current.resetRequested).toBe(false);

			act(() => result.current.change({ max_concurrent_files: 2 }));
			server = { ...server, version: 8, values: { max_concurrent_files: 6 } };
			await act(() => result.current.reload());
			expect(result.current.selection).toBe("bulk");
			expect(result.current.draft?.max_concurrent_files).toBe(6);

			act(() => result.current.preset("daily"));
			server = { ...server, version: 9, values: { max_concurrent_files: 5 } };
			await act(() => result.current.submit());
			expect(result.current.selection).toBe("custom");
			expect(result.current.draft?.max_concurrent_files).toBe(5);
		} finally {
			confirm.mockRestore();
			unmount();
			client.clear();
		}
	});

	it("差异保留显式关闭、零和空数组，不携带未改动字段", () => {
		expect(
			changedPolicyFields(
				{ enabled: true, languages: ["python"], quota: 5, other: 8 },
				{ enabled: false, languages: [], quota: 0, other: 8 },
			),
		).toEqual({ enabled: false, languages: [], quota: 0 });
		const rule = {
			enabled: true,
			window_seconds: 60,
			max_requests: 10,
			burst_requests: 0,
			daily_quota: 0,
			failure_mode: "deny" as const,
		};
		expect(
			changedRateLimitFields(
				{ rules: { upload: rule, auth: rule } },
				{ rules: { upload: { ...rule, max_requests: 5 }, auth: rule } },
			),
		).toEqual({ rules: { upload: { max_requests: 5 } } });
	});
});
