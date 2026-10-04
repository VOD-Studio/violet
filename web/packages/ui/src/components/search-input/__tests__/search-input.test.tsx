import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchInput } from "../SearchInput";

describe("SearchInput", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("初值不触发查询，实时回调与尾随搜索各自按契约执行", () => {
		const search = vi.fn();
		const change = vi.fn();
		render(<SearchInput defaultValue="初值" onValueChange={change} onSearch={search} />);
		const input = screen.getByRole("textbox") as HTMLInputElement;
		act(() => vi.advanceTimersByTime(300));
		expect(search).not.toHaveBeenCalled();
		fireEvent.change(input, { target: { value: "vio" } });
		act(() => vi.advanceTimersByTime(200));
		fireEvent.change(input, { target: { value: "violet" } });
		expect(change.mock.calls).toEqual([["vio"], ["violet"]]);
		act(() => vi.advanceTimersByTime(299));
		expect(search).not.toHaveBeenCalled();
		act(() => vi.advanceTimersByTime(1));
		expect(search.mock.calls).toEqual([["violet"]]);
	});

	it("调用方键盘事件与回车搜索共存，回车后不重复尾随查询", () => {
		const order: string[] = [];
		const search = vi.fn((value: string) => order.push(`search:${value}`));
		render(<SearchInput onKeyDown={(event) => order.push(event.key)} onSearch={search} />);
		const input = screen.getByRole("textbox");
		fireEvent.change(input, { target: { value: "violet" } });
		expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(false);
		expect(order).toEqual(["Enter", "search:violet"]);
		act(() => vi.advanceTimersByTime(300));
		expect(search).toHaveBeenCalledOnce();
	});

	it("没有挂起调用时回车仍搜索当前文本", () => {
		const search = vi.fn();
		render(<SearchInput defaultValue="violet" onSearch={search} />);
		fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
		expect(search.mock.calls).toEqual([["violet"]]);
	});

	it("preventDefault 取消回车动作，已排队的尾随搜索继续执行", () => {
		const search = vi.fn();
		render(<SearchInput onKeyDown={(event) => event.preventDefault()} onSearch={search} />);
		const input = screen.getByRole("textbox");
		fireEvent.change(input, { target: { value: "violet" } });
		fireEvent.keyDown(input, { key: "Enter" });
		expect(search).not.toHaveBeenCalled();
		act(() => vi.advanceTimersByTime(300));
		expect(search.mock.calls).toEqual([["violet"]]);
	});

	it.each([
		{ isComposing: true },
		{ keyCode: 229 },
	])("输入法确认回车不拦截默认行为或立即搜索：%j", (composition) => {
		const search = vi.fn();
		const keyDown = vi.fn();
		render(<SearchInput onKeyDown={keyDown} onSearch={search} />);
		const input = screen.getByRole("textbox");
		fireEvent.change(input, { target: { value: "紫罗兰" } });
		expect(fireEvent.keyDown(input, { key: "Enter", ...composition })).toBe(true);
		expect(keyDown).toHaveBeenCalledOnce();
		expect(search).not.toHaveBeenCalled();
		act(() => vi.advanceTimersByTime(300));
		expect(search.mock.calls).toEqual([["紫罗兰"]]);
	});

	it("没有 onSearch 时保留回车默认行为", () => {
		const keyDown = vi.fn();
		render(<SearchInput onKeyDown={keyDown} />);
		expect(fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" })).toBe(true);
		expect(keyDown).toHaveBeenCalledOnce();
	});

	it.each([{ disabled: true }, { readOnly: true }])("不可编辑时清除按钮也不可用：%j", (state) => {
		const search = vi.fn();
		const change = vi.fn();
		const clear = vi.fn();
		render(
			<SearchInput
				{...state}
				defaultValue="保留文本"
				onValueChange={change}
				onSearch={search}
				onClear={clear}
			/>,
		);
		const button = screen.getByRole("button", { name: "清除搜索" }) as HTMLButtonElement;
		expect(button.disabled).toBe(true);
		fireEvent.click(button);
		expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("保留文本");
		expect(change).not.toHaveBeenCalled();
		expect(search).not.toHaveBeenCalled();
		expect(clear).not.toHaveBeenCalled();
	});

	it("清除可通过键盘访问，取消旧查询并把焦点交回真实 input", () => {
		const ref = createRef<HTMLInputElement>();
		const search = vi.fn();
		const change = vi.fn();
		const clear = vi.fn();
		render(<SearchInput ref={ref} onValueChange={change} onSearch={search} onClear={clear} />);
		const input = screen.getByRole("textbox") as HTMLInputElement;
		expect(ref.current).toBe(input);
		fireEvent.change(input, { target: { value: "violet" } });
		const button = screen.getByRole("button", { name: "清除搜索" }) as HTMLButtonElement;
		expect(button.tabIndex).toBe(0);
		button.focus();
		fireEvent.click(button);
		expect(input.value).toBe("");
		expect(document.activeElement).toBe(input);
		expect(screen.queryByRole("button", { name: "清除搜索" })).toBeNull();
		expect(change.mock.calls).toEqual([["violet"], [""]]);
		expect(search.mock.calls).toEqual([[""]]);
		expect(clear).toHaveBeenCalledOnce();
		act(() => vi.advanceTimersByTime(300));
		expect(search).toHaveBeenCalledOnce();
	});

	it("受控值由调用方回写，清除只发出变更意图", () => {
		const change = vi.fn();
		const { rerender } = render(<SearchInput value="violet" onValueChange={change} />);
		fireEvent.click(screen.getByRole("button", { name: "清除搜索" }));
		expect(change).toHaveBeenCalledWith("");
		expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("violet");
		rerender(<SearchInput value="" onValueChange={change} />);
		expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
	});

	it("object ref 卸载归零，原生属性与 style 落在 input", () => {
		const ref = createRef<HTMLInputElement>();
		const { unmount } = render(
			<SearchInput
				ref={ref}
				id="query"
				name="query"
				form="search-form"
				required
				style={{ color: "red" }}
			/>,
		);
		const input = screen.getByRole("textbox") as HTMLInputElement;
		expect(ref.current).toBe(input);
		expect(input.id).toBe("query");
		expect(input.name).toBe("query");
		expect(input.getAttribute("form")).toBe("search-form");
		expect(input.required).toBe(true);
		expect(input.style.color).toBe("red");
		unmount();
		expect(ref.current).toBeNull();
	});

	it("callback ref 保留 React 19 cleanup，并支持内部焦点回退", () => {
		const cleanup = vi.fn();
		const ref = vi.fn((_input: HTMLInputElement | null) => cleanup);
		const { unmount } = render(<SearchInput ref={ref} defaultValue="violet" />);
		const input = screen.getByRole("textbox");
		expect(ref).toHaveBeenCalledWith(input);
		fireEvent.click(screen.getByRole("button", { name: "清除搜索" }));
		expect(document.activeElement).toBe(input);
		expect(cleanup).not.toHaveBeenCalled();
		unmount();
		expect(cleanup).toHaveBeenCalledOnce();
		expect(ref).toHaveBeenCalledOnce();
	});

	it("没有 cleanup 的 callback ref 在卸载时收到 null", () => {
		const ref = vi.fn((_input: HTMLInputElement | null) => {});
		const { unmount } = render(<SearchInput ref={ref} />);
		expect(ref).toHaveBeenCalledWith(screen.getByRole("textbox"));
		unmount();
		expect(ref).toHaveBeenLastCalledWith(null);
	});

	it("卸载取消挂起查询", () => {
		const search = vi.fn();
		const { unmount } = render(<SearchInput onSearch={search} />);
		fireEvent.change(screen.getByRole("textbox"), { target: { value: "violet" } });
		unmount();
		act(() => vi.advanceTimersByTime(300));
		expect(search).not.toHaveBeenCalled();
	});
});
