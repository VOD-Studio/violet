import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../hover-card";

function Mention({ container }: { container?: HTMLElement | null }) {
	return (
		<HoverCard>
			<HoverCardTrigger asChild>
				<a href="#linjian">@林间</a>
			</HoverCardTrigger>
			<HoverCardContent container={container}>
				<p>林间 @linjian</p>
			</HoverCardContent>
		</HoverCard>
	);
}

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const mouse = (type: "pointerEnter" | "pointerLeave", element: Element) =>
	fireEvent[type](element, { pointerType: "mouse" });
const link = () => screen.getByRole("link", { name: "@林间" });
const card = () => screen.queryByText("林间 @linjian");

describe("HoverCard", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
	});

	it("指针停留 500ms 后出现，不早于此", () => {
		render(<Mention />);
		mouse("pointerEnter", link());
		advance(499);
		expect(card()).toBeNull();
		advance(1);
		expect(card()).not.toBeNull();
	});

	it("指针离开 200ms 后消失，不早于此", () => {
		render(<Mention />);
		mouse("pointerEnter", link());
		advance(500);
		mouse("pointerLeave", link());
		advance(199);
		expect(card()).not.toBeNull();
		advance(1);
		expect(card()).toBeNull();
	});

	it("指针从触发词移到卡片上不消失，离开卡片后才按延迟消失", () => {
		render(<Mention />);
		mouse("pointerEnter", link());
		advance(500);

		mouse("pointerLeave", link());
		advance(100);
		const content = (card() as HTMLElement).closest(
			"[data-slot=hover-card-content]",
		) as HTMLElement;
		mouse("pointerEnter", content);
		advance(1000);
		expect(card()).not.toBeNull();

		mouse("pointerLeave", content);
		advance(200);
		expect(card()).toBeNull();
	});

	it("键盘聚焦同样延迟 500ms 出现，Esc 立刻消失", () => {
		render(<Mention />);
		act(() => link().focus());
		advance(499);
		expect(card()).toBeNull();
		advance(1);
		expect(card()).not.toBeNull();

		fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
		expect(card()).toBeNull();
	});

	it("触屏指针不会让卡片出现", () => {
		render(<Mention />);
		fireEvent.pointerEnter(link(), { pointerType: "touch" });
		advance(2000);
		expect(card()).toBeNull();
	});

	it("卡片不带箭头", () => {
		render(<Mention />);
		mouse("pointerEnter", link());
		advance(500);
		expect(document.querySelector("svg")).toBeNull();
	});

	it("container 把卡片挂到指定容器", () => {
		const host = document.createElement("div");
		document.body.append(host);
		render(<Mention container={host} />);
		mouse("pointerEnter", link());
		advance(500);
		expect(host.contains(card())).toBe(true);
		host.remove();
	});
});
