import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Radio, RadioGroup } from "../radio";

function Visibility(props: Partial<React.ComponentProps<typeof RadioGroup>>) {
	return (
		<RadioGroup legend="可见范围" {...props}>
			<Radio value="pub" label="公开" />
			<Radio value="login" label="仅登录可见" />
			<Radio value="me" label="仅自己" />
		</RadioGroup>
	);
}

describe("RadioGroup 语义", () => {
	it("legend 为分组命名，选项是同名的原生 radio，各自以 label 命名", () => {
		render(<Visibility defaultValue="pub" />);
		const group = screen.getByRole("group", { name: "可见范围" });
		expect(group.tagName).toBe("FIELDSET");
		const radios = screen.getAllByRole("radio") as HTMLInputElement[];
		expect(radios.map((radio) => radio.type)).toEqual(["radio", "radio", "radio"]);
		expect(new Set(radios.map((radio) => radio.name)).size).toBe(1);
		expect(radios[0]?.name).not.toBe("");
		for (const name of ["公开", "仅登录可见", "仅自己"]) {
			expect(group.contains(screen.getByRole("radio", { name }))).toBe(true);
		}
	});

	it("未传 name 时每组各自生成不同的 name，传入时原样使用", () => {
		render(
			<>
				<Visibility />
				<RadioGroup legend="排序" name="sort">
					<Radio value="new" label="最新" />
				</RadioGroup>
			</>,
		);
		const names = (screen.getAllByRole("radio") as HTMLInputElement[]).map(
			(radio) => radio.name,
		);
		expect(names[0]).toBe(names[1]);
		expect(names[0]).not.toBe(names[3]);
		expect(names[3]).toBe("sort");
	});

	it("保留 fieldset 的原生属性并把 ref 交给 fieldset", () => {
		const ref = createRef<HTMLFieldSetElement>();
		render(<Visibility ref={ref} id="vis" data-testid="vis" />);
		expect(ref.current).toBe(screen.getByTestId("vis"));
		expect(ref.current?.tagName).toBe("FIELDSET");
		expect(ref.current?.id).toBe("vis");
	});

	it("没有 RadioGroup 时单独渲染 Radio 直接报错", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(() => render(<Radio value="a" label="A" />)).toThrow();
		error.mockRestore();
	});
});

describe("选择", () => {
	it("defaultValue 决定初始选中，点击换选并让旧项取消", () => {
		render(<Visibility defaultValue="login" />);
		const radio = (name: string) => screen.getByRole("radio", { name }) as HTMLInputElement;
		expect(radio("仅登录可见").checked).toBe(true);
		fireEvent.click(radio("仅自己"));
		expect(radio("仅自己").checked).toBe(true);
		expect(radio("仅登录可见").checked).toBe(false);
	});

	it("点击整行文字也能选中", () => {
		render(<Visibility defaultValue="pub" />);
		fireEvent.click(screen.getByText("仅自己"));
		expect((screen.getByRole("radio", { name: "仅自己" }) as HTMLInputElement).checked).toBe(
			true,
		);
	});

	it("onValueChange 只在选中值真正变化时以所选 value 触发", () => {
		const change = vi.fn();
		render(<Visibility defaultValue="pub" onValueChange={change} />);
		fireEvent.click(screen.getByRole("radio", { name: "公开" }));
		expect(change).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("radio", { name: "仅自己" }));
		expect(change).toHaveBeenCalledTimes(1);
		expect(change).toHaveBeenCalledWith("me");
		fireEvent.click(screen.getByRole("radio", { name: "仅自己" }));
		expect(change).toHaveBeenCalledTimes(1);
	});

	it("单个 Radio 的 onChange 仍然收到原生事件", () => {
		const change = vi.fn();
		render(
			<RadioGroup legend="排序" defaultValue="new">
				<Radio value="new" label="最新" />
				<Radio value="hot" label="最热" onChange={change} />
			</RadioGroup>,
		);
		fireEvent.click(screen.getByRole("radio", { name: "最热" }));
		expect(change).toHaveBeenCalledTimes(1);
		expect(change.mock.calls[0]?.[0].target).toBe(screen.getByRole("radio", { name: "最热" }));
	});

	it("没有默认值时全部未选，选中后不能回到全不选", () => {
		render(<Visibility />);
		const radios = screen.getAllByRole("radio") as HTMLInputElement[];
		expect(radios.some((radio) => radio.checked)).toBe(false);
		fireEvent.click(radios[1] as HTMLInputElement);
		fireEvent.click(radios[1] as HTMLInputElement);
		expect(radios[1]?.checked).toBe(true);
	});
});

describe("受控", () => {
	function Controlled({ onValueChange }: { onValueChange?: (value: string) => void }) {
		const [value, setValue] = useState("pub");
		return (
			<Visibility
				value={value}
				onValueChange={(next) => {
					onValueChange?.(next);
					setValue(next);
				}}
			/>
		);
	}

	it("选中跟随调用方的值", () => {
		const change = vi.fn();
		render(<Controlled onValueChange={change} />);
		fireEvent.click(screen.getByRole("radio", { name: "仅登录可见" }));
		expect(change).toHaveBeenCalledWith("login");
		expect(
			(screen.getByRole("radio", { name: "仅登录可见" }) as HTMLInputElement).checked,
		).toBe(true);
		expect((screen.getByRole("radio", { name: "公开" }) as HTMLInputElement).checked).toBe(
			false,
		);
	});

	it("调用方不接受变更时选中保持不动", () => {
		const change = vi.fn();
		render(<Visibility value="pub" onValueChange={change} />);
		fireEvent.click(screen.getByRole("radio", { name: "仅自己" }));
		expect(change).toHaveBeenCalledWith("me");
		expect((screen.getByRole("radio", { name: "公开" }) as HTMLInputElement).checked).toBe(
			true,
		);
		expect((screen.getByRole("radio", { name: "仅自己" }) as HTMLInputElement).checked).toBe(
			false,
		);
	});

	it("调用方改 value 时重新选中，且不触发 onValueChange", () => {
		const change = vi.fn();
		const { rerender } = render(<Visibility value="pub" onValueChange={change} />);
		rerender(<Visibility value="me" onValueChange={change} />);
		expect((screen.getByRole("radio", { name: "仅自己" }) as HTMLInputElement).checked).toBe(
			true,
		);
		expect(change).not.toHaveBeenCalled();
	});
});

describe("说明与引用", () => {
	it("description 通过 aria-describedby 关联，且不并入可访问名称", () => {
		render(
			<RadioGroup legend="谁可以评论" defaultValue="all">
				<Radio value="all" label="所有人" description="登录后即可评论" />
				<Radio value="off" label="关闭评论" />
			</RadioGroup>,
		);
		const all = screen.getByRole("radio", { name: "所有人" });
		expect(all.getAttribute("aria-describedby")).not.toBeNull();
		expect(screen.getByRole("radio", { name: "所有人", description: "登录后即可评论" })).toBe(
			all,
		);
		expect(
			screen.getByRole("radio", { name: "关闭评论" }).hasAttribute("aria-describedby"),
		).toBe(false);
	});

	it("调用方的 aria-describedby 与说明合并", () => {
		render(
			<>
				<p id="extra">补充提示</p>
				<RadioGroup legend="谁可以评论" defaultValue="all">
					<Radio
						value="all"
						label="所有人"
						description="登录后即可评论"
						aria-describedby="extra"
					/>
				</RadioGroup>
			</>,
		);
		expect(
			screen.getByRole("radio", { name: "所有人", description: "补充提示 登录后即可评论" }),
		).toBeTruthy();
	});

	it("调用方给出 aria-label 时以它命名", () => {
		render(
			<RadioGroup legend="排序" defaultValue="new">
				<Radio value="new" label="新" aria-label="最新发布" />
			</RadioGroup>,
		);
		expect(screen.getByRole("radio", { name: "最新发布" })).toBeTruthy();
	});

	it("ref 指向原生 input，其余原生属性也落在 input 上", () => {
		const ref = createRef<HTMLInputElement>();
		render(
			<RadioGroup legend="排序" defaultValue="new">
				<Radio ref={ref} value="new" label="最新" id="r-new" data-testid="r" />
			</RadioGroup>,
		);
		expect(ref.current).toBe(screen.getByRole("radio"));
		expect(ref.current?.id).toBe("r-new");
		expect(screen.getByTestId("r")).toBe(ref.current);
	});

	it("className 与 style 落在整行根节点而不是不可见的 input", () => {
		render(
			<RadioGroup legend="排序" defaultValue="new">
				<Radio value="new" label="最新" className="mine" style={{ opacity: 0.9 }} />
			</RadioGroup>,
		);
		const radio = screen.getByRole("radio");
		const root = radio.closest("label");
		expect(root?.classList.contains("mine")).toBe(true);
		expect(root?.style.opacity).toBe("0.9");
		expect(radio.classList.contains("mine")).toBe(false);
	});
});

describe("禁用", () => {
	it("禁用的选项不可点选，其余照常", () => {
		const change = vi.fn();
		render(
			<RadioGroup legend="发布" defaultValue="now" onValueChange={change}>
				<Radio value="now" label="立即发布" />
				<Radio value="later" label="定时发布" disabled />
				<Radio value="draft" label="存为草稿" />
			</RadioGroup>,
		);
		const later = screen.getByRole("radio", { name: "定时发布" }) as HTMLInputElement;
		expect(later.disabled).toBe(true);
		fireEvent.click(later);
		expect(later.checked).toBe(false);
		expect(change).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("radio", { name: "存为草稿" }));
		expect(change).toHaveBeenCalledWith("draft");
	});

	it("整组禁用时 fieldset 禁用，所有选项不可点选", () => {
		const change = vi.fn();
		render(<Visibility defaultValue="pub" disabled onValueChange={change} />);
		const group = screen.getByRole("group", { name: "可见范围" }) as HTMLFieldSetElement;
		expect(group.disabled).toBe(true);
		const me = screen.getByRole("radio", { name: "仅自己" }) as HTMLInputElement;
		expect(me.matches(":disabled")).toBe(true);
		fireEvent.click(me);
		expect(me.checked).toBe(false);
		expect(change).not.toHaveBeenCalled();
	});

	it("选项不额外设置 tabIndex，保持原生的组内单一 Tab 位", () => {
		render(<Visibility defaultValue="pub" />);
		for (const radio of screen.getAllByRole("radio")) {
			expect(radio.hasAttribute("tabindex")).toBe(false);
		}
	});
});

describe("表单", () => {
	function Form(props: Partial<React.ComponentProps<typeof RadioGroup>>) {
		return (
			<form data-testid="form">
				<Visibility name="vis" {...props} />
			</form>
		);
	}
	const submitted = () =>
		new FormData(screen.getByTestId("form") as HTMLFormElement).getAll("vis");

	it("提交 name 与选中项的 value，没有选中时不提交", () => {
		render(<Form />);
		expect(submitted()).toEqual([]);
		fireEvent.click(screen.getByRole("radio", { name: "仅登录可见" }));
		expect(submitted()).toEqual(["login"]);
	});

	it("required 让没有选中的整组校验失败，选中后通过", () => {
		render(<Form required />);
		const form = screen.getByTestId("form") as HTMLFormElement;
		expect(form.checkValidity()).toBe(false);
		fireEvent.click(screen.getByRole("radio", { name: "公开" }));
		expect(form.checkValidity()).toBe(true);
	});

	it("表单复位回到默认选中，并通知 onValueChange", async () => {
		const change = vi.fn();
		render(<Form defaultValue="pub" onValueChange={change} />);
		fireEvent.click(screen.getByRole("radio", { name: "仅自己" }));
		expect(submitted()).toEqual(["me"]);
		change.mockClear();
		await act(async () => {
			(screen.getByTestId("form") as HTMLFormElement).reset();
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
		expect(submitted()).toEqual(["pub"]);
		expect((screen.getByRole("radio", { name: "公开" }) as HTMLInputElement).checked).toBe(
			true,
		);
		expect(change).toHaveBeenCalledWith("pub");
	});

	it("复位时本来就停在默认项上，状态保持一致", async () => {
		render(<Form defaultValue="pub" />);
		await act(async () => {
			(screen.getByTestId("form") as HTMLFormElement).reset();
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
		expect(submitted()).toEqual(["pub"]);
	});

	it("复位被取消时选中不变", async () => {
		render(
			<form data-testid="form" onReset={(event) => event.preventDefault()}>
				<Visibility name="vis" defaultValue="pub" />
			</form>,
		);
		fireEvent.click(screen.getByRole("radio", { name: "仅自己" }));
		await act(async () => {
			(screen.getByTestId("form") as HTMLFormElement).reset();
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
		expect(submitted()).toEqual(["me"]);
	});

	it("受控时复位向调用方请求默认值", async () => {
		const change = vi.fn();
		function Controlled() {
			const [value, setValue] = useState("pub");
			return (
				<form data-testid="form">
					<Visibility
						name="vis"
						value={value}
						onValueChange={(next) => {
							change(next);
							setValue(next);
						}}
					/>
				</form>
			);
		}
		render(<Controlled />);
		fireEvent.click(screen.getByRole("radio", { name: "仅自己" }));
		change.mockClear();
		await act(async () => {
			(screen.getByTestId("form") as HTMLFormElement).reset();
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
		expect(change).toHaveBeenCalledWith("pub");
		expect(submitted()).toEqual(["pub"]);
	});
});

describe("外观与方向", () => {
	it("卡片外观与横排仍是同一套原生 fieldset 与 radio", () => {
		render(
			<>
				<RadioGroup legend="发布方式" appearance="card" defaultValue="now">
					<Radio value="now" label="立即发布" description="发布后出现在首页" />
					<Radio value="draft" label="存为草稿" />
				</RadioGroup>
				<RadioGroup legend="排序" orientation="horizontal" defaultValue="new">
					<Radio value="new" label="最新" />
					<Radio value="hot" label="最热" />
				</RadioGroup>
			</>,
		);
		expect(screen.getByRole("group", { name: "发布方式" }).tagName).toBe("FIELDSET");
		expect(screen.getByRole("group", { name: "排序" }).tagName).toBe("FIELDSET");
		expect(screen.getAllByRole("radio")).toHaveLength(4);
		fireEvent.click(screen.getByRole("radio", { name: "存为草稿" }));
		expect((screen.getByRole("radio", { name: "存为草稿" }) as HTMLInputElement).checked).toBe(
			true,
		);
		expect(
			screen.getByRole("radio", { name: "立即发布", description: "发布后出现在首页" }),
		).toBeTruthy();
	});
});

describe("键盘", () => {
	it("方向键移动由原生浏览器完成：选项保持同名同组、无 roving tabIndex", () => {
		render(<Visibility defaultValue="pub" />);
		const radios = screen.getAllByRole("radio") as HTMLInputElement[];
		expect(new Set(radios.map((radio) => radio.name)).size).toBe(1);
		expect(radios.every((radio) => radio.tabIndex === 0)).toBe(true);
	});
});
