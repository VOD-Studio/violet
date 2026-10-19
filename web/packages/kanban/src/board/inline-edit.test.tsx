import { act, fireEvent, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EDITING_EVENT } from "../pan-region.ts";
import { Board } from "./board.tsx";
import { InlineEdit, type InlineEditProps } from "./inline-edit.tsx";

function renderEdit(props: Partial<InlineEditProps> = {}) {
	const onSave = vi.fn();
	const view = render(<InlineEdit value="Alpha" label="Card title" onSave={onSave} {...props} />);
	return { onSave, ...view };
}

const trigger = () => screen.getByRole("button", { name: "Alpha" });
const input = () => screen.getByRole("textbox", { name: "Card title" }) as HTMLInputElement;
const edit = () => fireEvent.click(trigger());
const type = (value: string) => fireEvent.change(input(), { target: { value } });
const press = (key: string, init: KeyboardEventInit = {}) =>
	fireEvent.keyDown(input(), { key, ...init });

describe("展示与进入编辑", () => {
	it("展示态是按钮：名称是当前文字，label 作为描述，不是输入框", () => {
		renderEdit();

		expect(trigger().textContent).toBe("Alpha");
		expect(trigger().getAttribute("aria-describedby")).toBeTruthy();
		expect(
			document.getElementById(trigger().getAttribute("aria-describedby") ?? "")?.textContent,
		).toBe("Card title");
		expect(screen.queryByRole("textbox")).toBeNull();
	});

	it("点击后变成输入框：值是当前文字，已聚焦并全选", () => {
		renderEdit();

		edit();

		expect(input().value).toBe("Alpha");
		expect(document.activeElement).toBe(input());
		expect(input().selectionStart).toBe(0);
		expect(input().selectionEnd).toBe(5);
	});

	it("maxLength 与 placeholder 传给输入框", () => {
		renderEdit({ maxLength: 20, placeholder: "Title" });

		edit();

		expect(input().maxLength).toBe(20);
		expect(input().placeholder).toBe("Title");
	});

	it("没有编辑时 value 变化会直接显示；编辑中不覆盖正在输入的草稿", () => {
		const { rerender } = renderEdit();
		rerender(<InlineEdit value="Beta" label="Card title" onSave={() => {}} />);
		expect(screen.getByRole("button", { name: "Beta" })).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Beta" }));
		type("Draft");
		rerender(<InlineEdit value="Gamma" label="Card title" onSave={() => {}} />);

		expect(input().value).toBe("Draft");
	});
});

describe("保存与取消", () => {
	it("Enter 保存去掉首尾空白的新文字；成功后回到展示态并把焦点还给按钮", async () => {
		const { onSave } = renderEdit();
		edit();
		type("  Alpha 2  ");

		await act(async () => void press("Enter"));

		expect(onSave).toHaveBeenCalledWith("Alpha 2");
		expect(screen.queryByRole("textbox")).toBeNull();
		expect(document.activeElement).toBe(trigger());
	});

	it("没有改动：Enter 与失去焦点都不调用 onSave，直接退出", async () => {
		const { onSave } = renderEdit();
		edit();
		await act(async () => void press("Enter"));
		expect(screen.queryByRole("textbox")).toBeNull();

		edit();
		type(" Alpha ");
		await act(async () => void fireEvent.blur(input()));

		expect(onSave).not.toHaveBeenCalled();
		expect(screen.queryByRole("textbox")).toBeNull();
	});

	it("Esc 放弃修改，焦点回到按钮，Esc 不再往外传（不会退出全屏）", () => {
		const { onSave } = renderEdit();
		const outside = vi.fn();
		document.addEventListener("keydown", outside);
		edit();
		type("changed");

		fireEvent.keyDown(input(), { key: "Escape" });
		document.removeEventListener("keydown", outside);

		expect(onSave).not.toHaveBeenCalled();
		expect(outside).not.toHaveBeenCalled();
		expect(screen.queryByRole("textbox")).toBeNull();
		expect(document.activeElement).toBe(trigger());
	});

	it("失去焦点时保存修改，且不抢走用户去往的焦点", async () => {
		const { onSave } = renderEdit();
		const next = document.createElement("button");
		document.body.append(next);
		edit();
		type("Alpha 3");

		next.focus();
		await act(async () => void fireEvent.blur(input(), { relatedTarget: next }));

		expect(onSave).toHaveBeenCalledWith("Alpha 3");
		expect(document.activeElement).toBe(next);
		next.remove();
	});

	it("输入法组合期间的 Enter 不保存", async () => {
		const { onSave } = renderEdit();
		edit();
		type("你好");

		await act(async () => void press("Enter", { isComposing: true }));

		expect(onSave).not.toHaveBeenCalled();
		expect(screen.queryByRole("textbox")).not.toBeNull();
	});
});

describe("校验与失败", () => {
	it("默认不允许空文字：留在编辑态并提示，不调用 onSave；allowEmpty 时允许", async () => {
		const { onSave, unmount } = renderEdit();
		edit();
		type("   ");

		await act(async () => void press("Enter"));

		expect(onSave).not.toHaveBeenCalled();
		expect(screen.getByRole("alert").textContent).toBe("This can't be empty.");
		expect(input().getAttribute("aria-invalid")).toBe("true");
		unmount();

		const allowed = renderEdit({ allowEmpty: true });
		edit();
		type("");
		await act(async () => void press("Enter"));
		expect(allowed.onSave).toHaveBeenCalledWith("");
	});

	it("保存失败（拒绝或抛错）：留在编辑态，保留输入并提示；再输入时清除提示", async () => {
		const { rerender } = renderEdit({ onSave: () => Promise.reject(new Error("no")) });
		edit();
		type("Alpha 4");

		await act(async () => void press("Enter"));

		expect(input().value).toBe("Alpha 4");
		expect(screen.getByRole("alert").textContent).toMatch(/couldn't be saved/i);
		type("Alpha 45");
		expect(screen.queryByRole("alert")).toBeNull();

		rerender(
			<InlineEdit
				value="Alpha"
				label="Card title"
				onSave={() => {
					throw new Error("sync");
				}}
			/>,
		);
		await act(async () => void press("Enter"));
		expect(screen.getByRole("alert")).toBeTruthy();
	});

	it("保存中输入框只读（保留焦点）、不重复提交；失去焦点也不再提交一次", async () => {
		let finish = () => {};
		const onSave = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve;
				}),
		);
		renderEdit({ onSave });
		edit();
		type("Alpha 5");

		act(() => void press("Enter"));
		act(() => void press("Enter"));
		act(() => void fireEvent.blur(input()));

		expect(onSave).toHaveBeenCalledTimes(1);
		expect(input().readOnly).toBe(true);
		expect(input().getAttribute("aria-busy")).toBe("true");
		await act(async () => finish());
		expect(screen.queryByRole("textbox")).toBeNull();
	});
});

describe("过期的保存结果与重复保存", () => {
	it("保存失败后失去焦点：不会悄悄再保存一次，编辑器和错误留着", async () => {
		const onSave = vi.fn(() => Promise.reject(new Error("no")));
		renderEdit({ onSave });
		edit();
		type("Alpha 7");
		await act(async () => void press("Enter"));
		expect(onSave).toHaveBeenCalledTimes(1);

		await act(async () => void fireEvent.blur(input()));

		expect(onSave).toHaveBeenCalledTimes(1);
		expect(input().value).toBe("Alpha 7");
		expect(screen.getByRole("alert")).toBeTruthy();
	});

	it("保存期间按 Esc 离开、又重新点开编辑：先前那次保存之后才成功，不会把新开的编辑器关掉", async () => {
		let finish = () => {};
		const onSave = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve;
				}),
		);
		renderEdit({ onSave });
		edit();
		type("Alpha 8");
		act(() => void press("Enter"));

		fireEvent.keyDown(input(), { key: "Escape" });
		edit();
		type("second draft");
		await act(async () => finish());

		expect(input().value).toBe("second draft");
	});

	it("保存期间离开后才失败：不会在已经关掉的编辑器上留下错误", async () => {
		let fail: (reason: unknown) => void = () => {};
		renderEdit({
			onSave: () =>
				new Promise<void>((_, reject) => {
					fail = reject;
				}),
		});
		edit();
		type("Alpha 9");
		act(() => void press("Enter"));
		fireEvent.keyDown(input(), { key: "Escape" });

		await act(async () => fail(new Error("late")));
		edit();

		expect(screen.queryByRole("alert")).toBeNull();
	});
});

describe("空文字与外层", () => {
	it("value 为空时展示态仍有可点的内容（回退到 label），不是 0 高度的空按钮", () => {
		render(<InlineEdit value="" label="Card title" onSave={() => {}} allowEmpty />);

		const button = screen.getByRole("button", { name: "Card title" });
		expect(button.textContent).toBe("Card title");
		expect(button.getAttribute("data-empty")).toBe("true");
	});

	it("有 placeholder 时空文字展示 placeholder", () => {
		render(<InlineEdit value="" label="Card title" placeholder="Untitled" onSave={() => {}} />);

		expect(screen.getByRole("button", { name: "Untitled" })).toBeTruthy();
	});

	it("点开编辑算用户在操作：告知外层画布", () => {
		const { container } = renderEdit();
		const notified = vi.fn();
		container.addEventListener(EDITING_EVENT, notified);

		edit();

		expect(notified).toHaveBeenCalledTimes(1);
	});

	it("在看板里自动沿用看板的语言，不必再传一遍；自己传的 locale 优先", async () => {
		render(
			<Board
				locale="zh-CN"
				columns={[{ id: "todo", title: "Todo" }]}
				cards={[{ id: "a", title: "Alpha" }]}
				order={{ todo: ["a"] }}
				renderCard={(card) => (
					<>
						<InlineEdit value={card.title} label="标题" onSave={() => {}} />
						<InlineEdit value="Beta" label="en title" locale="en" onSave={() => {}} />
					</>
				)}
			/>,
		);
		const submitEmpty = async (name: string) => {
			fireEvent.change(screen.getByRole("textbox", { name }), { target: { value: "" } });
			await act(
				async () =>
					void fireEvent.keyDown(screen.getByRole("textbox", { name }), { key: "Enter" }),
			);
		};
		fireEvent.click(screen.getByRole("button", { name: "Alpha" }));
		await submitEmpty("标题");
		expect(screen.getByRole("alert").textContent).toBe("不能为空");

		fireEvent.click(screen.getByRole("button", { name: "Beta" }));
		await submitEmpty("en title");
		expect(screen.getAllByRole("alert").at(-1)?.textContent).toBe("This can't be empty.");
	});
});

describe("文案与渲染", () => {
	it("zh-CN 与 messages 覆盖", async () => {
		renderEdit({ locale: "zh-CN", messages: { saveFailed: "没存上" }, allowEmpty: false });
		edit();
		type("");
		await act(async () => void press("Enter"));
		expect(screen.getByRole("alert").textContent).toBe("不能为空");
	});

	it("标记可以直接水合，没有告警与恢复性错误", async () => {
		const element = <InlineEdit value="Alpha" label="Card title" onSave={() => {}} />;
		const container = document.createElement("div");
		container.innerHTML = renderToString(element);
		document.body.append(container);
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		const recoverable = vi.fn();

		await act(async () => {
			hydrateRoot(container, element, { onRecoverableError: recoverable });
		});

		expect(errors).not.toHaveBeenCalled();
		expect(recoverable).not.toHaveBeenCalled();
		errors.mockRestore();
		container.remove();
	});
});

describe("在看板卡片里", () => {
	function renderBoard(onSave: InlineEditProps["onSave"]) {
		return render(
			<Board
				columns={[{ id: "todo", title: "Todo" }]}
				cards={[{ id: "a", title: "Alpha" }]}
				order={{ todo: ["a"] }}
				onMove={() => {}}
				getCardLabel={(card) => card.title}
				renderCard={(card) => (
					<InlineEdit value={card.title} label="Card title" onSave={onSave} />
				)}
			/>,
		);
	}

	it("在输入框里按空格与 Enter 不会拿起卡片，按下输入框不会开始拖拽", async () => {
		const onSave = vi.fn();
		renderBoard(onSave);
		edit();

		fireEvent.keyDown(input(), { key: " " });
		fireEvent.pointerDown(input(), {
			pointerId: 1,
			pointerType: "mouse",
			isPrimary: true,
			button: 0,
			clientX: 10,
			clientY: 10,
		});
		fireEvent.pointerMove(document, {
			pointerId: 1,
			pointerType: "mouse",
			clientX: 90,
			clientY: 90,
		});
		type("Alpha 6");
		await act(async () => void press("Enter"));

		expect(document.querySelector("[data-lifted]")).toBeNull();
		expect(document.querySelector(".v-kanban__ghost")).toBeNull();
		expect(onSave).toHaveBeenCalledWith("Alpha 6");
	});
});
