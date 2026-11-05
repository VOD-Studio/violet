import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Avatar, AvatarGroup } from "../avatar";

const IMG = "https://example.com/rua.png";
const root = (container: HTMLElement) => container.firstElementChild as HTMLElement;
const image = (container: HTMLElement) => container.querySelector("img");

afterEach(() => vi.restoreAllMocks());

describe("Avatar 首字", () => {
	it("没有图片时取中文名第一个字", () => {
		render(<Avatar name="林小径" />);
		expect(screen.getByRole("img", { name: "林小径" }).textContent).toBe("林");
	});

	it("英文名取首字母大写", () => {
		render(<Avatar name="rua" />);
		expect(screen.getByRole("img", { name: "rua" }).textContent).toBe("R");
	});

	it("icon 替代首字", () => {
		render(<Avatar name="随笔" icon={<svg data-testid="hash" />} />);
		expect(screen.getByTestId("hash")).toBeTruthy();
		expect(screen.queryByText("随")).toBeNull();
	});

	it("没有 src 时直接显示首字且没有 img", () => {
		const { container } = render(<Avatar name="Rua" />);
		expect(image(container)).toBeNull();
		expect(screen.getByRole("img", { name: "Rua" }).textContent).toBe("R");
	});
});

describe("Avatar 替代文字", () => {
	it("alt 默认取 name", () => {
		render(<Avatar name="Rua" src={IMG} />);
		expect(screen.getByRole("img", { name: "Rua" })).toBeTruthy();
	});

	it("显式 alt 优先于 name", () => {
		render(<Avatar name="Rua" alt="站长 Rua" src={IMG} />);
		expect(screen.getByRole("img", { name: "站长 Rua" })).toBeTruthy();
	});

	it('alt="" 为装饰：不暴露名称，也不朗读首字', () => {
		const { container } = render(<Avatar name="Rua" alt="" src={IMG} />);
		expect(screen.queryByRole("img")).toBeNull();
		fireEvent.error(image(container) as HTMLImageElement);
		expect(screen.queryByRole("img")).toBeNull();
		expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe("R");
	});
});

describe("Avatar 图片状态", () => {
	it("加载完成前不显示首字，load 后显示图片", () => {
		const { container } = render(<Avatar name="Rua" src={IMG} />);
		expect(root(container).dataset.state).toBe("loading");
		expect(container.textContent).toBe("");
		fireEvent.load(image(container) as HTMLImageElement);
		expect(root(container).dataset.state).toBe("loaded");
		expect(image(container)?.getAttribute("src")).toBe(IMG);
	});

	it("加载失败退回首字，不留下 img", () => {
		const { container } = render(<Avatar name="Rua" src={IMG} />);
		fireEvent.error(image(container) as HTMLImageElement);
		expect(image(container)).toBeNull();
		expect(root(container).textContent).toBe("R");
		expect(root(container).dataset.state).toBe("fallback");
	});

	it("失败后换 src 重新进入加载", () => {
		const { container, rerender } = render(<Avatar name="Rua" src={IMG} />);
		fireEvent.error(image(container) as HTMLImageElement);
		rerender(<Avatar name="Rua" src="https://example.com/next.png" />);
		expect(root(container).dataset.state).toBe("loading");
		expect(image(container)?.getAttribute("src")).toBe("https://example.com/next.png");
	});

	it("已缓存完成的图片无需事件即视为已加载", () => {
		vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
		vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(96);
		const { container } = render(<Avatar name="Rua" src={IMG} />);
		expect(root(container).dataset.state).toBe("loaded");
	});

	it("服务端输出直接包含 img", () => {
		expect(renderToString(<Avatar name="Rua" src={IMG} />)).toContain(`src="${IMG}"`);
	});

	it("imgProps 的事件与组件处理一并调用", () => {
		const onLoad = vi.fn();
		const { container } = render(<Avatar src={IMG} imgProps={{ onLoad }} />);
		fireEvent.load(image(container) as HTMLImageElement);
		expect(onLoad).toHaveBeenCalledOnce();
		expect(root(container).dataset.state).toBe("loaded");
	});
});

describe("Avatar 状态与挂饰", () => {
	it("名称包含状态文字", () => {
		render(<Avatar name="Rua" status="online" />);
		expect(screen.getByRole("img", { name: "Rua，在线" })).toBeTruthy();
	});

	it.each([
		["away", "Rua，离开"],
		["busy", "Rua，勿扰"],
	] as const)("%s 状态写进名称", (status, name) => {
		render(<Avatar name="Rua" status={status} />);
		expect(screen.getByRole("img", { name })).toBeTruthy();
	});

	it("statusLabel 覆盖默认文字", () => {
		render(<Avatar name="Rua" status="online" statusLabel="刚刚在线" />);
		expect(screen.getByRole("img", { name: "Rua，刚刚在线" })).toBeTruthy();
	});

	it("装饰头像带状态时仍暴露状态文字", () => {
		render(<Avatar name="Rua" alt="" status="busy" />);
		expect(screen.getByRole("img", { name: "勿扰" })).toBeTruthy();
	});

	it("作者皇冠写进名称", () => {
		render(<Avatar name="Rua" crown />);
		expect(screen.getByRole("img", { name: "Rua，作者" })).toBeTruthy();
	});
});

describe("Avatar 原生属性", () => {
	it("ref 指向根节点，className 与原生属性透传", () => {
		const ref = createRef<HTMLSpanElement>();
		render(<Avatar ref={ref} name="Rua" className="mine" data-x="1" />);
		expect(ref.current?.tagName).toBe("SPAN");
		expect(ref.current?.classList.contains("mine")).toBe(true);
		expect(ref.current?.dataset.x).toBe("1");
	});
});

describe("AvatarGroup", () => {
	const people = ["林", "Rua", "Mei", "Kai", "Zed"].map((name) => ({ name }));

	it("默认最多 3 个，其余折成「还有 N 人」", () => {
		render(<AvatarGroup items={people} />);
		expect(screen.getAllByRole("img")).toHaveLength(4);
		const more = screen.getByRole("img", { name: "还有 2 人" });
		expect(more.textContent).toBe("+2");
	});

	it("max 可调；不超出时没有 +N", () => {
		const { rerender } = render(<AvatarGroup items={people} max={4} />);
		expect(screen.getByRole("img", { name: "还有 1 人" })).toBeTruthy();
		rerender(<AvatarGroup items={people} max={5} />);
		expect(screen.queryByText(/^\+/)).toBeNull();
		expect(screen.getAllByRole("img")).toHaveLength(5);
	});

	it("整组有名称且为 group", () => {
		render(<AvatarGroup items={people} label="12 人点了赞" />);
		expect(screen.getByRole("group", { name: "12 人点了赞" })).toBeTruthy();
	});

	it("没有 label 时不声明无名称的 group", () => {
		render(<AvatarGroup items={people} />);
		expect(screen.queryByRole("group")).toBeNull();
	});

	it("每个成员以名字命名", () => {
		render(<AvatarGroup items={people} />);
		expect(screen.getByRole("img", { name: "Rua" })).toBeTruthy();
	});

	it("没有成员时不渲染", () => {
		const { container } = render(<AvatarGroup items={[]} />);
		expect(container.firstChild).toBeNull();
	});
});
