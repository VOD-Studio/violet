import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { projectKeys } from "../../api/keys";
import type { RoadmapEmbedResult } from "../../api/queries";
import type { RoadmapDetail, RoadmapItem } from "../../model/roadmap";
import type { Project } from "../../model/types";
import { RoadmapEmbedPicker } from "../RoadmapEmbedPicker";

beforeAll(() => {
	// jsdom 未实现 Radix Select 用到的指针捕获与滚动
	Element.prototype.hasPointerCapture = () => false;
	Element.prototype.releasePointerCapture = () => {};
	Element.prototype.scrollIntoView = vi.fn();
});

const item = (number: number, title: string) =>
	({ id: `i${number}`, number, title, stage: "planned" }) as RoadmapItem;

function renderPicker(initialSource?: string) {
	const client = new QueryClient({
		// 数据都预先放进缓存，不发请求
		defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY, retry: false } },
	});
	client.setQueryData(projectKeys.list({}), [
		{ id: "p1", title: "Kite 协作", slug: "kite" },
		{ id: "p2", title: "Violet 博客", slug: "violet" },
	] as Project[]);
	const kite: RoadmapEmbedResult = {
		status: "ok",
		detail: { items: [item(1, "收敛执行入口"), item(2, "建立领域模型")] } as RoadmapDetail,
	};
	const violet: RoadmapEmbedResult = { status: "missing" };
	client.setQueryData(projectKeys.roadmapEmbed("kite"), kite);
	client.setQueryData(projectKeys.roadmapEmbed("violet"), violet);
	const onChange = vi.fn();
	render(
		<QueryClientProvider client={client}>
			<RoadmapEmbedPicker initialSource={initialSource} onChange={onChange} />
		</QueryClientProvider>,
	);
	return onChange;
}

/** 打开下拉并点选一项。 */
function choose(label: string, option: string) {
	fireEvent.keyDown(screen.getByRole("combobox", { name: label }), { key: "Enter" });
	fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: option }));
}

const lastSource = (onChange: ReturnType<typeof vi.fn>) => onChange.mock.lastCall?.[0];

describe("路线图选择表单", () => {
	it("没选项目时报告 null；选好项目、形态与条目后报告对应的围栏原文", () => {
		const onChange = renderPicker();
		expect(lastSource(onChange)).toBeNull();

		choose("项目", "Kite 协作");
		expect(lastSource(onChange)).toBe('{"project":"kite"}');
		expect(screen.getByText("不指定条目时是项目卡片")).toBeTruthy();

		choose("条目", "#2 建立领域模型");
		expect(lastSource(onChange)).toBe('{"project":"kite","item":2}');

		fireEvent.click(screen.getByRole("button", { name: "关系画布" }));
		expect(lastSource(onChange)).toBe(
			'{"project":"kite","display":"canvas","view":"graph","item":2}',
		);

		fireEvent.click(screen.getByRole("button", { name: "看板画布" }));
		expect(lastSource(onChange)).toBe('{"project":"kite","display":"canvas"}');
		expect((screen.getByRole("combobox", { name: "条目" }) as HTMLButtonElement).disabled).toBe(
			true,
		);
		expect(screen.getByText("看板画布总是整个项目")).toBeTruthy();
	});

	it("换项目时清掉条目；项目已删除时说明原因", () => {
		const onChange = renderPicker('{"project":"kite","item":1}');
		expect(lastSource(onChange)).toBe('{"project":"kite","item":1}');

		choose("项目", "Violet 博客");
		expect(lastSource(onChange)).toBe('{"project":"violet"}');
		expect(screen.getByText("这个项目不存在或已删除")).toBeTruthy();
	});

	it("编辑已有的块时从原文回填", () => {
		renderPicker('{"project":"kite","display":"canvas","view":"graph","item":1}');

		expect(screen.getByRole("combobox", { name: "项目" }).textContent).toBe("Kite 协作");
		expect(screen.getByRole("combobox", { name: "条目" }).textContent).toBe("#1 收敛执行入口");
		expect(screen.getByRole("button", { name: "关系画布" }).getAttribute("aria-pressed")).toBe(
			"true",
		);
	});
});
