import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { Checkbox } from "../../checkbox";
import { Input } from "../../input";
import { Field, FieldSet, useFieldControl } from "../field";

function messageOf(text: string) {
	return screen.getByText(text).closest("[aria-live]") as HTMLElement;
}

describe("Field 标签", () => {
	it("label for 指向控件，可访问名称只有纯文案", () => {
		render(
			<Field label="邮箱" optional>
				<Input type="email" />
			</Field>,
		);
		expect(screen.getByRole("textbox", { name: "邮箱" })).toBeDefined();
		expect(screen.getByLabelText("邮箱", { exact: true })).toBeDefined();
	});

	it("「（选填）」是 label 的兄弟节点，不在 label 里", () => {
		render(
			<Field label="简介" optional>
				<Input />
			</Field>,
		);
		const optional = screen.getByText("（选填）");
		expect(optional.closest("label")).toBeNull();
		expect(optional.parentElement).toBe(screen.getByText("简介").parentElement);
	});

	it("labelEnd 跟在标签后面，但不进可访问名称", () => {
		render(
			<Field label="并发数" labelEnd={<button type="button">说明</button>}>
				<Input />
			</Field>,
		);
		expect(screen.getByRole("textbox", { name: "并发数" })).toBeDefined();
		expect(screen.getByRole("button", { name: "说明" }).closest("label")).toBeNull();
	});

	it("必填不加红星，也没有选填标记", () => {
		render(
			<Field label="标题">
				<Input />
			</Field>,
		);
		expect(screen.queryByText("（选填）")).toBeNull();
		expect(screen.queryByText("*")).toBeNull();
	});
});

describe("Field 消息行", () => {
	it("提示与错误在同一个元素里，出错时 aria-invalid 并由 aria-describedby 指向它", () => {
		const { rerender } = render(
			<Field label="邮箱" hint="只用于回复通知，不会公开">
				<Input />
			</Field>,
		);
		const input = screen.getByRole("textbox");
		const message = messageOf("只用于回复通知，不会公开");
		expect(message.getAttribute("aria-live")).toBe("polite");
		expect(input.getAttribute("aria-describedby")).toBe(message.id);
		expect(input.getAttribute("aria-invalid")).toBeNull();

		rerender(
			<Field
				label="邮箱"
				hint="只用于回复通知，不会公开"
				error="邮箱格式不正确，缺少 @ 或域名"
			>
				<Input />
			</Field>,
		);
		expect(screen.queryByText("只用于回复通知，不会公开")).toBeNull();
		expect(messageOf("邮箱格式不正确，缺少 @ 或域名")).toBe(message);
		expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe("true");
		expect(screen.getByRole("textbox").getAttribute("aria-describedby")).toBe(message.id);
	});

	it("消息永远只显示一条：error > checking > success > hint", () => {
		const { rerender } = render(
			<Field
				label="用户名"
				hint="主页地址会用到它"
				success="可以使用"
				checking="正在检查…"
				error="已被占用"
			>
				<Input />
			</Field>,
		);
		expect(screen.getByText("已被占用")).toBeDefined();
		expect(screen.queryByText("正在检查…")).toBeNull();
		expect(screen.queryByText("可以使用")).toBeNull();
		expect(screen.queryByText("主页地址会用到它")).toBeNull();

		rerender(
			<Field label="用户名" hint="主页地址会用到它" success="可以使用" checking="正在检查…">
				<Input />
			</Field>,
		);
		expect(screen.getByText("正在检查…")).toBeDefined();
		expect(screen.queryByText("可以使用")).toBeNull();

		rerender(
			<Field label="用户名" hint="主页地址会用到它" success="可以使用">
				<Input />
			</Field>,
		);
		expect(screen.getByText("可以使用")).toBeDefined();
		expect(screen.queryByText("主页地址会用到它")).toBeNull();
	});

	it("没有任何消息时消息行仍在，保持 aria-live", () => {
		const { container } = render(
			<Field label="昵称">
				<Input />
			</Field>,
		);
		expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
	});

	it("空串与 false 不算有错误", () => {
		render(
			<Field label="昵称" error="" hint="提示文案">
				<Input />
			</Field>,
		);
		expect(screen.getByText("提示文案")).toBeDefined();
		expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBeNull();
	});
});

describe("Field 字数", () => {
	it("没有 count 不显示，有则按「值 / 上限」显示", () => {
		const { rerender } = render(
			<Field label="简介">
				<Input />
			</Field>,
		);
		expect(screen.queryByText(/\d+ \/ \d+/)).toBeNull();

		rerender(
			<Field label="简介" count={{ value: 10, max: 40 }}>
				<Input />
			</Field>,
		);
		expect(screen.getByText("10 / 40")).toBeDefined();
	});

	it("达到上限的 90% 变危险色，之前不变", () => {
		const { rerender } = render(
			<Field label="简介" count={{ value: 35, max: 40 }}>
				<Input />
			</Field>,
		);
		expect(screen.getByText("35 / 40").hasAttribute("data-over")).toBe(false);

		rerender(
			<Field label="简介" count={{ value: 36, max: 40 }}>
				<Input />
			</Field>,
		);
		expect(screen.getByText("36 / 40").hasAttribute("data-over")).toBe(true);
	});
});

describe("Field 控件接线", () => {
	it("控件自带的 aria-describedby 与消息元素合并，id 与同名 aria-invalid 以控件为准", () => {
		render(
			<>
				<p id="extra">补充说明</p>
				<Field label="邮箱" error="不对">
					<Input id="mine" aria-describedby="extra" aria-invalid={false} />
				</Field>
			</>,
		);
		const input = screen.getByRole("textbox", { name: "邮箱" });
		const message = messageOf("不对");
		expect(input.id).toBe("mine");
		expect(input.getAttribute("aria-describedby")).toBe(`extra ${message.id}`);
		expect(input.getAttribute("aria-invalid")).toBe("false");
	});

	it("控件的 ref 不丢", () => {
		const ref = createRef<HTMLInputElement>();
		render(
			<Field label="邮箱">
				<Input ref={ref} />
			</Field>,
		);
		expect(ref.current).toBe(screen.getByRole("textbox"));
	});

	it("children 不是单个元素时不注入，htmlFor 指定标签目标", () => {
		render(
			<Field label="范围" htmlFor="lo" hint="两端都填">
				<Input id="lo" />
				<Input id="hi" aria-label="上限" />
			</Field>,
		);
		const label = screen.getByText("范围");
		expect(label.getAttribute("for")).toBe("lo");
		expect(document.getElementById("lo")?.getAttribute("aria-describedby")).toBeNull();
		expect(document.getElementById("hi")?.getAttribute("aria-describedby")).toBeNull();
	});

	it("useFieldControl 在 Field 内取到接线属性，组合控件自己展开", () => {
		function Pair() {
			const control = useFieldControl();
			return (
				<div role="group" {...control}>
					<Input aria-label="区号" />
					<Input aria-label="号码" />
				</div>
			);
		}
		render(
			<Field label="电话" error="号码不完整">
				<Pair />
				<span>尾巴</span>
			</Field>,
		);
		const group = screen.getByRole("group", { name: "电话" });
		expect(group.getAttribute("aria-describedby")).toBe(messageOf("号码不完整").id);
		expect(group.getAttribute("aria-invalid")).toBe("true");
	});

	it("自动接线不给原生控件注入 aria-labelledby，可访问名称不重复", () => {
		render(
			<Field label="邮箱">
				<Input />
			</Field>,
		);
		expect(screen.getByRole("textbox", { name: "邮箱" }).hasAttribute("aria-labelledby")).toBe(
			false,
		);
	});

	it("useFieldControl 在 Field 之外返回空属性而不抛错", () => {
		function Probe() {
			const control = useFieldControl();
			return <output>{JSON.stringify(control)}</output>;
		}
		render(<Probe />);
		expect(screen.getByRole("status").textContent).toBe("{}");
	});
});

describe("Field 横排", () => {
	it("orientation 与 controlSize 写进根元素，标签与消息行结构不变", () => {
		const { container } = render(
			<Field
				label="站点名称"
				orientation="horizontal"
				controlSize="lg"
				hint="出现在浏览器标签里"
			>
				<Input />
			</Field>,
		);
		const root = container.firstElementChild as HTMLElement;
		expect(root.classList.contains("v-field--horizontal")).toBe(true);
		expect(root.dataset.controlSize).toBe("lg");
		expect(screen.getByRole("textbox", { name: "站点名称" })).toBeDefined();
		expect(screen.getByText("出现在浏览器标签里")).toBeDefined();
	});
});

describe("FieldSet", () => {
	it("是带 legend 的 fieldset，错误写在组的消息行里并由 aria-describedby 指向", () => {
		render(
			<FieldSet legend="通知方式" description="至少选一种" error="至少选一种通知方式">
				<Checkbox aria-label="邮件" />
			</FieldSet>,
		);
		const group = screen.getByRole("group", { name: "通知方式" });
		expect(group.tagName).toBe("FIELDSET");
		const message = messageOf("至少选一种通知方式");
		expect(message.getAttribute("aria-live")).toBe("polite");
		const described = (group.getAttribute("aria-describedby") ?? "").split(" ");
		expect(described).toContain(message.id);
		expect(described).toContain(screen.getByText("至少选一种").id);
	});

	it("组说明在 legend 之下、选项之上，消息行在选项之下", () => {
		render(
			<FieldSet legend="通知方式" description="说明" hint="已选 1 种">
				<Checkbox aria-label="邮件" />
			</FieldSet>,
		);
		const order = (a: Node, b: Node) =>
			a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
		expect(order(screen.getByText("通知方式"), screen.getByText("说明"))).toBeTruthy();
		expect(order(screen.getByText("说明"), screen.getByRole("checkbox"))).toBeTruthy();
		expect(order(screen.getByRole("checkbox"), screen.getByText("已选 1 种"))).toBeTruthy();
	});

	it("hint 与 error 同位互换，选填标记在 legend 里", () => {
		const { rerender } = render(
			<FieldSet legend="标签" optional hint="已选 1 种">
				<Checkbox aria-label="邮件" />
			</FieldSet>,
		);
		expect(screen.getByText("（选填）")).toBeDefined();
		const message = messageOf("已选 1 种");

		rerender(
			<FieldSet legend="标签" optional hint="已选 1 种" error="出错了">
				<Checkbox aria-label="邮件" />
			</FieldSet>,
		);
		expect(messageOf("出错了")).toBe(message);
		expect(screen.queryByText("已选 1 种")).toBeNull();
	});
});
