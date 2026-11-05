import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef, type KeyboardEvent } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToggleGroup, ToggleGroupItem, ToggleGroupSeparator } from "../toggle-group";

afterEach(cleanup);

const pressed = (name: string) => screen.getByRole("button", { name }).getAttribute("aria-pressed");
const tabStops = () => screen.getAllByRole("button").filter((button) => button.tabIndex === 0);
const key = (name: string, k: string) =>
	fireEvent.keyDown(screen.getByRole("button", { name }), { key: k });

interface FormatProps {
	defaultValue?: string[];
	value?: string[];
	onValueChange?: (value: string[]) => void;
	orientation?: "horizontal" | "vertical";
	disabled?: boolean;
	onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
}

function Format(props: FormatProps = {}) {
	return (
		<ToggleGroup type="multiple" aria-label="文字格式" {...props}>
			<ToggleGroupItem value="bold" aria-label="加粗" />
			<ToggleGroupItem value="italic" aria-label="斜体" />
			<ToggleGroupItem value="underline" aria-label="下划线" />
		</ToggleGroup>
	);
}

interface AlignProps {
	defaultValue?: string;
	value?: string;
	onValueChange?: (value: string) => void;
}

function Align(props: AlignProps = {}) {
	return (
		<ToggleGroup type="single" aria-label="对齐" {...props}>
			<ToggleGroupItem value="left" aria-label="左对齐" />
			<ToggleGroupItem value="center" aria-label="居中" />
			<ToggleGroupItem value="right" aria-label="右对齐" />
		</ToggleGroup>
	);
}

describe("ToggleGroup 角色与名称", () => {
	it("默认是带名称的 group，每一项是带 aria-pressed 的原生按钮", () => {
		render(<Format />);
		expect(screen.getByRole("group", { name: "文字格式" })).toBeTruthy();
		for (const button of screen.getAllByRole("button")) {
			expect(button.tagName).toBe("BUTTON");
			expect(button.getAttribute("type")).toBe("button");
			expect(button.getAttribute("aria-pressed")).toBe("false");
		}
	});

	it("单选模式的每一项同样是按钮，而不是 radio", () => {
		render(<Align defaultValue="center" />);
		expect(screen.queryAllByRole("radio")).toHaveLength(0);
		expect(screen.getAllByRole("button")).toHaveLength(3);
		expect(pressed("居中")).toBe("true");
	});

	it("工具栏形态使用 role=toolbar 并声明方向", () => {
		const { rerender } = render(
			<ToggleGroup type="multiple" role="toolbar" aria-label="编辑工具">
				<ToggleGroupItem value="bold" aria-label="加粗" />
			</ToggleGroup>,
		);
		const toolbar = screen.getByRole("toolbar", { name: "编辑工具" });
		expect(toolbar.getAttribute("aria-orientation")).toBe("horizontal");
		rerender(
			<ToggleGroup
				type="multiple"
				role="toolbar"
				orientation="vertical"
				aria-label="编辑工具"
			>
				<ToggleGroupItem value="bold" aria-label="加粗" />
			</ToggleGroup>,
		);
		expect(toolbar.getAttribute("aria-orientation")).toBe("vertical");
	});

	it("可以用 aria-labelledby 命名", () => {
		render(
			<>
				<h2 id="title">列表显示</h2>
				<ToggleGroup type="multiple" aria-labelledby="title">
					<ToggleGroupItem value="summary">摘要</ToggleGroupItem>
				</ToggleGroup>
			</>,
		);
		expect(screen.getByRole("group", { name: "列表显示" })).toBeTruthy();
	});

	it("只有图标的项用 aria-label 命名，带文字的项由文字命名", () => {
		render(
			<ToggleGroup type="multiple" aria-label="显示">
				<ToggleGroupItem value="bold" aria-label="加粗">
					<svg data-testid="icon" />
				</ToggleGroupItem>
				<ToggleGroupItem value="summary">摘要</ToggleGroupItem>
			</ToggleGroup>,
		);
		expect(screen.getByRole("button", { name: "加粗" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "摘要" })).toBeTruthy();
	});

	it("保留原生属性与 ref", () => {
		const groupRef = createRef<HTMLDivElement>();
		const itemRef = createRef<HTMLButtonElement>();
		render(
			<ToggleGroup
				type="multiple"
				aria-label="格式"
				ref={groupRef}
				id="fmt"
				data-testid="group"
				className="custom"
			>
				<ToggleGroupItem value="bold" aria-label="加粗" ref={itemRef} data-testid="item" />
			</ToggleGroup>,
		);
		expect(groupRef.current).toBe(screen.getByTestId("group"));
		expect(groupRef.current?.id).toBe("fmt");
		expect(groupRef.current?.classList.contains("custom")).toBe(true);
		expect(itemRef.current).toBe(screen.getByTestId("item"));
	});

	it("分隔符是纯装饰：不进入无障碍树，也不能聚焦", () => {
		render(
			<ToggleGroup type="multiple" role="toolbar" aria-label="编辑工具">
				<ToggleGroupItem value="bold" aria-label="加粗" />
				<ToggleGroupSeparator data-testid="gap" />
				<ToggleGroupItem value="code" aria-label="代码" />
			</ToggleGroup>,
		);
		const gap = screen.getByTestId("gap");
		expect(gap.getAttribute("aria-hidden")).toBe("true");
		expect(gap.tabIndex).toBeLessThan(0);
		expect(screen.getAllByRole("button")).toHaveLength(2);
	});

	it("服务端渲染可用，输出带 aria-pressed 的按钮", () => {
		const html = renderToString(<Align defaultValue="left" />);
		expect(html).toContain('aria-pressed="true"');
		expect(html).toContain("左对齐");
	});

	it("在 ToggleGroup 外使用 ToggleGroupItem 会报错", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(() => render(<ToggleGroupItem value="a" aria-label="甲" />)).toThrow();
		error.mockRestore();
	});
});

describe("多选", () => {
	it("每项各自按下与抬起，可以同时按下多个", () => {
		render(<Format />);
		fireEvent.click(screen.getByRole("button", { name: "加粗" }));
		fireEvent.click(screen.getByRole("button", { name: "斜体" }));
		expect(pressed("加粗")).toBe("true");
		expect(pressed("斜体")).toBe("true");
		expect(pressed("下划线")).toBe("false");
		fireEvent.click(screen.getByRole("button", { name: "加粗" }));
		expect(pressed("加粗")).toBe("false");
		expect(pressed("斜体")).toBe("true");
	});

	it("defaultValue 决定初始按下的项", () => {
		render(<Format defaultValue={["italic", "underline"]} />);
		expect(pressed("加粗")).toBe("false");
		expect(pressed("斜体")).toBe("true");
		expect(pressed("下划线")).toBe("true");
	});

	it("onValueChange 收到变更后的完整数组", () => {
		const onValueChange = vi.fn();
		render(<Format defaultValue={["bold"]} onValueChange={onValueChange} />);
		fireEvent.click(screen.getByRole("button", { name: "斜体" }));
		expect(onValueChange).toHaveBeenLastCalledWith(["bold", "italic"]);
		fireEvent.click(screen.getByRole("button", { name: "加粗" }));
		expect(onValueChange).toHaveBeenLastCalledWith(["italic"]);
		fireEvent.click(screen.getByRole("button", { name: "斜体" }));
		expect(onValueChange).toHaveBeenLastCalledWith([]);
	});
});

describe("单选可取消", () => {
	it("最多一个按下：选中、换成另一个、再点已按下的回到都不选", () => {
		render(<Align />);
		fireEvent.click(screen.getByRole("button", { name: "左对齐" }));
		expect(pressed("左对齐")).toBe("true");
		fireEvent.click(screen.getByRole("button", { name: "居中" }));
		expect(pressed("左对齐")).toBe("false");
		expect(pressed("居中")).toBe("true");
		fireEvent.click(screen.getByRole("button", { name: "居中" }));
		for (const name of ["左对齐", "居中", "右对齐"]) expect(pressed(name)).toBe("false");
	});

	it("onValueChange 收到字符串，取消时是空字符串", () => {
		const onValueChange = vi.fn();
		render(<Align onValueChange={onValueChange} />);
		fireEvent.click(screen.getByRole("button", { name: "居中" }));
		expect(onValueChange).toHaveBeenLastCalledWith("center");
		fireEvent.click(screen.getByRole("button", { name: "右对齐" }));
		expect(onValueChange).toHaveBeenLastCalledWith("right");
		fireEvent.click(screen.getByRole("button", { name: "右对齐" }));
		expect(onValueChange).toHaveBeenLastCalledWith("");
	});

	it("空字符串的受控值表示都不选", () => {
		render(<Align value="" />);
		for (const name of ["左对齐", "居中", "右对齐"]) expect(pressed(name)).toBe("false");
	});
});

describe("受控与非受控", () => {
	it("受控时只由 value 决定，点击只上报意图", () => {
		const onValueChange = vi.fn();
		const { rerender } = render(<Align value="left" onValueChange={onValueChange} />);
		fireEvent.click(screen.getByRole("button", { name: "右对齐" }));
		expect(onValueChange).toHaveBeenCalledExactlyOnceWith("right");
		expect(pressed("左对齐")).toBe("true");
		expect(pressed("右对齐")).toBe("false");
		rerender(<Align value="right" onValueChange={onValueChange} />);
		expect(pressed("右对齐")).toBe("true");
		expect(pressed("左对齐")).toBe("false");
	});

	it("多选受控同理", () => {
		const onValueChange = vi.fn();
		const { rerender } = render(<Format value={["bold"]} onValueChange={onValueChange} />);
		fireEvent.click(screen.getByRole("button", { name: "斜体" }));
		expect(onValueChange).toHaveBeenCalledExactlyOnceWith(["bold", "italic"]);
		expect(pressed("斜体")).toBe("false");
		rerender(<Format value={["bold", "italic"]} onValueChange={onValueChange} />);
		expect(pressed("斜体")).toBe("true");
	});

	it("非受控时省略 onValueChange 也能正常切换", () => {
		render(<Align />);
		fireEvent.click(screen.getByRole("button", { name: "居中" }));
		expect(pressed("居中")).toBe("true");
	});
});

describe("禁用", () => {
	it("整组禁用：所有项不可用，点击不触发回调也不改变状态", () => {
		const onValueChange = vi.fn();
		render(<Format disabled defaultValue={["bold"]} onValueChange={onValueChange} />);
		for (const button of screen.getAllByRole("button")) {
			expect((button as HTMLButtonElement).disabled).toBe(true);
			fireEvent.click(button);
		}
		expect(onValueChange).not.toHaveBeenCalled();
		expect(pressed("加粗")).toBe("true");
	});

	it("单项禁用只影响该项", () => {
		const onValueChange = vi.fn();
		render(
			<ToggleGroup type="multiple" aria-label="格式" onValueChange={onValueChange}>
				<ToggleGroupItem value="bold" aria-label="加粗" disabled />
				<ToggleGroupItem value="italic" aria-label="斜体" />
			</ToggleGroup>,
		);
		fireEvent.click(screen.getByRole("button", { name: "加粗" }));
		expect(onValueChange).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "斜体" }));
		expect(onValueChange).toHaveBeenCalledExactlyOnceWith(["italic"]);
	});

	it("项上的 onClick 调用 preventDefault 可以取消切换", () => {
		render(
			<ToggleGroup type="multiple" aria-label="格式">
				<ToggleGroupItem
					value="bold"
					aria-label="加粗"
					onClick={(event) => event.preventDefault()}
				/>
			</ToggleGroup>,
		);
		fireEvent.click(screen.getByRole("button", { name: "加粗" }));
		expect(pressed("加粗")).toBe("false");
	});
});

describe("漫游焦点", () => {
	it("整组只有一个 Tab 位置：没有按下的项时是第一个启用项", () => {
		render(<Format />);
		expect(tabStops().map((button) => button.getAttribute("aria-label"))).toEqual(["加粗"]);
	});

	it("有按下的项时，Tab 位置是第一个按下的启用项", () => {
		render(<Format defaultValue={["underline", "italic"]} />);
		expect(tabStops().map((button) => button.getAttribute("aria-label"))).toEqual(["斜体"]);
	});

	it("跳过禁用项来确定 Tab 位置", () => {
		render(
			<ToggleGroup type="multiple" aria-label="格式">
				<ToggleGroupItem value="bold" aria-label="加粗" disabled />
				<ToggleGroupItem value="italic" aria-label="斜体" />
			</ToggleGroup>,
		);
		expect(tabStops().map((button) => button.getAttribute("aria-label"))).toEqual(["斜体"]);
	});

	it("→ ← 移动焦点，不改变按下状态，Tab 位置跟随焦点", () => {
		const onValueChange = vi.fn();
		render(<Format onValueChange={onValueChange} defaultValue={["bold"]} />);
		screen.getByRole("button", { name: "加粗" }).focus();
		key("加粗", "ArrowRight");
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "斜体" }));
		expect(tabStops().map((button) => button.getAttribute("aria-label"))).toEqual(["斜体"]);
		key("斜体", "ArrowLeft");
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "加粗" }));
		expect(onValueChange).not.toHaveBeenCalled();
		expect(pressed("加粗")).toBe("true");
		expect(pressed("斜体")).toBe("false");
	});

	it("焦点在两端时首尾相接", () => {
		render(<Format />);
		screen.getByRole("button", { name: "加粗" }).focus();
		key("加粗", "ArrowLeft");
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "下划线" }));
		key("下划线", "ArrowRight");
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "加粗" }));
	});

	it("Home / End 跳到第一个与最后一个启用项", () => {
		render(
			<ToggleGroup type="multiple" aria-label="格式">
				<ToggleGroupItem value="a" aria-label="甲" disabled />
				<ToggleGroupItem value="b" aria-label="乙" />
				<ToggleGroupItem value="c" aria-label="丙" />
				<ToggleGroupItem value="d" aria-label="丁" disabled />
			</ToggleGroup>,
		);
		screen.getByRole("button", { name: "乙" }).focus();
		key("乙", "End");
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "丙" }));
		key("丙", "Home");
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "乙" }));
	});

	it("方向键跳过禁用项", () => {
		render(
			<ToggleGroup type="multiple" aria-label="格式">
				<ToggleGroupItem value="a" aria-label="甲" />
				<ToggleGroupItem value="b" aria-label="乙" disabled />
				<ToggleGroupItem value="c" aria-label="丙" />
			</ToggleGroup>,
		);
		screen.getByRole("button", { name: "甲" }).focus();
		key("甲", "ArrowRight");
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "丙" }));
	});

	it("横向时 ↑ ↓ 不移动焦点；竖向时 ↑ ↓ 移动而 ← → 不动", () => {
		const { rerender } = render(<Format />);
		screen.getByRole("button", { name: "加粗" }).focus();
		key("加粗", "ArrowDown");
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "加粗" }));

		rerender(<Format orientation="vertical" />);
		key("加粗", "ArrowRight");
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "加粗" }));
		key("加粗", "ArrowDown");
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "斜体" }));
		key("斜体", "ArrowUp");
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "加粗" }));
	});

	it("带修饰键的方向键不被组件拦截", () => {
		render(<Format />);
		screen.getByRole("button", { name: "加粗" }).focus();
		fireEvent.keyDown(screen.getByRole("button", { name: "加粗" }), {
			key: "ArrowRight",
			altKey: true,
		});
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "加粗" }));
	});

	it("方向键切换焦点后，再按下的是当前焦点项", () => {
		render(<Align />);
		screen.getByRole("button", { name: "左对齐" }).focus();
		key("左对齐", "ArrowRight");
		fireEvent.click(document.activeElement as HTMLElement);
		expect(pressed("居中")).toBe("true");
		expect(pressed("左对齐")).toBe("false");
	});

	it("项被禁用后，Tab 位置回到仍可用的项", () => {
		const { rerender } = render(
			<ToggleGroup type="multiple" aria-label="格式">
				<ToggleGroupItem value="a" aria-label="甲" />
				<ToggleGroupItem value="b" aria-label="乙" />
			</ToggleGroup>,
		);
		act(() => {
			screen.getByRole("button", { name: "乙" }).focus();
		});
		expect(tabStops().map((button) => button.getAttribute("aria-label"))).toEqual(["乙"]);
		rerender(
			<ToggleGroup type="multiple" aria-label="格式">
				<ToggleGroupItem value="a" aria-label="甲" />
				<ToggleGroupItem value="b" aria-label="乙" disabled />
			</ToggleGroup>,
		);
		expect(tabStops().map((button) => button.getAttribute("aria-label"))).toEqual(["甲"]);
	});

	it("使用者的 onKeyDown 先执行，preventDefault 后组件不再移动焦点", () => {
		render(<Format onKeyDown={(event: React.KeyboardEvent) => event.preventDefault()} />);
		screen.getByRole("button", { name: "加粗" }).focus();
		key("加粗", "ArrowRight");
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "加粗" }));
	});
});
