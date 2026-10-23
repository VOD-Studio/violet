import { submitExecStream } from "@entities/code-runner/api/exec";
import { CodeRunner } from "@entities/code-runner/ui/CodeRunner";
import { apiGet } from "@shared/api/request";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@entities/code-runner/ui/CodeMirrorEditor", () => ({
	CodeMirrorEditor: () => <div data-testid="codemirror-mock" />,
}));

vi.mock("@shared/api/request", () => ({ apiGet: vi.fn() }));

const mockWrite = vi.fn();
const mockReset = vi.fn();

vi.mock("@xterm/xterm", () => {
	return {
		Terminal: class {
			loadAddon = vi.fn();
			open = vi.fn();
			write = mockWrite;
			clear = vi.fn();
			reset = mockReset;
			dispose = vi.fn();
		},
	};
});

vi.mock("@xterm/addon-fit", () => {
	return {
		FitAddon: class {
			fit = vi.fn();
		},
	};
});

vi.mock("@entities/code-runner/api/exec", () => ({
	submitExecStream: vi.fn().mockResolvedValue("task-123"),
	streamExec: vi.fn().mockImplementation((_taskId, handlers) => {
		setTimeout(() => {
			handlers.onStdout("Hello World\n");
			handlers.onDone({
				status: "success",
				stdout: "Hello World\n",
				stderr: "",
				exit_code: 0,
				duration_ms: 100,
				language: "python",
			});
		}, 50);
		return new AbortController();
	}),
}));

beforeEach(() => vi.clearAllMocks());

describe("CodeRunner", () => {
	it("首次运行等待终端 Ready 之后正确写入输出", async () => {
		vi.mocked(apiGet).mockResolvedValue({ version: 1, enabled: true, languages: ["python"] });
		render(
			<QueryClientProvider client={new QueryClient()}>
				<CodeRunner language="python" source="print('Hello World')" />
			</QueryClientProvider>,
		);

		const runBtn = await screen.findByRole("button", { name: "运行" });
		fireEvent.click(runBtn);

		await waitFor(
			() => {
				expect(mockReset).toHaveBeenCalled();
				expect(mockWrite).toHaveBeenCalledWith("Hello World\n");
			},
			{ timeout: 3000 },
		);
	});
	it.each([
		{ enabled: false, languages: ["python"], label: "运行器已关闭" },
		{ enabled: true, languages: [], label: "此语言已禁用" },
	])("策略拒绝时保留源码但不提交任务：$label", async ({ enabled, languages, label }) => {
		vi.mocked(apiGet).mockResolvedValue({ version: 2, enabled, languages });
		const client = new QueryClient();
		render(
			<QueryClientProvider client={client}>
				<CodeRunner language="python" source="print('Hello World')" />
			</QueryClientProvider>,
		);
		const button = await screen.findByRole("button", { name: label });
		expect(button).toHaveProperty("disabled", true);
		fireEvent.click(button);
		expect(submitExecStream).not.toHaveBeenCalled();
		client.clear();
	});
});
