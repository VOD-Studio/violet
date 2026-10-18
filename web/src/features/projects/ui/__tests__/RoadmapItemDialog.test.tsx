import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RoadmapItem, RoadmapRelation } from "../../model/roadmap";
import { RoadmapItemDialog, type RoadmapItemDialogProps } from "../RoadmapItemDialog";

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

/** 大多数用例不关心关系：没给 items 与 relations 就当项目里只有这一个条目、没有关系。 */
function Dialog(
	props: Omit<RoadmapItemDialogProps, "items" | "relations"> &
		Partial<Pick<RoadmapItemDialogProps, "items" | "relations">>,
) {
	return <RoadmapItemDialog items={props.item ? [props.item] : []} relations={[]} {...props} />;
}

const relation = (
	source: string,
	target: string,
	type: RoadmapRelation["type"] = "extends",
): RoadmapRelation => ({
	id: `${source}-${type}-${target}`,
	project_id: "p1",
	source_id: source,
	target_id: target,
	type,
	created_at: "2026-10-01T00:00:00Z",
});

describe("RoadmapItemDialog", () => {
	it("关闭时不渲染弹窗", () => {
		render(<Dialog item={item()} open={false} onOpenChange={() => {}} />);

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("显示编号、阶段与标题；没有的字段整块不出现", () => {
		render(<Dialog item={item()} open onOpenChange={() => {}} />);

		const dialog = screen.getByRole("dialog", { name: "条目标题" });
		expect(dialog.textContent).toContain("#7 · 计划中");
		expect(screen.queryByRole("list", { name: "条目标签" })).toBeNull();
		expect(screen.queryByRole("list", { name: "关联链接" })).toBeNull();
		expect(dialog.textContent).not.toContain("交付版本");
		expect(dialog.textContent).not.toContain("完成日期");
	});

	it("没有简介时不声明 aria-describedby，有简介时关联它", () => {
		const { rerender } = render(<Dialog item={item()} open onOpenChange={() => {}} />);
		expect(screen.getByRole("dialog").hasAttribute("aria-describedby")).toBe(false);

		rerender(<Dialog item={item({ description: "一段说明" })} open onOpenChange={() => {}} />);
		const dialog = screen.getByRole("dialog");
		const described = document.getElementById(dialog.getAttribute("aria-describedby") ?? "");
		expect(described?.textContent).toBe("一段说明");
	});

	it("标签、交付版本、完成日期与链接；链接没有名称时显示地址，并在新标签页打开", () => {
		render(
			<Dialog
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
			<Dialog item={item()} open onOpenChange={onOpenChange} returnFocusTo={() => opener} />,
		);

		fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
		expect(onOpenChange).toHaveBeenCalledWith(false);
		rerender(
			<Dialog
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

	describe("关系", () => {
		const a = item({ id: "a", number: 1, title: "前置功能" });
		const b = item({ id: "b", number: 2, title: "被它阻塞的功能" });
		const c = item({ id: "c", number: 3, title: "无关条目" });

		it("列出这个条目的出入关系，另一端按「#编号 标题」显示；与它无关的关系不列", () => {
			render(
				<Dialog
					item={b}
					items={[a, b, c]}
					relations={[relation("a", "b", "blocks"), relation("c", "a", "fixes")]}
					open
					onOpenChange={() => {}}
				/>,
			);

			const section = screen
				.getByRole("heading", { name: "关系" })
				.closest("section") as HTMLElement;
			const entries = [...section.querySelectorAll("li")].map((node) => node.textContent);
			expect(entries).toEqual(["#1 前置功能 阻塞 #2 被它阻塞的功能"]);
		});

		it("没有关系就没有这一块", () => {
			render(
				<Dialog
					item={c}
					items={[a, b, c]}
					relations={[relation("a", "b")]}
					open
					onOpenChange={() => {}}
				/>,
			);

			expect(screen.queryByRole("heading", { name: "关系" })).toBeNull();
		});

		it("被阻塞的条目在头部写明原因；没被阻塞的没有", () => {
			const { rerender } = render(
				<Dialog item={item({ blocked: true })} open onOpenChange={() => {}} />,
			);
			expect(screen.getByRole("dialog").textContent).toContain(
				"被阻塞：还有未完成的前置条目",
			);

			rerender(<Dialog item={item({ blocked: false })} open onOpenChange={() => {}} />);
			expect(screen.getByRole("dialog").textContent).not.toContain("被阻塞");
		});
	});
});
