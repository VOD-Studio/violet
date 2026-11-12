import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UploadDropzone, type UploadEntry, UploadQueue } from "../upload";

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

const failed: UploadEntry = {
	id: "failed",
	name: "长文件名.photo.png",
	size: 900,
	status: "error",
	progress: 50,
	error: "连接中断",
	retryAt: 3000,
};

describe("UploadQueue", () => {
	it("按字节加权，不把取消或百分比到达 100 的在途文件当成完成", () => {
		render(
			<UploadQueue
				items={[
					{ id: "done", name: "small.png", size: 100, status: "done", progress: 0 },
					failed,
					{
						id: "cancel",
						name: "huge.png",
						size: 10000,
						status: "cancelled",
						progress: 100,
					},
				]}
				now={3000}
			/>,
		);
		expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("55");
		expect(screen.getByRole("button", { name: "收起上传面板" })).not.toBeNull();
		cleanup();
		render(
			<UploadQueue items={[{ ...failed, status: "uploading", progress: 100 }]} now={3000} />,
		);
		expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
		expect(screen.getByText("正在上传 0 / 1")).not.toBeNull();
	});

	it("受控时钟未到冷却时间不允许重试，确认取消期间不重复请求", () => {
		const retry = vi.fn();
		const cancel = vi.fn();
		const { rerender } = render(
			<UploadQueue items={[failed]} now={1000} onRetry={retry} onCancel={cancel} />,
		);
		fireEvent.click(screen.getByRole("button", { name: /重试 长文件名/ }));
		expect(retry).not.toHaveBeenCalled();
		rerender(<UploadQueue items={[failed]} now={3000} onRetry={retry} onCancel={cancel} />);
		fireEvent.click(screen.getByRole("button", { name: /重试 长文件名/ }));
		expect(retry).toHaveBeenCalledWith("failed");
		fireEvent.click(screen.getByRole("button", { name: /取消 长文件名/ }));
		expect(cancel).toHaveBeenCalledOnce();
		rerender(
			<UploadQueue
				items={[{ ...failed, cancelling: true }]}
				now={3000}
				onRetry={retry}
				onCancel={cancel}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: /取消 长文件名/ }));
		fireEvent.click(screen.getByRole("button", { name: /重试 长文件名/ }));
		expect(cancel).toHaveBeenCalledOnce();
		expect(retry).toHaveBeenCalledOnce();
		expect(screen.getByText("正在确认取消…")).not.toBeNull();
	});

	it("省略时钟时倒计时到期恢复原生重试按钮", () => {
		vi.useFakeTimers();
		vi.setSystemTime(1000);
		const retry = vi.fn();
		render(<UploadQueue items={[failed]} onRetry={retry} />);
		expect(
			(screen.getByRole("button", { name: /重试 长文件名/ }) as HTMLButtonElement).disabled,
		).toBe(true);
		act(() => vi.advanceTimersByTime(2000));
		fireEvent.click(screen.getByRole("button", { name: /重试 长文件名/ }));
		expect(retry).toHaveBeenCalledOnce();
	});

	it("服务端重试期限与水合跨越边界时不改写首帧，水合后恢复可重试", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(1000);
		const retry = vi.fn();
		const props = { items: [failed], onRetry: retry };
		const container = document.createElement("div");
		container.innerHTML = renderToString(<UploadQueue {...props} />);
		document.body.append(container);
		vi.setSystemTime(3500);
		const errors: unknown[] = [];
		let root: Root | undefined;
		try {
			await act(async () => {
				root = hydrateRoot(container, <UploadQueue {...props} />, {
					onRecoverableError: (error) => errors.push(error),
				});
			});
			expect(errors).toEqual([]);
			fireEvent.click(screen.getByRole("button", { name: /重试 长文件名/ }));
			expect(retry).toHaveBeenCalledOnce();
		} finally {
			await act(async () => root?.unmount());
			container.remove();
		}
	});

	it("宿主在捕获阶段取消激活时不折叠或触发队列动作", () => {
		const action = vi.fn();
		render(
			<UploadQueue
				items={[
					{ ...failed, retryAt: undefined },
					{ ...failed, id: "done", name: "saved.png", status: "done" },
				]}
				now={3000}
				policy="error"
				onClickCapture={(event) => event.preventDefault()}
				onCancel={action}
				onRetry={action}
				onRemove={action}
				onClose={action}
				onRetryPolicy={action}
				onCancelAll={action}
				onClearCompleted={action}
			/>,
		);
		for (const button of screen.getAllByRole("button")) fireEvent.click(button);
		expect(action).not.toHaveBeenCalled();
		expect(screen.getByRole("list")).not.toBeNull();
		expect(
			screen.getByRole("button", { name: "收起上传面板" }).getAttribute("aria-expanded"),
		).toBe("true");
	});

	it("收起只隐藏交互区，展开恢复，关闭与策略动作仍由宿主处理", () => {
		const cancel = vi.fn();
		const close = vi.fn();
		const retryPolicy = vi.fn();
		const resume = vi.fn();
		const { rerender } = render(
			<UploadQueue
				items={[failed]}
				now={3000}
				policy="error"
				onRetryPolicy={retryPolicy}
				onClose={close}
				onCancel={cancel}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "重试配置" }));
		expect(retryPolicy).toHaveBeenCalledOnce();
		const toggle = screen.getByRole("button", { name: "收起上传面板" });
		fireEvent.click(toggle);
		const bodyId = toggle.getAttribute("aria-controls");
		if (!bodyId) throw new Error("缺少折叠区域关联");
		const body = document.getElementById(bodyId);
		expect(body?.hasAttribute("inert")).toBe(true);
		expect(screen.queryByRole("list")).toBeNull();
		expect(cancel).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "关闭上传面板" }));
		expect(close).toHaveBeenCalledOnce();
		fireEvent.click(screen.getByRole("button", { name: "展开上传面板" }));
		expect(screen.getByRole("list")).not.toBeNull();
		rerender(<UploadQueue items={[failed]} now={3000} policy="paused" onResume={resume} />);
		fireEvent.click(screen.getByRole("button", { name: "继续上传" }));
		expect(resume).toHaveBeenCalledOnce();
	});

	it("移除结束项前把焦点留在面板，清除后焦点仍然可达", () => {
		function QueueHost() {
			const [items, setItems] = useState<UploadEntry[]>([
				{ ...failed, id: "first", name: "first.png", status: "done" },
				{ ...failed, id: "second", name: "second.png", status: "cancelled" },
			]);
			return (
				<UploadQueue
					items={items}
					now={3000}
					onRemove={(id) => setItems(items.filter((item) => item.id !== id))}
					onClearCompleted={() => setItems([])}
				/>
			);
		}
		render(<QueueHost />);
		const first = screen.getByRole("button", { name: "移除 first.png" });
		first.focus();
		fireEvent.click(first);
		expect(document.activeElement).toBe(
			screen.getByRole("button", { name: "移除 second.png" }),
		);
		fireEvent.click(screen.getByRole("button", { name: "清除已结束" }));
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "收起上传面板" }));
	});
});

describe("UploadDropzone", () => {
	it("保留原生禁用、提交取消与 ref，拖拽视觉不会代替选择行为", () => {
		const click = vi.fn();
		const submit = vi.fn((event) => event.preventDefault());
		const ref = createRef<HTMLButtonElement>();
		const { rerender } = render(
			<UploadDropzone ref={ref} disabled dragActive onClick={click}>
				选择文件
			</UploadDropzone>,
		);
		ref.current?.click();
		expect(click).not.toHaveBeenCalled();
		rerender(
			<form onSubmit={submit}>
				<UploadDropzone
					ref={ref}
					type="submit"
					onClick={(event) => event.preventDefault()}
					hint="支持图片"
				>
					选择文件
				</UploadDropzone>
			</form>,
		);
		fireEvent.click(screen.getByRole("button"));
		expect(submit).not.toHaveBeenCalled();
		expect(ref.current?.tagName).toBe("BUTTON");
	});
});
