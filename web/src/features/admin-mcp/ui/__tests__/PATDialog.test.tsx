import type { PATDTO } from "@features/admin-mcp/model/types";
import { apiPatch, apiPost } from "@shared/api/request";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PATDialog } from "../PATDialog";

vi.mock("@shared/api/request", () => ({
	apiGetPaged: vi.fn(),
	apiPost: vi.fn(),
	apiPatch: vi.fn(),
	apiDelete: vi.fn(),
}));

const existingToken: PATDTO = {
	id: "pat-existing",
	name: "现有客户端",
	scopes: ["posts:read", "comments:write"],
	expires_at: "2020-03-04T23:59:59.123456789Z",
	created_at: "2019-03-04T12:00:00Z",
	interactive: false,
};

function renderDialog(overrides: Partial<ComponentProps<typeof PATDialog>> = {}) {
	const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
	let props: ComponentProps<typeof PATDialog> = {
		open: true,
		token: existingToken,
		onOpenChange: vi.fn(),
		onCreated: vi.fn(),
		onUpdated: vi.fn(),
		...overrides,
	};
	const view = () => (
		<QueryClientProvider client={qc}>
			<PATDialog {...props} />
		</QueryClientProvider>
	);
	const result = render(view());
	return {
		props,
		rerenderDialog: (changes: Partial<ComponentProps<typeof PATDialog>>) => {
			props = { ...props, ...changes };
			result.rerender(view());
		},
	};
}

function nameInput() {
	return screen.getByRole("textbox", { name: /名称/ }) as HTMLInputElement;
}

function submitForm() {
	const form = nameInput().closest("form");
	if (!form) throw new Error("令牌名称必须位于原生表单内");
	fireEvent.submit(form);
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(apiPatch).mockResolvedValue(existingToken);
});

afterEach(() => cleanup());

describe("PATDialog", () => {
	it("创建仅含用量上报权限的令牌", async () => {
		const created: PATDTO = { ...existingToken, scopes: ["usage:write"], token: "new-token" };
		vi.mocked(apiPost).mockResolvedValue(created);
		const { props } = renderDialog({ token: null });
		fireEvent.change(nameInput(), { target: { value: "用量客户端" } });
		fireEvent.click(screen.getByRole("checkbox", { name: "posts:read" }));
		fireEvent.click(screen.getByRole("checkbox", { name: "usage:write" }));
		submitForm();
		await waitFor(() => expect(props.onCreated).toHaveBeenCalledWith(created));
		expect(apiPost).toHaveBeenCalledWith("/admin/api-tokens", {
			name: "用量客户端",
			scopes: ["usage:write"],
			expires_at: "",
			interactive: true,
		});
	});

	it("回填用量权限并可替换现有权限后保存", async () => {
		const { rerenderDialog } = renderDialog({
			token: { ...existingToken, scopes: ["usage:write"] },
		});
		expect(
			screen.getByRole("checkbox", { name: "usage:write" }).getAttribute("aria-checked"),
		).toBe("true");
		rerenderDialog({ token: existingToken });
		fireEvent.click(screen.getByRole("checkbox", { name: "posts:read" }));
		fireEvent.click(screen.getByRole("checkbox", { name: "comments:write" }));
		fireEvent.click(screen.getByRole("checkbox", { name: "usage:write" }));
		submitForm();
		await waitFor(() =>
			expect(apiPatch).toHaveBeenCalledWith("/admin/api-tokens/pat-existing", {
				name: existingToken.name,
				scopes: ["usage:write"],
				interactive: false,
			}),
		);
	});

	it("回填现有权限与 false 偏好，改名不发送有效期，过期令牌也无需续期", async () => {
		const { props } = renderDialog();
		expect(nameInput().value).toBe(existingToken.name);
		expect(
			screen.getByRole("checkbox", { name: "comments:write" }).getAttribute("aria-checked"),
		).toBe("true");
		expect(
			screen
				.getByRole("checkbox", { name: "agent 遇到冲突时询问我" })
				.getAttribute("aria-checked"),
		).toBe("false");
		fireEvent.change(nameInput(), { target: { value: "  改名后的客户端  " } });
		submitForm();
		await waitFor(() =>
			expect(apiPatch).toHaveBeenCalledWith("/admin/api-tokens/pat-existing", {
				name: "改名后的客户端",
				scopes: ["posts:read", "comments:write"],
				interactive: false,
			}),
		);
		expect(props.onCreated).not.toHaveBeenCalled();
		expect(apiPost).not.toHaveBeenCalled();
	});

	it("明确选择永不过期才发送 never，不提供含混的清除操作", async () => {
		renderDialog();
		fireEvent.click(within(screen.getByRole("group", { name: "有效期" })).getByRole("button"));
		expect(screen.queryByRole("button", { name: "清除" })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "永不过期" }));
		fireEvent.click(screen.getByRole("button", { name: "确定" }));
		submitForm();
		await waitFor(() =>
			expect(apiPatch).toHaveBeenCalledWith(
				"/admin/api-tokens/pat-existing",
				expect.objectContaining({ expires_at: "never" }),
			),
		);
	});

	it.each([
		undefined,
		null,
	])("交互偏好为 %s 时回填开启，用户关闭后仍提交 false", async (interactive) => {
		renderDialog({ token: { ...existingToken, interactive, expires_at: undefined } });
		const checkbox = screen.getByRole("checkbox", { name: "agent 遇到冲突时询问我" });
		expect(checkbox.getAttribute("aria-checked")).toBe("true");
		fireEvent.click(checkbox);
		submitForm();
		await waitFor(() =>
			expect(apiPatch).toHaveBeenCalledWith("/admin/api-tokens/pat-existing", {
				name: existingToken.name,
				scopes: existingToken.scopes,
				interactive: false,
			}),
		);
	});

	it("取消后重开丢弃草稿，换条目时重新回填全部字段", async () => {
		const { props, rerenderDialog } = renderDialog();
		fireEvent.change(nameInput(), { target: { value: "未保存的名称" } });
		fireEvent.click(screen.getByRole("checkbox", { name: "posts:read" }));
		fireEvent.click(screen.getByRole("button", { name: "取消" }));
		expect(props.onOpenChange).toHaveBeenCalledWith(false);
		rerenderDialog({ open: false });
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		rerenderDialog({ open: true });
		expect(nameInput().value).toBe(existingToken.name);
		expect(
			screen.getByRole("checkbox", { name: "posts:read" }).getAttribute("aria-checked"),
		).toBe("true");
		rerenderDialog({
			token: {
				...existingToken,
				id: "pat-another",
				name: "另一客户端",
				scopes: ["notes:read"],
				expires_at: undefined,
				interactive: true,
			},
		});
		expect(nameInput().value).toBe("另一客户端");
		expect(
			screen.getByRole("checkbox", { name: "posts:read" }).getAttribute("aria-checked"),
		).toBe("false");
		expect(
			screen.getByRole("checkbox", { name: "notes:read" }).getAttribute("aria-checked"),
		).toBe("true");
		expect(
			within(screen.getByRole("group", { name: "有效期" })).getByRole("button", {
				name: "永不过期",
			}),
		).toBeTruthy();
		expect(apiPatch).not.toHaveBeenCalled();
	});

	it("请求中阻止重复提交与关闭，失败后保留修改并可重试", async () => {
		const request = Promise.withResolvers<never>();
		vi.mocked(apiPatch).mockReturnValueOnce(request.promise);
		const { props } = renderDialog();
		fireEvent.change(nameInput(), { target: { value: "保留这次修改" } });
		fireEvent.click(screen.getByRole("checkbox", { name: "notes:read" }));
		submitForm();
		submitForm();
		await waitFor(() => expect(apiPatch).toHaveBeenCalledTimes(1));
		expect((screen.getByRole("button", { name: "保存" }) as HTMLButtonElement).disabled).toBe(
			true,
		);
		fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
		expect(props.onOpenChange).not.toHaveBeenCalled();
		request.reject(new Error("暂时不可用"));
		await waitFor(() => expect(nameInput().disabled).toBe(false));
		expect(nameInput().value).toBe("保留这次修改");
		expect(
			screen.getByRole("checkbox", { name: "notes:read" }).getAttribute("aria-checked"),
		).toBe("true");
		expect(props.onUpdated).not.toHaveBeenCalled();
		submitForm();
		await waitFor(() => expect(nameInput().disabled).toBe(false));
		expect(apiPatch).toHaveBeenCalledTimes(2);
	});

	it("共用校验拒绝空白名称、超长名称与空权限，不调用 PATCH", () => {
		renderDialog();
		for (const name of ["  ", "名".repeat(101)]) {
			fireEvent.change(nameInput(), { target: { value: name } });
			submitForm();
		}
		fireEvent.change(nameInput(), { target: { value: "有效名称" } });
		fireEvent.click(screen.getByRole("checkbox", { name: "posts:read" }));
		fireEvent.click(screen.getByRole("checkbox", { name: "comments:write" }));
		submitForm();
		expect(apiPatch).not.toHaveBeenCalled();
	});
});
