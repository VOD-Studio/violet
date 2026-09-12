import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { SettingsSnapshot, SettingsUpdate } from "../../model/types";
import { useSettingsForm } from "../use-settings-form";

vi.mock("@features/auth/hooks/usePermissions", () => ({ useHasPermission: () => true }));
vi.mock("@tanstack/react-router", () => ({ useBlocker: () => undefined }));

afterEach(cleanup);

type Values = { site_name: string; posts_per_page: number };

it("首次注册不阻止加载，后续刷新保留未保存输入", async () => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	let complete!: (snapshot: SettingsSnapshot<Values>) => void;
	const loading = new Promise<SettingsSnapshot<Values>>((resolve) => {
		complete = resolve;
	});
	const initial: SettingsSnapshot<Values> = {
		values: { site_name: "服务器初始名称", posts_per_page: 10 },
		meta: {
			saved_version: 2,
			applied_version: 2,
			effect: "new_request",
			status: "applied",
			sources: { site_name: "database" },
		},
	};
	function Form() {
		const query = useQuery({ queryKey: ["settings", "general"], queryFn: () => loading });
		const mutation = useMutation({
			mutationFn: async (_input: SettingsUpdate<Values>) => initial,
		});
		const { register, page } = useSettingsForm(query, mutation, (values) => values, {
			group: "general",
		});
		const registration = register("site_name");
		const numberRegistration = register("posts_per_page", { valueAsNumber: true });
		return page.isLoading ? (
			<p>加载中</p>
		) : (
			<>
				<input aria-label="站点名称" {...registration} />
				<input type="number" aria-label="每页数量" {...numberRegistration} />
			</>
		);
	}
	try {
		const view = render(
			<QueryClientProvider client={client}>
				<Form />
			</QueryClientProvider>,
		);
		view.rerender(
			<QueryClientProvider client={client}>
				<Form />
			</QueryClientProvider>,
		);
		await act(async () => {
			complete(initial);
			await loading;
		});
		const input = await screen.findByRole("textbox", { name: "站点名称" });
		expect((input as HTMLInputElement).value).toBe("服务器初始名称");
		fireEvent.change(input, { target: { value: "尚未保存的输入" } });
		await act(async () => {
			client.setQueryData(["settings", "general"], {
				...initial,
				values: { ...initial.values, site_name: "另一页面已保存" },
				meta: { ...initial.meta, saved_version: 3, applied_version: 3 },
			});
		});
		expect((input as HTMLInputElement).value).toBe("尚未保存的输入");
	} finally {
		client.clear();
	}
});
