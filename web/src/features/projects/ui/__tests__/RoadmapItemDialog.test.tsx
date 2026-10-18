import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RoadmapItem } from "../../model/roadmap";
import { RoadmapItemDialog } from "../RoadmapItemDialog";

const item = (overrides: Partial<RoadmapItem> = {}): RoadmapItem => ({
	id: "i1",
	project_id: "p1",
	number: 7,
	title: "条目标题",
	description: "",
	stage: "planned",
	position: "a0",
	tags: [],
	links: [],
	completion_date: null,
	delivered_version: "",
	blocked: false,
	created_at: "2026-10-01T00:00:00Z",
	updated_at: "2026-10-01T00:00:00Z",
	...overrides,
});

describe("RoadmapItemDialog", () => {
	it("关闭时不渲染弹窗", () => {
		render(<RoadmapItemDialog item={item()} open={false} onOpenChange={() => {}} />);

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("显示编号、阶段与标题；没有的字段整块不出现", () => {
		render(<RoadmapItemDialog item={item()} open onOpenChange={() => {}} />);

		const dialog = screen.getByRole("dialog", { name: "条目标题" });
		expect(dialog.textContent).toContain("#7 · 计划中");
		expect(screen.queryByRole("list", { name: "条目标签" })).toBeNull();
		expect(screen.queryByRole("list", { name: "关联链接" })).toBeNull();
		expect(dialog.textContent).not.toContain("交付版本");
		expect(dialog.textContent).not.toContain("完成日期");
	});

	it("没有简介时不声明 aria-describedby，有简介时关联它", () => {
		const { rerender } = render(
			<RoadmapItemDialog item={item()} open onOpenChange={() => {}} />,
		);
		expect(screen.getByRole("dialog").hasAttribute("aria-describedby")).toBe(false);

		rerender(
			<RoadmapItemDialog
				item={item({ description: "一段说明" })}
				open
				onOpenChange={() => {}}
			/>,
		);
		const dialog = screen.getByRole("dialog");
		const described = document.getElementById(dialog.getAttribute("aria-describedby") ?? "");
		expect(described?.textContent).toBe("一段说明");
	});

	it("标签、交付版本、完成日期与链接；链接没有名称时显示地址，并在新标签页打开", () => {
		render(
			<RoadmapItemDialog
				item={item({
					stage: "completed",
					tags: ["性能", "画布"],
					delivered_version: "v2.0.0",
					completion_date: "2026-10-20",
					links: [
						{ label: "发布说明", url: "https://example.com/a" },
						{ label: "", url: "https://example.com/b" },
					],
				})}
				open
				onOpenChange={() => {}}
			/>,
		);

		expect(screen.getByRole("list", { name: "条目标签" }).textContent).toBe("性能画布");
		expect(screen.getByText("v2.0.0")).toBeTruthy();
		expect(screen.getByText("2026-10-20")).toBeTruthy();
		const named = screen.getByRole("link", { name: "发布说明" });
		expect(named.getAttribute("href")).toBe("https://example.com/a");
		expect(named.getAttribute("target")).toBe("_blank");
		expect(named.getAttribute("rel")).toBe("noreferrer");
		expect(screen.getByRole("link", { name: "https://example.com/b" })).toBeTruthy();
	});

	it("Esc 关闭时通知，并把焦点还给 returnFocusTo 给出的元素", async () => {
		const opener = document.createElement("button");
		document.body.append(opener);
		const onOpenChange = vi.fn();
		const { rerender } = render(
			<RoadmapItemDialog
				item={item()}
				open
				onOpenChange={onOpenChange}
				returnFocusTo={() => opener}
			/>,
		);

		fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
		expect(onOpenChange).toHaveBeenCalledWith(false);
		rerender(
			<RoadmapItemDialog
				item={item()}
				open={false}
				onOpenChange={onOpenChange}
				returnFocusTo={() => opener}
			/>,
		);

		// Radix 在卸载后的下一个任务里派发关闭后聚焦事件
		await waitFor(() => expect(document.activeElement).toBe(opener));
		opener.remove();
	});
});
