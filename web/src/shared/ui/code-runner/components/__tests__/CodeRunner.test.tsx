import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CodeRunner } from "../CodeRunner";

vi.mock("../CodeMirrorEditor", () => ({
    CodeMirrorEditor: () => <div data-testid="codemirror-mock" />,
}));

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

vi.mock("#/features/code-run", () => ({
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

describe("CodeRunner", () => {
    it("首次运行等待终端 Ready 之后正确写入输出", async () => {
        render(<CodeRunner language="python" source="print('Hello World')" />);

        const runBtn = screen.getByRole("button", { name: "运行" });
        fireEvent.click(runBtn);

        await waitFor(
            () => {
                expect(mockReset).toHaveBeenCalled();
                expect(mockWrite).toHaveBeenCalledWith("Hello World\n");
            },
            { timeout: 3000 },
        );
    });
});
