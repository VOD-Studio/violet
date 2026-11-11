import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { type EmojiPickerGroup, EmojiPickerPanel, type EmojiPickerPanelProps } from "../index";

const groups: EmojiPickerGroup[] = [
	{
		id: "faces",
		label: "小黄脸",
		sections: [
			{
				id: "faces",
				label: "小黄脸",
				density: "large",
				items: [
					{
						id: "first",
						name: "微笑",
						content: "😀",
						placeholder: "[微笑]",
						aliases: ["smile", "wx"],
					},
					{
						id: "lower",
						name: "猫猫",
						content: "🐱",
						placeholder: "[猫猫]",
						disabledReason: "会员专属",
					},
				],
			},
		],
	},
];

function panel(currentGroups = groups, status: EmojiPickerPanelProps["status"] = "ready") {
	return (
		<EmojiPickerPanel
			groups={currentGroups}
			activeGroup="faces"
			status={status}
			onGroupChange={() => undefined}
			onSelect={() => undefined}
		/>
	);
}

function measurePanel(container: HTMLElement, bounds = new DOMRect(0, 0, 340, 290)) {
	const root = container.querySelector<HTMLDivElement>('[data-slot="emoji-picker-panel"]');
	const viewport = container.querySelector<HTMLDivElement>(".v-emoji-picker__grid");
	if (!root || !viewport) {
		throw new Error("表情面板或滚动视口没有挂载");
	}
	vi.spyOn(root, "getBoundingClientRect").mockReturnValue(bounds);
	vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(
		new DOMRect(bounds.left, bounds.top + 46, bounds.width, bounds.height - 46),
	);
	return { root, viewport };
}

function previewIn(container: HTMLElement) {
	const preview = container.querySelector<HTMLElement>(".v-emoji-picker__preview");
	if (!preview) {
		throw new Error("表情预览没有挂载");
	}
	return preview;
}

function rectangleOf(preview: HTMLElement) {
	const left = Number.parseFloat(preview.style.left);
	const top = Number.parseFloat(preview.style.top);
	const width = Number.parseFloat(preview.style.width);
	return new DOMRect(left, top, width, 100);
}

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

it("首尾预览在视口内翻转，保留别名与不可用原因并延迟退出", () => {
	vi.useFakeTimers();
	const { container } = render(panel());
	const { viewport } = measurePanel(container);
	const first = screen.getByRole("option", { name: "微笑" });
	const lower = screen.getByRole("option", { name: "猫猫" });
	vi.spyOn(first, "getBoundingClientRect").mockReturnValue(new DOMRect(10, 72, 60, 60));
	vi.spyOn(lower, "getBoundingClientRect").mockReturnValue(new DOMRect(270, 224, 60, 60));

	fireEvent.mouseEnter(first);
	const preview = previewIn(container);
	let rectangle = rectangleOf(preview);
	expect(preview.dataset.side).toBe("bottom");
	expect(preview.textContent).toContain("[微笑] · smile wx");
	expect(rectangle.top).toBeGreaterThanOrEqual(132);
	expect(rectangle.bottom).toBeLessThanOrEqual(290);

	fireEvent.mouseMove(lower);
	rectangle = rectangleOf(preview);
	expect(preview.dataset.side).toBe("top");
	expect(preview.textContent).toContain("会员专属");
	expect(rectangle.top).toBeGreaterThanOrEqual(46);
	expect(rectangle.bottom).toBeLessThanOrEqual(224);
	expect(rectangle.right).toBeLessThanOrEqual(340);
	fireEvent.mouseLeave(viewport);
	expect(preview.dataset.visible).toBe("true");
	act(() => vi.advanceTimersByTime(60));
	expect(preview.dataset.visible).toBe("false");
});

it.each([
	{ panelWidth: 340, browserWidth: 400, targetX: 144, side: "left" },
	{ panelWidth: 340, browserWidth: 400, targetX: 136, side: "right" },
	{ panelWidth: 288, browserWidth: 320, targetX: 116, side: "left" },
	{ panelWidth: 260, browserWidth: 292, targetX: 104, side: "left" },
])("中央大格上下均放不下时侧放且不重叠：$panelWidth / $targetX", ({
	panelWidth,
	browserWidth,
	targetX,
	side,
}) => {
	vi.stubGlobal("innerWidth", browserWidth);
	const { container } = render(panel());
	measurePanel(container, new DOMRect(16, 0, panelWidth, 290));
	const first = screen.getByRole("option", { name: "微笑" });
	const target = new DOMRect(16 + targetX, 138, 60, 60);
	vi.spyOn(first, "getBoundingClientRect").mockReturnValue(target);
	fireEvent.mouseEnter(first);

	const preview = previewIn(container);
	const rectangle = rectangleOf(preview);
	expect(preview.dataset.side).toBe(side);
	expect(rectangle.top).toBeGreaterThanOrEqual(46);
	expect(rectangle.bottom).toBeLessThanOrEqual(290);
	expect(rectangle.left).toBeGreaterThanOrEqual(-16);
	expect(rectangle.right).toBeLessThanOrEqual(panelWidth + 16);
	expect(rectangle.left + 16).toBeGreaterThanOrEqual(0);
	expect(rectangle.right + 16).toBeLessThanOrEqual(browserWidth);
	expect(rectangle.width).toBeGreaterThanOrEqual(60);
	if (side === "left") {
		expect(rectangle.right).toBeLessThanOrEqual(targetX - 9);
	} else {
		expect(rectangle.left).toBeGreaterThanOrEqual(targetX + 60 + 9);
	}
});

it("父级缩放时将目标和边界换算到面板本地坐标", () => {
	const { container } = render(panel());
	const { root, viewport } = measurePanel(container, new DOMRect(20, 10, 170, 145));
	vi.spyOn(root, "offsetWidth", "get").mockReturnValue(340);
	vi.spyOn(root, "offsetHeight", "get").mockReturnValue(290);
	vi.mocked(viewport.getBoundingClientRect).mockReturnValue(new DOMRect(20, 33, 170, 122));
	const first = screen.getByRole("option", { name: "微笑" });
	vi.spyOn(first, "getBoundingClientRect").mockReturnValue(new DOMRect(90, 79, 30, 30));
	fireEvent.mouseEnter(first);
	const rectangle = rectangleOf(previewIn(container));
	expect(rectangle.right).toBeLessThanOrEqual(131);
	expect(rectangle.top).toBeGreaterThanOrEqual(46);
	expect(rectangle.width).toBe(120);
});

it("离开 60ms 内返回同格取消旧的隐藏计时", () => {
	vi.useFakeTimers();
	const { container } = render(panel());
	const { viewport } = measurePanel(container);
	const first = screen.getByRole("option", { name: "微笑" });
	vi.spyOn(first, "getBoundingClientRect").mockReturnValue(new DOMRect(10, 72, 60, 60));
	fireEvent.mouseEnter(first);
	fireEvent.mouseLeave(viewport);
	act(() => vi.advanceTimersByTime(40));
	fireEvent.mouseEnter(first);
	act(() => vi.advanceTimersByTime(200));
	expect(previewIn(container).dataset.visible).toBe("true");
});

it("同 key 的目录更新保持显示、更新内容并重新测量最新 DOM", () => {
	const { container, rerender } = render(panel());
	measurePanel(container);
	const first = screen.getByRole("option", { name: "微笑" });
	const target = vi.spyOn(first, "getBoundingClientRect");
	target.mockReturnValue(new DOMRect(10, 72, 60, 60));
	fireEvent.mouseEnter(first);
	target.mockReturnValue(new DOMRect(270, 224, 60, 60));
	const section = groups[0].sections[0];
	const updated = [
		{
			...groups[0],
			sections: [
				{
					...section,
					items: [
						{
							...section.items[0],
							name: "新微笑",
							content: "😄",
							placeholder: "[新微笑]",
						},
						section.items[1],
					],
				},
			],
		},
	];
	rerender(panel(updated));

	const preview = previewIn(container);
	expect(preview.dataset.visible).toBe("true");
	expect(preview.textContent).toContain("😄新微笑[新微笑]");
	expect(preview.textContent).not.toContain("😀");
	expect(rectangleOf(preview).bottom).toBeLessThanOrEqual(224);
});

it("当前 key 从目录移除后立即隐藏且不保留旧内容", () => {
	const { container, rerender } = render(panel());
	measurePanel(container);
	const first = screen.getByRole("option", { name: "微笑" });
	vi.spyOn(first, "getBoundingClientRect").mockReturnValue(new DOMRect(10, 72, 60, 60));
	fireEvent.mouseEnter(first);
	const section = groups[0].sections[0];
	rerender(panel([{ ...groups[0], sections: [{ ...section, items: [section.items[1]] }] }]));
	expect(container.querySelector(".v-emoji-picker__preview")).toBeNull();
});

it("加载期间取消预览，恢复内容时等待新的指针或键盘输入", () => {
	const { container, rerender } = render(panel());
	measurePanel(container);
	const first = screen.getByRole("option", { name: "微笑" });
	vi.spyOn(first, "getBoundingClientRect").mockReturnValue(new DOMRect(10, 72, 60, 60));
	fireEvent.mouseEnter(first);
	expect(previewIn(container).dataset.visible).toBe("true");

	rerender(panel(groups, "loading"));
	rerender(panel());
	expect(previewIn(container).dataset.visible).toBe("false");

	fireEvent.mouseEnter(screen.getByRole("option", { name: "微笑" }));
	expect(previewIn(container).dataset.visible).toBe("true");
});
