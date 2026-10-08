import {
	type UseFileSelectionOptions,
	useFileSelection,
} from "@features/upload/hooks/use-file-selection";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { warning: vi.fn() } }));

function FileSelection(options: UseFileSelectionOptions) {
	const { inputProps, open, selectFiles } = useFileSelection(options);
	return (
		<>
			<input {...inputProps} aria-label="选择文件" />
			<button
				type="button"
				onClick={open}
				onDrop={(event) => {
					event.preventDefault();
					selectFiles(event.dataTransfer.files);
				}}
			>
				添加文件
			</button>
		</>
	);
}

function selectedInput() {
	return screen.getByLabelText<HTMLInputElement>("选择文件");
}

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.clearAllMocks();
});

describe("文件选择边界", () => {
	it.each(["选择", "拖放"])("%s时过滤类型和超限大小，保留上限内文件", (source) => {
		const onSelect = vi.fn();
		render(<FileSelection accept="image/*,.md" maxSize={4} maxFiles={5} onSelect={onSelect} />);
		const image = new File(["1234"], "animation.gif", { type: "image/gif" });
		const extension = new File(["123"], "notes.md");
		const wrongType = new File(["1"], "clip.mp4", { type: "video/mp4" });
		const tooLarge = new File(["12345"], "large.png", { type: "image/png" });
		const files = [wrongType, image, tooLarge, extension];

		if (source === "选择") {
			fireEvent.change(selectedInput(), { target: { files } });
		} else {
			fireEvent.drop(screen.getByRole("button"), { dataTransfer: { files } });
		}

		expect(onSelect).toHaveBeenCalledExactlyOnceWith([image, extension]);
	});

	it("单选模式限制每次拖放，后续选择仍可交付", () => {
		const onSelect = vi.fn();
		render(<FileSelection accept="image/*" maxSize={4} maxFiles={1} onSelect={onSelect} />);
		const first = new File(["1"], "first.png", { type: "image/png" });
		const second = new File(["2"], "second.gif", { type: "image/gif" });

		expect(selectedInput().multiple).toBe(false);
		fireEvent.drop(screen.getByRole("button"), {
			dataTransfer: { files: [first, second] },
		});
		fireEvent.change(selectedInput(), { target: { files: [second] } });

		expect(onSelect).toHaveBeenNthCalledWith(1, [first]);
		expect(onSelect).toHaveBeenNthCalledWith(2, [second]);
		expect(onSelect).toHaveBeenCalledTimes(2);
	});

	it("清空原生选择值，同一文件可连续交付", () => {
		const onSelect = vi.fn();
		render(<FileSelection accept="image/*" maxSize={4} maxFiles={1} onSelect={onSelect} />);
		const file = new File(["1"], "same.gif", { type: "image/gif" });
		const input = selectedInput();

		for (let selection = 0; selection < 2; selection++) {
			// jsdom 不提供文件选择器，补入浏览器选中后的只读路径状态。
			Object.defineProperty(input, "value", {
				configurable: true,
				writable: true,
				value: "C:\\fakepath\\same.gif",
			});
			fireEvent.change(input, { target: { files: [file] } });
			expect(input.value).toBe("");
		}

		expect(onSelect).toHaveBeenNthCalledWith(1, [file]);
		expect(onSelect).toHaveBeenNthCalledWith(2, [file]);
		expect(onSelect).toHaveBeenCalledTimes(2);
	});

	it("取消选择或全部无效时不交付文件", () => {
		const onSelect = vi.fn();
		render(<FileSelection accept="image/*" maxSize={4} maxFiles={1} onSelect={onSelect} />);
		fireEvent.change(selectedInput(), { target: { files: [] } });
		fireEvent.change(selectedInput(), { target: { files: null } });
		fireEvent.change(selectedInput(), {
			target: { files: [new File(["1"], "text.txt", { type: "text/plain" })] },
		});
		fireEvent.change(selectedInput(), {
			target: { files: [new File(["12345"], "large.gif", { type: "image/gif" })] },
		});

		expect(onSelect).not.toHaveBeenCalled();
	});

	it("禁用后禁止打开选择器和交付，包括禁用前打开的选择器结果", () => {
		const onSelect = vi.fn();
		const options = { accept: "image/*", maxSize: 4, maxFiles: 1, onSelect };
		const { rerender } = render(<FileSelection {...options} />);
		const input = selectedInput();
		const click = vi.spyOn(input, "click");
		const file = new File(["1"], "image.gif", { type: "image/gif" });
		fireEvent.click(screen.getByRole("button"));
		expect(click).toHaveBeenCalledTimes(1);

		rerender(<FileSelection {...options} disabled />);
		fireEvent.click(screen.getByRole("button"));
		fireEvent.change(input, { target: { files: [file] } });
		fireEvent.drop(screen.getByRole("button"), { dataTransfer: { files: [file] } });

		expect(input.disabled).toBe(true);
		expect(click).toHaveBeenCalledTimes(1);
		expect(onSelect).not.toHaveBeenCalled();
		expect(toast.warning).not.toHaveBeenCalled();
	});
});
