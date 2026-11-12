import { type StreamHandlers, streamExec, submitExecStream } from "@entities/code-runner/api/exec";
import { CodeRunner } from "@entities/code-runner/ui/CodeRunner";
import { apiGet } from "@shared/api/request";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@shared/api/request", () => ({ apiGet: vi.fn() }));
vi.mock("@entities/code-runner/api/exec", () => ({
	submitExecStream: vi.fn(),
	streamExec: vi.fn(),
}));

let handlers: StreamHandlers | undefined;
let client: QueryClient;
function Provider({ children }: { children: ReactNode }) {
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
	vi.resetAllMocks();
	handlers = undefined;
	client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
	vi.mocked(apiGet).mockResolvedValue({ version: 1, enabled: true, languages: ["python"] });
	vi.mocked(submitExecStream).mockResolvedValue("task-123");
	vi.mocked(streamExec).mockImplementation((_id, next) => {
		handlers = next;
		return new AbortController();
	});
});
afterEach(() => {
	cleanup();
	client.clear();
	localStorage.clear();
});

async function startRun() {
	const button = await screen.findByRole("button", { name: "运行" });
	await act(async () => fireEvent.click(button));
	if (!handlers) throw new Error("执行请求没有建立输出流");
	return handlers;
}

describe("CodeRunner", () => {
	it.each([
		{ enabled: false, languages: ["python"], label: "运行器已关闭" },
		{ enabled: true, languages: [], label: "此语言已禁用" },
	])("策略拒绝时保留源码但不提交任务：$label", async ({ enabled, languages, label }) => {
		vi.mocked(apiGet).mockResolvedValue({ version: 2, enabled, languages });
		render(<CodeRunner language="python" source="print('Hello World')" />, {
			wrapper: Provider,
		});
		const button = await screen.findByRole("button", { name: label });
		expect(button).toHaveProperty("disabled", true);
		fireEvent.click(button);
		expect(submitExecStream).not.toHaveBeenCalled();
	});

	it("策略请求失败可重试，恢复后允许执行", async () => {
		vi.mocked(apiGet).mockRejectedValueOnce(new Error("策略网络错误"));
		render(<CodeRunner language="python" source="print('original')" />, { wrapper: Provider });
		expect((await screen.findByRole("alert")).textContent).toContain("策略网络错误");
		fireEvent.click(screen.getByRole("button", { name: "重试" }));
		const run = await screen.findByRole("button", { name: "运行" });
		expect(run).toHaveProperty("disabled", false);
		fireEvent.click(run);
		await waitFor(() => expect(run.getAttribute("aria-busy")).toBe("true"));
	});

	it("提交失败显示本次错误并允许再次运行", async () => {
		vi.mocked(submitExecStream).mockRejectedValueOnce(new Error("执行配额已用完"));
		render(<CodeRunner language="python" source="print('Hello')" />, { wrapper: Provider });
		fireEvent.click(await screen.findByRole("button", { name: "运行" }));
		await waitFor(() =>
			expect(screen.getByRole("log").textContent).toContain("执行配额已用完"),
		);
		expect(screen.getByRole("button", { name: "运行" })).toHaveProperty("disabled", false);
	});

	it("更换源码清空旧输出，旧流不能污染新代码", async () => {
		const view = render(<CodeRunner language="python" source="print('old')" />, {
			wrapper: Provider,
		});
		const oldStream = await startRun();
		act(() => oldStream.onStdout?.("old output\n"));
		expect(screen.getByRole("log").textContent).toContain("old output");
		view.rerender(<CodeRunner language="python" source="print('new')" />);
		act(() => oldStream.onStdout?.("late old output\n"));
		expect(screen.queryByText(/old output/)).toBeNull();
		const newStream = await startRun();
		act(() => newStream.onStdout?.("new output\n"));
		expect(screen.getByRole("log").textContent).toContain("new output");
		expect(screen.getByRole("log").textContent).not.toContain("old output");
	});
});
