/// <reference lib="es2024.promise" />

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ColorSwatch, TEXT_COLOR_PRESETS } from "../ColorSwatch";
import { HsvColorPicker, type HsvColorPickerProps } from "../HsvColorPicker";
import { hexToHsv, hsvToHex, normalizeHexColor } from "../hsv";

afterEach(() => vi.unstubAllGlobals());

function ControlledPicker({
	initial = "#2e4e9a",
	onChange,
	...props
}: { initial?: string } & Partial<HsvColorPickerProps>) {
	const [value, setValue] = useState(initial);
	return (
		<HsvColorPicker
			{...props}
			value={value}
			onChange={(hex) => {
				setValue(hex);
				onChange?.(hex);
			}}
		/>
	);
}

interface EyeRequest {
	signal: AbortSignal;
	resolve: (hex: string) => void;
	reject: (error: unknown) => void;
}

/** 真实异步的 EyeDropper：请求保持挂起，直到测试决定何时完成，且不因 abort 自动结算。 */
function stubEyeDropper() {
	const requests: EyeRequest[] = [];
	vi.stubGlobal(
		"EyeDropper",
		class {
			open({ signal }: { signal: AbortSignal }) {
				const { promise, resolve, reject } = Promise.withResolvers<{ sRGBHex: string }>();
				requests.push({ signal, resolve: (hex) => resolve({ sRGBHex: hex }), reject });
				return promise;
			}
		},
	);
	return requests;
}

describe("HSV conversions", () => {
	it("保留 RGB 字节往返精度，包含灰色、极暗色和扇区边界", () => {
		const channels = [0, 1, 16, 63, 127, 128, 192, 254, 255];
		for (const r of channels)
			for (const g of channels)
				for (const b of channels) {
					const hex = `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
					const { h, s, v } = hexToHsv(hex);
					expect(hsvToHex(h, s, v)).toBe(hex);
				}
	});

	it("扩展三位 HEX，拒绝未完成输入，色相循环且 S/V 不溢出", () => {
		expect(normalizeHexColor(" #C63 ")).toBe("#cc6633");
		expect(normalizeHexColor("ab")).toBeNull();
		expect(normalizeHexColor("#1234")).toBeNull();
		expect(hsvToHex(-60, 1, 1)).toBe("#ff00ff");
		expect(hsvToHex(720, 2, 2)).toBe("#ff0000");
		expect(hsvToHex(100, -1, -1)).toBe("#000000");
		expect(hexToHsv("C63")).toEqual(hexToHsv("#cc6633"));
	});

	it("十二传统色在设计稿纸面上达到正文对比度，而不是主题四季种子", () => {
		const luminance = (hex: string) => {
			const rgb = [1, 3, 5]
				.map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
				.map((value) =>
					value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
				);
			return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
		};
		for (const color of TEXT_COLOR_PRESETS)
			expect(
				(luminance("#fbf8f6") + 0.05) / (luminance(color.value) + 0.05),
			).toBeGreaterThanOrEqual(4.5);
	});
});

describe("HsvColorPicker", () => {
	it("编辑途中保留草稿，合法三位即时提交，受控回声不吞掉后续六位输入", () => {
		render(<ControlledPicker />);
		const input = screen.getByRole("textbox") as HTMLInputElement;
		fireEvent.change(input, { target: { value: "c" } });
		expect(input.value).toBe("C");
		expect(input.getAttribute("aria-invalid")).not.toBe("true");
		fireEvent.change(input, { target: { value: "c63" } });
		expect(input.value).toBe("C63");
		fireEvent.change(input, { target: { value: "c63a" } });
		expect(input.value).toBe("C63A");
		fireEvent.blur(input);
		expect(input.getAttribute("aria-invalid")).toBe("true");
		fireEvent.change(input, { target: { value: "#c63c26" } });
		expect(input.value).toBe("C63C26");
		fireEvent.blur(input);
		expect(input.getAttribute("aria-invalid")).not.toBe("true");
	});

	it("粘贴完整色串后失焦展开简写，HEX 原生 ref/name/form 可用", () => {
		const change = vi.fn();
		const ref = createRef<HTMLInputElement>();
		render(
			<form aria-label="颜色表单">
				<HsvColorPicker
					value="#000000"
					onChange={change}
					hexInputProps={{ ref, name: "color", "aria-describedby": "hint" }}
				/>
			</form>,
		);
		const input = screen.getByRole("textbox") as HTMLInputElement;
		expect(ref.current).toBe(input);
		fireEvent.change(input, { target: { value: "#aBc" } });
		expect(change).toHaveBeenLastCalledWith("#aabbcc");
		expect(input.value).toBe("ABC");
		fireEvent.blur(input);
		expect(input.value).toBe("AABBCC");
		expect(new FormData(input.form as HTMLFormElement).get("color")).toBe("AABBCC");
		expect(input.getAttribute("aria-describedby")).toBe("hint");
	});

	it("外部非回声更新替换草稿，原色基准不随受控更新漂移", () => {
		const change = vi.fn();
		const { rerender } = render(<HsvColorPicker value="#ff0000" onChange={change} />);
		const input = screen.getByRole("textbox") as HTMLInputElement;
		fireEvent.change(input, { target: { value: "bad!" } });
		fireEvent.blur(input);
		rerender(<HsvColorPicker value="#0000ff" onChange={change} />);
		expect(input.value).toBe("0000FF");
		expect(input.getAttribute("aria-invalid")).not.toBe("true");
		fireEvent.click(screen.getByRole("button", { name: "恢复原颜色 #FF0000" }));
		expect(change).toHaveBeenLastCalledWith("#ff0000");
	});

	it("SV 的两个轴按 1%/Shift10% 调节且钳制，色相按 1°/Shift10° 循环", () => {
		render(<ControlledPicker initial="#ff0000" />);
		const sv = screen.getByRole("slider", { name: "饱和度与明度" });
		fireEvent.keyDown(sv, { key: "ArrowLeft" });
		expect(sv.getAttribute("aria-valuetext")).toBe("饱和度 99%，明度 100%");
		fireEvent.keyDown(sv, { key: "ArrowDown", shiftKey: true });
		expect(sv.getAttribute("aria-valuetext")).toBe("饱和度 99%，明度 90%");
		const hue = screen.getByRole("slider", { name: "色相" });
		fireEvent.keyDown(hue, { key: "ArrowLeft" });
		expect(hue.getAttribute("aria-valuenow")).toBe("359");
		fireEvent.keyDown(hue, { key: "ArrowRight", shiftKey: true });
		expect(hue.getAttribute("aria-valuenow")).toBe("9");
		fireEvent.keyDown(sv, { key: "ArrowRight", shiftKey: true });
		expect(sv.getAttribute("aria-valuenow")).toBe("100");
	});

	it("黑色与灰色受控回声不量化或清除正在调整的色相", () => {
		render(<ControlledPicker initial="#000000" />);
		const hue = screen.getByRole("slider", { name: "色相" });
		for (let index = 0; index < 17; index++) fireEvent.keyDown(hue, { key: "ArrowRight" });
		expect(hue.getAttribute("aria-valuenow")).toBe("17");
	});

	it("指针越界钳制，只追踪活动指针；完成才记录最近色，取消后不再拖动", () => {
		const change = vi.fn();
		const complete = vi.fn();
		render(<HsvColorPicker value="#ff0000" onChange={change} onColorCommit={complete} />);
		const sv = screen.getByRole("slider", { name: "饱和度与明度" });
		vi.spyOn(sv, "getBoundingClientRect").mockReturnValue({
			left: 10,
			top: 10,
			width: 100,
			height: 100,
		} as DOMRect);
		fireEvent.pointerDown(sv, { pointerId: 1, button: 0, clientX: 60, clientY: 60 });
		expect(change).toHaveBeenLastCalledWith("#804040");
		fireEvent.pointerMove(sv, { pointerId: 2, clientX: 110, clientY: 10 });
		expect(change).toHaveBeenCalledTimes(1);
		fireEvent.pointerMove(sv, { pointerId: 1, clientX: 200, clientY: -10 });
		expect(change).toHaveBeenLastCalledWith("#ff0000");
		expect(complete).not.toHaveBeenCalled();
		fireEvent.pointerUp(sv, { pointerId: 1 });
		expect(complete).toHaveBeenLastCalledWith("#ff0000");
		fireEvent.pointerDown(sv, { pointerId: 3, button: 0, clientX: 60, clientY: 60 });
		fireEvent.pointerCancel(sv, { pointerId: 3 });
		fireEvent.pointerMove(sv, { pointerId: 3, clientX: 110, clientY: 10 });
		expect(change).toHaveBeenCalledTimes(3);
	});

	it.each([
		{ disabled: true },
		{ readOnly: true },
	])("不可编辑状态不会经键盘、输入或恢复改变值：%j", (state) => {
		const change = vi.fn();
		render(<HsvColorPicker value="#ff0000" onChange={change} {...state} />);
		fireEvent.keyDown(screen.getByRole("slider", { name: "色相" }), { key: "ArrowRight" });
		fireEvent.change(screen.getByRole("textbox"), { target: { value: "ABC" } });
		fireEvent.click(screen.getByRole("button", { name: "恢复原颜色 #FF0000" }));
		expect(change).not.toHaveBeenCalled();
	});

	it("原生 HEX onKeyDown/onBlur 可取消内部完成动作", () => {
		const complete = vi.fn();
		render(
			<HsvColorPicker
				value="#000000"
				onChange={vi.fn()}
				onColorCommit={complete}
				hexInputProps={{
					onBlur: (event) => event.preventDefault(),
					onKeyDown: (event) => event.preventDefault(),
				}}
			/>,
		);
		const input = screen.getByRole("textbox");
		fireEvent.change(input, { target: { value: "ABC" } });
		fireEvent.keyDown(input, { key: "Enter" });
		fireEvent.blur(input);
		expect(complete).not.toHaveBeenCalled();
	});

	it("不支持时不渲染吸管，支持时调用真实接口且只提交有效结果", async () => {
		const { unmount } = render(<HsvColorPicker value="#000000" onChange={vi.fn()} />);
		expect(screen.queryByRole("button", { name: "从屏幕取色" })).toBeNull();
		unmount();
		const open = vi.fn().mockResolvedValue({ sRGBHex: "#123456" });
		vi.stubGlobal(
			"EyeDropper",
			class {
				open = open;
			},
		);
		const change = vi.fn();
		render(<HsvColorPicker value="#000000" onChange={change} />);
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "从屏幕取色" }));
		});
		expect(open).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
		expect(change).toHaveBeenLastCalledWith("#123456");
	});

	it("取消吸管不提交颜色，其他错误交给宿主，卸载取消挂起选择", async () => {
		const change = vi.fn();
		const error = vi.fn();
		const open = vi
			.fn()
			.mockRejectedValueOnce(new DOMException("cancel", "AbortError"))
			.mockRejectedValueOnce(new Error("capture failed"));
		let signal: AbortSignal | undefined;
		vi.stubGlobal(
			"EyeDropper",
			class {
				open = open;
			},
		);
		const { unmount } = render(
			<HsvColorPicker value="#000000" onChange={change} onEyeDropperError={error} />,
		);
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "从屏幕取色" }));
		});
		expect(change).not.toHaveBeenCalled();
		expect(error).not.toHaveBeenCalled();
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "从屏幕取色" }));
		});
		expect(error).toHaveBeenCalledWith(expect.objectContaining({ message: "capture failed" }));
		open.mockImplementation(({ signal: next }: { signal: AbortSignal }) => {
			signal = next;
			return new Promise(() => {});
		});
		fireEvent.click(screen.getByRole("button", { name: "从屏幕取色" }));
		unmount();
		expect(signal?.aborted).toBe(true);
	});

	describe("吸管请求与锁定状态", () => {
		const eyeButton = () =>
			screen.getByRole<HTMLButtonElement>("button", { name: "从屏幕取色" });
		const startPick = () =>
			act(async () => {
				fireEvent.click(eyeButton());
			});

		it.each([
			{ disabled: true },
			{ readOnly: true },
		])("选择途中变为不可编辑：请求取消并清除等待，迟到结果不落地：%j", async (state) => {
			const requests = stubEyeDropper();
			const change = vi.fn();
			const commit = vi.fn();
			const error = vi.fn();
			const props = {
				value: "#000000",
				onChange: change,
				onColorCommit: commit,
				onEyeDropperError: error,
			};
			const { rerender } = render(<HsvColorPicker {...props} />);
			await startPick();
			expect(eyeButton().getAttribute("aria-busy")).toBe("true");
			rerender(<HsvColorPicker {...props} {...state} />);
			expect(requests[0].signal.aborted).toBe(true);
			expect(eyeButton().disabled).toBe(true);
			expect(eyeButton().getAttribute("aria-busy")).toBeNull();
			await act(async () => {
				requests[0].resolve("#123456");
			});
			expect(change).not.toHaveBeenCalled();
			expect(commit).not.toHaveBeenCalled();
			expect(error).not.toHaveBeenCalled();
			rerender(<HsvColorPicker {...props} />);
			expect(eyeButton().disabled).toBe(false);
		});

		it("旧请求迟到收尾不会解除新请求的等待，也不会提交或报错", async () => {
			const requests = stubEyeDropper();
			const change = vi.fn();
			const error = vi.fn();
			const props = { value: "#000000", onChange: change, onEyeDropperError: error };
			const { rerender } = render(<HsvColorPicker {...props} />);
			await startPick();
			rerender(<HsvColorPicker {...props} disabled />);
			rerender(<HsvColorPicker {...props} />);
			await startPick();
			expect(requests).toHaveLength(2);
			expect(eyeButton().getAttribute("aria-busy")).toBe("true");
			await act(async () => {
				requests[0].resolve("#abcdef");
			});
			expect(change).not.toHaveBeenCalled();
			expect(eyeButton().getAttribute("aria-busy")).toBe("true");
			expect(eyeButton().disabled).toBe(true);
			await act(async () => {
				requests[1].resolve("#123456");
			});
			expect(change).toHaveBeenCalledTimes(1);
			expect(change).toHaveBeenLastCalledWith("#123456");
			expect(eyeButton().getAttribute("aria-busy")).toBeNull();
			expect(error).not.toHaveBeenCalled();
		});

		it("旧请求迟到失败不报给宿主；卸载后迟到的成功或失败也不通知", async () => {
			const requests = stubEyeDropper();
			const change = vi.fn();
			const error = vi.fn();
			const props = { value: "#000000", onChange: change, onEyeDropperError: error };
			const { rerender, unmount } = render(<HsvColorPicker {...props} />);
			await startPick();
			rerender(<HsvColorPicker {...props} readOnly />);
			await act(async () => {
				requests[0].reject(new Error("late failure"));
			});
			expect(error).not.toHaveBeenCalled();
			rerender(<HsvColorPicker {...props} />);
			await startPick();
			unmount();
			expect(requests[1].signal.aborted).toBe(true);
			await act(async () => {
				requests[1].resolve("#123456");
			});
			expect(change).not.toHaveBeenCalled();
			expect(error).not.toHaveBeenCalled();
		});
	});

	it("外部合法值替换非法草稿时恢复宿主合法性，只在真实变化时通知", () => {
		const validity = vi.fn();
		const props = { onChange: vi.fn(), onValidityChange: validity };
		const { rerender } = render(<HsvColorPicker value="#ff0000" {...props} />);
		expect(validity).not.toHaveBeenCalled();
		const input = screen.getByRole<HTMLInputElement>("textbox");
		fireEvent.change(input, { target: { value: "bad!" } });
		fireEvent.change(input, { target: { value: "bad!!" } });
		fireEvent.blur(input);
		expect(validity.mock.calls).toEqual([[false]]);
		rerender(<HsvColorPicker value="#0000ff" {...props} />);
		expect(input.value).toBe("0000FF");
		expect(validity.mock.calls).toEqual([[false], [true]]);
		rerender(<HsvColorPicker value="#00ff00" {...props} />);
		rerender(<HsvColorPicker value="#00ff00" {...props} />);
		expect(validity.mock.calls).toEqual([[false], [true]]);
	});

	describe("原生 form reset", () => {
		const field = () => screen.getByRole<HTMLInputElement>("textbox");
		const reset = (form: HTMLFormElement) =>
			act(async () => {
				form.reset();
			});
		const typeInvalid = () => {
			fireEvent.change(field(), { target: { value: "#112233" } });
			fireEvent.change(field(), { target: { value: "zz" } });
			fireEvent.blur(field());
			expect(field().getAttribute("aria-invalid")).toBe("true");
		};

		it("恢复当前受控颜色对应的 HEX、清错误并报告有效，不派发颜色更改也不回退旧值", async () => {
			const ref = createRef<HTMLInputElement>();
			const change = vi.fn();
			const validity = vi.fn();
			render(
				<form aria-label="颜色表单">
					<ControlledPicker
						onChange={change}
						onValidityChange={validity}
						hexInputProps={{ ref, name: "color" }}
					/>
				</form>,
			);
			typeInvalid();
			const calls = change.mock.calls.length;
			expect(validity).toHaveBeenLastCalledWith(false);
			await reset(screen.getByRole<HTMLFormElement>("form"));
			expect(field().value).toBe("112233");
			expect(field().getAttribute("aria-invalid")).not.toBe("true");
			expect(validity).toHaveBeenLastCalledWith(true);
			expect(change).toHaveBeenCalledTimes(calls);
			expect(ref.current).toBe(field());
			expect(new FormData(field().form as HTMLFormElement).get("color")).toBe("112233");
		});

		it("form 属性指向的外部表单 reset 也恢复，无关表单不受影响", async () => {
			const validity = vi.fn();
			render(
				<>
					<form id="paint" aria-label="外部" />
					<form aria-label="其他" />
					<ControlledPicker
						onValidityChange={validity}
						hexInputProps={{ form: "paint", name: "color" }}
					/>
				</>,
			);
			typeInvalid();
			await reset(screen.getByRole<HTMLFormElement>("form", { name: "其他" }));
			expect(field().getAttribute("aria-invalid")).toBe("true");
			expect(validity).toHaveBeenLastCalledWith(false);
			await reset(screen.getByRole<HTMLFormElement>("form", { name: "外部" }));
			expect(field().value).toBe("112233");
			expect(field().getAttribute("aria-invalid")).not.toBe("true");
			expect(validity).toHaveBeenLastCalledWith(true);
		});

		it("取消的 reset 保留草稿与错误，不通知宿主恢复", async () => {
			const validity = vi.fn();
			render(
				<form aria-label="颜色表单" onReset={(event) => event.preventDefault()}>
					<ControlledPicker onValidityChange={validity} />
				</form>,
			);
			typeInvalid();
			await reset(screen.getByRole<HTMLFormElement>("form"));
			expect(field().value).toBe("ZZ");
			expect(field().getAttribute("aria-invalid")).toBe("true");
			expect(validity).toHaveBeenLastCalledWith(false);
		});
	});
});

describe("ColorSwatch", () => {
	it("最近色优先、去重并读出传统色名；预设选择与恢复正文是独立动作", () => {
		const change = vi.fn();
		const clear = vi.fn();
		render(
			<ColorSwatch
				defaultOpen
				value="#2e4e9a"
				recentColors={["#2e4e9a", "#2E4E9A", "#123456"]}
				onChange={change}
				onClear={clear}
			/>,
		);
		const recent = screen.getByRole("group", { name: "最近使用" });
		expect(within(recent).getAllByRole("button")).toHaveLength(2);
		expect(
			within(recent).getByRole("button", { name: "靛蓝" }).getAttribute("aria-pressed"),
		).toBe("true");
		fireEvent.click(
			within(screen.getByRole("group", { name: "预设" })).getByRole("button", {
				name: "朱砂",
			}),
		);
		expect(change).toHaveBeenLastCalledWith("#c63c26");
		fireEvent.click(screen.getByRole("button", { name: /清除颜色/ }));
		expect(clear).toHaveBeenCalledOnce();
	});

	it("自定义默认不可聚焦，展开后 HEX 可编辑且不关闭面板", () => {
		render(<ColorSwatch defaultOpen onChange={vi.fn()} onClear={vi.fn()} />);
		expect(screen.queryByRole("textbox")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "自定义" }));
		const input = screen.getByRole("textbox") as HTMLInputElement;
		input.focus();
		expect(document.activeElement).toBe(input);
		fireEvent.change(input, { target: { value: "ABC" } });
		expect(screen.getByRole("dialog")).toBeTruthy();
	});
});
