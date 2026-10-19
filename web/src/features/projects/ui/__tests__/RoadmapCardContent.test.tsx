import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RoadmapItem } from "../../model/roadmap";
import { RoadmapCardContent } from "../RoadmapCardContent";

const item = (overrides: Partial<RoadmapItem> = {}): RoadmapItem => ({
	id: "i1",
	project_id: "p1",
	number: 12,
	title: "支持离线阅读",
	description: "",
	stage: "planned",
	position: "a0",
	tags: [],
	links: [],
	checklist: [],
	completion_date: null,
	delivered_version: "",
	blocked: false,
	created_at: "2026-10-01T00:00:00Z",
	updated_at: "2026-10-01T00:00:00Z",
	...overrides,
});

describe("RoadmapCardContent", () => {
	it("显示编号与标题；点击带着条目与被点的按钮交给 onOpen", () => {
		const onOpen = vi.fn();
		const data = item();
		render(<RoadmapCardContent item={data} onOpen={onOpen} />);

		const button = screen.getByRole("button", { name: /支持离线阅读/ });
		expect(button.textContent).toContain("#12");
		expect(button.getAttribute("aria-haspopup")).toBe("dialog");
		fireEvent.click(button);

		expect(onOpen).toHaveBeenCalledExactlyOnceWith(data, button);
	});

	it("最多显示 3 个标签，其余折成「+N」；没有标签、阻塞与子项时没有这一行", () => {
		const { rerender } = render(
			<RoadmapCardContent
				item={item({ tags: ["a", "b", "c", "d", "e"] })}
				onOpen={() => {}}
			/>,
		);
		expect(screen.getByText("a")).toBeTruthy();
		expect(screen.getByText("c")).toBeTruthy();
		expect(screen.queryByText("d")).toBeNull();
		expect(screen.getByText("+2")).toBeTruthy();

		rerender(<RoadmapCardContent item={item({ tags: ["a", "b", "c"] })} onOpen={() => {}} />);
		expect(screen.queryByText(/^\+/)).toBeNull();

		rerender(<RoadmapCardContent item={item()} onOpen={() => {}} />);
		expect(screen.getByRole("button").textContent).toBe("#12支持离线阅读");
	});

	it("有子项时显示完成数与总数，读屏先听到「子项已完成」；没有子项就没有", () => {
		const { rerender } = render(
			<RoadmapCardContent
				item={item({
					checklist: [
						{ text: "设计", done: true },
						{ text: "实现", done: false },
						{ text: "验收", done: false },
					],
				})}
				onOpen={() => {}}
			/>,
		);
		expect(screen.getByRole("button", { name: /子项已完成：1\/3/ })).toBeTruthy();

		rerender(<RoadmapCardContent item={item()} onOpen={() => {}} />);
		expect(screen.queryByText(/子项已完成/)).toBeNull();
	});

	it("子项进度、阻塞与标签可以同时出现", () => {
		render(
			<RoadmapCardContent
				item={item({
					blocked: true,
					tags: ["后端"],
					checklist: [{ text: "设计", done: true }],
				})}
				onOpen={() => {}}
			/>,
		);

		const name = screen.getByRole("button").textContent;
		expect(name).toContain("被阻塞");
		expect(name).toContain("1/1");
		expect(name).toContain("后端");
	});

	it("交付信息：版本与日期都有时用「·」连接，只有一个就只显示它，都没有就不显示", () => {
		const { rerender } = render(
			<RoadmapCardContent
				item={item({
					stage: "completed",
					delivered_version: "v1.2.0",
					completion_date: "2026-10-01",
				})}
				onOpen={() => {}}
			/>,
		);
		expect(screen.getByText("v1.2.0 · 2026-10-01")).toBeTruthy();

		rerender(
			<RoadmapCardContent
				item={item({ stage: "completed", completion_date: "2026-10-01" })}
				onOpen={() => {}}
			/>,
		);
		expect(screen.getByText("2026-10-01")).toBeTruthy();

		rerender(<RoadmapCardContent item={item({ stage: "completed" })} onOpen={() => {}} />);
		expect(screen.getByRole("button").textContent).toBe("#12支持离线阅读");
	});

	it("被阻塞的条目带「被阻塞」文字标记，没被阻塞的没有；标记算进按钮的可访问名称", () => {
		const { rerender } = render(
			<RoadmapCardContent item={item({ blocked: true })} onOpen={() => {}} />,
		);
		expect(screen.getByText("被阻塞")).toBeTruthy();
		expect(screen.getByRole("button", { name: /被阻塞/ })).toBeTruthy();

		rerender(<RoadmapCardContent item={item({ blocked: false })} onOpen={() => {}} />);
		expect(screen.queryByText("被阻塞")).toBeNull();
	});

	it("只有被阻塞、没有标签时也显示标记行", () => {
		render(<RoadmapCardContent item={item({ blocked: true, tags: [] })} onOpen={() => {}} />);

		expect(screen.getByText("被阻塞")).toBeTruthy();
	});
});

describe("RoadmapCardContent 可编辑时", () => {
	it("标题点开就地修改，保存新标题；标题以下的区域打开详情", async () => {
		const onRename = vi.fn().mockResolvedValue(undefined);
		const onOpen = vi.fn();
		const data = item({ tags: ["a"] });
		render(<RoadmapCardContent item={data} onOpen={onOpen} onRename={onRename} />);

		fireEvent.click(screen.getByRole("button", { name: "支持离线阅读" }));
		const input = screen.getByRole("textbox", { name: "#12 的标题" });
		fireEvent.change(input, { target: { value: "支持离线阅读与同步" } });
		fireEvent.keyDown(input, { key: "Enter" });

		await waitFor(() => expect(onRename).toHaveBeenCalledWith(data, "支持离线阅读与同步"));
		const details = screen.getByRole("button", { name: "查看 #12 支持离线阅读 的详情" });
		fireEvent.click(details);
		expect(onOpen).toHaveBeenCalledWith(data, details);
	});

	it("没有标签与阻塞时不留空行，编号仍在详情按钮里", () => {
		render(<RoadmapCardContent item={item()} onOpen={() => {}} onRename={async () => {}} />);

		expect(screen.getByRole("button", { name: /的详情$/ }).textContent).toBe("#12");
	});
});
