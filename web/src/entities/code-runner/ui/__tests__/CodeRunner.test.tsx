import { type StreamHandlers, streamExec, submitExecStream } from "@entities/code-runner/api/exec";
import { CodeRunner } from "@entities/code-runner/ui/CodeRunner";
import { apiGet } from "@shared/api/request";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 键盘内核另由组件单元与浏览器覆盖；这里保留真实外壳和 SSE 生命周期。
vi.mock("../../../../../packages/ui/src/components/code-block/code-editor", () => ({
	CodeEditor: ({
		value,
		label,
		onChange,
	}: {
		value: string;
		label: string;
		onChange: (value: string) => void;
	}) => (
		<textarea
			aria-label={label}
			value={value}
			onChange={(event) => onChange(event.target.value)}
		/>
	),
}));
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
	it("首次运行把流式输出和最终结果写入可读屏日志", async () => {
		render(<CodeRunner language="python" source="print('Hello World')" />, {
			wrapper: Provider,
		});
		const stream = await startRun();
		act(() => {
			stream.onStdout?.("Hello");
			stream.onStdout?.(" World\n");
			stream.onStderr?.("warning\n");
		});
		const log = screen.getByRole("log");
		expect(log.getAttribute("aria-live")).toBe("polite");
		expect(log.textContent).toContain("Hello World\nwarning\n");
		expect(screen.getByRole("button", { busy: true })).toHaveProperty("disabled", true);
		act(() =>
			stream.onDone?.({
				status: "success",
				stdout: "Hello World\n",
				stderr: "warning\n",
				exit_code: 0,
				duration_ms: 100,
				language: "python",
			}),
		);
		expect(log.textContent).toMatch(/完成.*退出码 0.*100/);
		expect(screen.getByRole("button", { name: "运行" })).toHaveProperty("disabled", false);
	});

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

	it("策略请求失败可重试，恢复后使用读者当前草稿执行", async () => {
		vi.mocked(apiGet).mockRejectedValueOnce(new Error("策略网络错误"));
		render(<CodeRunner language="python" source="print('original')" />, { wrapper: Provider });
		expect((await screen.findByRole("alert")).textContent).toContain("策略网络错误");
		fireEvent.click(screen.getByRole("button", { name: "重试" }));
		const editor = await screen.findByRole("textbox", { name: "可编辑的 python 代码" });
		fireEvent.change(editor, { target: { value: "print('draft')" } });
		await startRun();
		expect(submitExecStream).toHaveBeenCalledWith({
			language: "python",
			source: "print('draft')",
			overrides: undefined,
		});
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

	it("提交返回之前卸载，不再建立无归属的输出连接", async () => {
		let finishSubmission: ((id: string) => void) | undefined;
		vi.mocked(submitExecStream).mockImplementation(
			() =>
				new Promise((resolve) => {
					finishSubmission = resolve;
				}),
		);
		const view = render(<CodeRunner language="python" source="print('Hello')" />, {
			wrapper: Provider,
		});
		fireEvent.click(await screen.findByRole("button", { name: "运行" }));
		view.unmount();
		await act(async () => finishSubmission?.("late-task"));
		expect(streamExec).not.toHaveBeenCalled();
	});
});
