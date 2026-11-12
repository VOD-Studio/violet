import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Field, FieldSummary } from "../../field";
import { Slider } from "../slider";

function key(element: HTMLElement, name: string, shiftKey = false) {
	fireEvent.keyDown(element, { key: name, shiftKey });
}

function pointer(element: HTMLElement, type: string, x: number) {
	const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, button: 0 });
	Object.defineProperty(event, "pointerId", { value: 1 });
	Object.defineProperty(event, "pointerType", { value: "touch" });
	fireEvent(element, event);
}

function geometry(root: HTMLSpanElement) {
	vi.spyOn(root, "getBoundingClientRect").mockReturnValue({
		left: 0,
		right: 100,
		top: 0,
		bottom: 28,
		width: 100,
		height: 28,
		x: 0,
		y: 0,
		toJSON() {},
	});
	for (const element of [root, ...root.querySelectorAll<HTMLElement>("span")]) {
		const captures = new Set<number>();
		Object.defineProperties(element, {
			setPointerCapture: { configurable: true, value: (id: number) => captures.add(id) },
			hasPointerCapture: { configurable: true, value: (id: number) => captures.has(id) },
			releasePointerCapture: {
				configurable: true,
				value: (id: number) => captures.delete(id),
			},
		});
	}
}

const marks = [
	{ value: 0, label: "无" },
	{ value: 13, label: "少" },
	{ value: 55, label: "适中" },
	{ value: 100, label: "满" },
];

describe("Slider", () => {
	it("按方向键逐步、Shift十步、Page按范围10%调节，保留小数边界", () => {
		render(
			<Slider
				aria-label="字号"
				min={10}
				max={30}
				step={0.5}
				defaultValue={[16]}
				formatValue={(value) => `${value} 像素`}
			/>,
		);
		const thumb = screen.getByRole("slider", { name: "字号" });
		key(thumb, "ArrowUp");
		expect(thumb.getAttribute("aria-valuetext")).toBe("16.5 像素");
		key(thumb, "ArrowRight", true);
		expect(thumb.getAttribute("aria-valuenow")).toBe("21.5");
		key(thumb, "PageDown");
		expect(thumb.getAttribute("aria-valuenow")).toBe("19.5");
		key(thumb, "ArrowDown");
		key(thumb, "ArrowLeft");
		expect(thumb.getAttribute("aria-valuenow")).toBe("18.5");
		key(thumb, "End");
		key(thumb, "PageUp");
		expect(thumb.getAttribute("aria-valuenow")).toBe("30");
		key(thumb, "Home");
		expect(thumb.getAttribute("aria-valuenow")).toBe("10");
	});

	it("两个滑钮分别命名；当前滑钮Home/End不交换身份且不能越过对方", () => {
		render(
			<Slider
				aria-label="阅读时长"
				min={1}
				max={60}
				defaultValue={[5, 20]}
				formatValue={(value) => `${value} 分钟`}
			/>,
		);
		const start = screen.getByRole("slider", { name: "阅读时长 起点" });
		const end = screen.getByRole("slider", { name: "阅读时长 终点" });
		key(start, "End");
		expect(start.getAttribute("aria-valuenow")).toBe("20");
		expect(end.getAttribute("aria-valuenow")).toBe("20");
		key(start, "Home");
		key(end, "Home");
		expect(start.getAttribute("aria-valuenow")).toBe("1");
		expect(end.getAttribute("aria-valuenow")).toBe("1");
		key(end, "End");
		expect(end.getAttribute("aria-valuenow")).toBe("60");
		expect(start.getAttribute("aria-valuemax")).toBe("60");
		expect(end.getAttribute("aria-valuemin")).toBe("1");
	});

	it("不等距且不与step对齐的刻度吸附，方向键按档位前进", () => {
		render(<Slider aria-label="装饰密度" step={10} marks={marks} defaultValue={[10]} />);
		const thumb = screen.getByRole("slider", { name: "装饰密度" });
		expect(thumb.getAttribute("aria-valuenow")).toBe("13");
		key(thumb, "ArrowRight");
		expect(thumb.getAttribute("aria-valuenow")).toBe("55");
		key(thumb, "ArrowLeft");
		expect(thumb.getAttribute("aria-valuenow")).toBe("13");
		key(thumb, "ArrowRight", true);
		expect(thumb.getAttribute("aria-valuenow")).toBe("100");
	});

	it("点击轨道吸附后继续触屏拖动，提交回调只在松手发出", () => {
		const root = createRef<HTMLSpanElement>();
		const commit = vi.fn();
		render(
			<Slider
				ref={root}
				aria-label="密度"
				marks={marks}
				step={10}
				defaultValue={[0]}
				onValueCommit={commit}
			/>,
		);
		geometry(root.current as HTMLSpanElement);
		pointer(root.current as HTMLSpanElement, "pointerdown", 47);
		const thumb = screen.getByRole("slider", { name: "密度" });
		expect(thumb.getAttribute("aria-valuenow")).toBe("55");
		expect(commit).not.toHaveBeenCalled();
		pointer(root.current as HTMLSpanElement, "pointermove", 12);
		expect(thumb.getAttribute("aria-valuenow")).toBe("13");
		pointer(root.current as HTMLSpanElement, "pointerup", 12);
		expect(commit).toHaveBeenCalledExactlyOnceWith([13]);
	});

	it("拖动起点穿过终点时停在终点，反向拖回仍控制起点", () => {
		const root = createRef<HTMLSpanElement>();
		render(<Slider ref={root} aria-label="价格" defaultValue={[20, 60]} />);
		geometry(root.current as HTMLSpanElement);
		const start = screen.getByRole("slider", { name: "价格 起点" });
		const end = screen.getByRole("slider", { name: "价格 终点" });
		pointer(start, "pointerdown", 20);
		pointer(start, "pointermove", 90);
		expect(start.getAttribute("aria-valuenow")).toBe("60");
		expect(end.getAttribute("aria-valuenow")).toBe("60");
		expect(document.activeElement).toBe(start);
		pointer(start, "pointermove", 30);
		pointer(start, "pointerup", 30);
		expect(start.getAttribute("aria-valuenow")).toBe("30");
		expect(end.getAttribute("aria-valuenow")).toBe("60");
	});

	it("受控值只提出变更请求；宿主更新后同步可见值与提交值", () => {
		const change = vi.fn();
		const { rerender } = render(
			<form aria-label="设置">
				<Slider aria-label="音量" name="volume" value={[40]} onValueChange={change} />
			</form>,
		);
		const thumb = screen.getByRole("slider", { name: "音量" });
		const form = screen.getByRole("form", { name: "设置" }) as HTMLFormElement;
		key(thumb, "ArrowRight");
		expect(change).toHaveBeenCalledExactlyOnceWith([41]);
		expect(thumb.getAttribute("aria-valuenow")).toBe("40");
		expect(new FormData(form).get("volume")).toBe("40");
		rerender(
			<form aria-label="设置">
				<Slider aria-label="音量" name="volume" value={[75]} onValueChange={change} />
			</form>,
		);
		expect(thumb.getAttribute("aria-valuenow")).toBe("75");
		expect(new FormData(form).get("volume")).toBe("75");
	});

	it("命名区间原生提交两个值，reset恢复挂载初值并尊重取消", async () => {
		const cancel = vi.fn((event: React.FormEvent) => event.preventDefault());
		const { rerender } = render(
			<form aria-label="筛选">
				<Slider aria-label="范围" name="duration" defaultValue={[5, 20]} />
			</form>,
		);
		const form = screen.getByRole("form", { name: "筛选" }) as HTMLFormElement;
		const start = screen.getByRole("slider", { name: "范围 起点" });
		key(start, "ArrowRight");
		expect(new FormData(form).getAll("duration[]")).toEqual(["6", "20"]);
		await act(async () => form.reset());
		expect(new FormData(form).getAll("duration[]")).toEqual(["5", "20"]);
		rerender(
			<form aria-label="筛选" onReset={cancel}>
				<Slider aria-label="范围" name="duration" defaultValue={[5, 20]} />
			</form>,
		);
		key(start, "ArrowRight");
		await act(async () => form.reset());
		expect(new FormData(form).getAll("duration[]")).toEqual(["6", "20"]);
	});

	it("外部form归属、禁用省略提交、受控reset保持宿主值", async () => {
		const { rerender } = render(
			<>
				<form id="settings" aria-label="设置" />
				<Slider form="settings" aria-label="缩放" name="zoom" value={[70]} />
			</>,
		);
		const form = screen.getByRole("form", { name: "设置" }) as HTMLFormElement;
		await act(async () => form.reset());
		expect(new FormData(form).get("zoom")).toBe("70");
		rerender(
			<>
				<form id="settings" aria-label="设置" />
				<Slider form="settings" aria-label="缩放" name="zoom" value={[70]} disabled />
			</>,
		);
		expect(new FormData(form).has("zoom")).toBe(false);
	});

	it("禁用不进入Tab且忽略操作；只读可聚焦但不改值", () => {
		const change = vi.fn();
		const { rerender } = render(
			<Slider aria-label="音量" defaultValue={[40]} disabled onValueChange={change} />,
		);
		const thumb = screen.getByRole("slider", { name: "音量" });
		expect(thumb.tabIndex).toBe(-1);
		key(thumb, "End");
		expect(change).not.toHaveBeenCalled();
		rerender(<Slider aria-label="音量" defaultValue={[40]} readOnly onValueChange={change} />);
		thumb.focus();
		key(thumb, "End");
		expect(document.activeElement).toBe(thumb);
		expect(thumb.getAttribute("aria-readonly")).toBe("true");
		expect(thumb.getAttribute("aria-valuenow")).toBe("40");
		expect(change).not.toHaveBeenCalled();
	});

	it("调用方preventDefault取消键盘与轨道的内部动作", () => {
		const root = createRef<HTMLSpanElement>();
		const change = vi.fn();
		render(
			<Slider
				ref={root}
				aria-label="音量"
				defaultValue={[40]}
				onValueChange={change}
				onKeyDown={(event) => event.preventDefault()}
				onPointerDown={(event) => event.preventDefault()}
			/>,
		);
		geometry(root.current as HTMLSpanElement);
		const thumb = screen.getByRole("slider", { name: "音量" });
		key(thumb, "End");
		pointer(root.current as HTMLSpanElement, "pointerdown", 90);
		expect(thumb.getAttribute("aria-valuenow")).toBe("40");
		expect(change).not.toHaveBeenCalled();
	});

	it("标签关联、独立滑钮名称和错误说明保留在每个可聚焦控件", () => {
		render(
			<>
				<span id="duration-label">阅读时长</span>
				<p id="duration-error">请选择较短的区间</p>
				<Slider
					aria-labelledby="duration-label"
					aria-describedby="duration-error"
					invalid
					thumbLabels={["最少", "最多"]}
					defaultValue={[5, 20]}
				/>
			</>,
		);
		for (const label of ["阅读时长 最少", "阅读时长 最多"]) {
			const thumb = screen.getByRole("slider", { name: label });
			expect(thumb.getAttribute("aria-describedby")).toBe("duration-error");
			expect(thumb.getAttribute("aria-invalid")).toBe("true");
		}
	});

	it("在Field内未显式命名单值时，使用Field标签并关联实际错误说明", () => {
		render(
			<Field label="正文字号" error="请选择较小字号">
				<Slider defaultValue={[16]} />
			</Field>,
		);
		const thumb = screen.getByRole("slider", { name: "正文字号" });
		const error = screen.getByText("请选择较小字号").parentElement as HTMLElement;
		expect(thumb.getAttribute("aria-describedby")?.split(" ")).toContain(error.id);
		expect(thumb.getAttribute("aria-invalid")).toBe("true");
	});

	it("Field名称同时命名区间的两个滑钮，错误说明分别接线", () => {
		render(
			<Field label="阅读时长" error="区间太长">
				<Slider defaultValue={[5, 20]} />
			</Field>,
		);
		const error = screen.getByText("区间太长").parentElement as HTMLElement;
		for (const name of ["阅读时长 起点", "阅读时长 终点"]) {
			const thumb = screen.getByRole("slider", { name });
			expect(thumb.getAttribute("aria-describedby")?.split(" ")).toContain(error.id);
			expect(thumb.getAttribute("aria-invalid")).toBe("true");
		}
	});

	it("显式名称和invalid优先，描述与Field消息合并且不重复", () => {
		render(
			<>
				<p id="unit-note">单位为像素</p>
				<Field label="显示设置" error="建议使用较小字号">
					<Slider
						aria-label="编辑器字号"
						aria-describedby="unit-note"
						invalid={false}
						defaultValue={[16]}
					/>
				</Field>
			</>,
		);
		const thumb = screen.getByRole("slider", { name: "编辑器字号" });
		const error = screen.getByText("建议使用较小字号").parentElement as HTMLElement;
		const descriptions = thumb.getAttribute("aria-describedby")?.split(" ") ?? [];
		expect(descriptions).toContain("unit-note");
		expect(descriptions).toContain(error.id);
		expect(descriptions.filter((id) => id === error.id)).toHaveLength(1);
		expect(thumb.getAttribute("aria-invalid")).toBe("false");
	});

	it("错误汇总按 Field 控件 ID 把焦点移进滑钮，Field 外 id 仍留在轨道根", () => {
		const root = createRef<HTMLSpanElement>();
		render(
			<>
				<FieldSummary errors={[{ id: "volume", label: "音量" }]} />
				<Field label="音量" error="音量过大">
					<Slider id="volume" defaultValue={[40]} />
				</Field>
				<Slider ref={root} id="standalone" aria-label="独立" defaultValue={[10]} />
			</>,
		);
		fireEvent.click(screen.getByRole("button", { name: "音量" }));
		expect(document.activeElement).toBe(screen.getByRole("slider", { name: "音量" }));
		expect(document.getElementById("volume")).toBe(
			screen.getByRole("slider", { name: "音量" }),
		);
		expect(root.current?.id).toBe("standalone");
	});

	it("精准输入和滑块受控组合共享真实数字状态", () => {
		function Harness() {
			const [value, setValue] = useState([70]);
			return (
				<>
					<Slider aria-label="不透明度" value={value} onValueChange={setValue} />
					<input
						aria-label="精准数值"
						type="number"
						value={value[0]}
						onChange={(event) => setValue([event.target.valueAsNumber])}
					/>
				</>
			);
		}
		render(<Harness />);
		const thumb = screen.getByRole("slider", { name: "不透明度" });
		const input = screen.getByRole("spinbutton", { name: "精准数值" }) as HTMLInputElement;
		fireEvent.change(input, { target: { value: "80" } });
		expect(thumb.getAttribute("aria-valuenow")).toBe("80");
		key(thumb, "ArrowLeft");
		expect(input.value).toBe("79");
	});
});
