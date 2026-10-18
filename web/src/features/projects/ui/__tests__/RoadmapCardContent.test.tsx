import { fireEvent, render, screen } from "@testing-library/react";
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

	it("最多显示 3 个标签，其余折成「+N」；没有标签就没有标签行", () => {
		const { container, rerender } = render(
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
		expect(container.querySelectorAll("[class*='rounded-full']")).toHaveLength(0);
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
});
