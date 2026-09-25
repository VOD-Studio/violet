import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TreeNav } from "../TreeNav";
import type { TreeNavGroup, TreeNavItem } from "../types";

// Mock @tanstack/react-router 中的 Link 组件
vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		onClick,
		className,
		"aria-current": ariaCurrent,
	}: {
		children: React.ReactNode;
		to: string;
		onClick?: () => void;
		className?: string;
		"aria-current"?: "page" | "step" | "location" | "date" | "time" | "true" | "false";
	}) => (
		<a href={to} onClick={onClick} className={className} aria-current={ariaCurrent}>
			{children}
		</a>
	),
}));

// 构造一个 4 级甚至延伸至 5 级的测试树结构
const mockFourLevelItems: TreeNavItem[] = [
	{
		id: "level-1",
		title: "一级目录",
		to: "/docs/l1",
		badge: "壹",
		children: [
			{
				id: "level-2",
				title: "二级目录",
				to: "/docs/l1/l2",
				children: [
					{
						id: "level-3",
						title: "三级目录",
						to: "/docs/l1/l2/l3",
						children: [
							{
								id: "level-4",
								title: "四级目录",
								to: "/docs/l1/l2/l3/l4",
								children: [
									{
										id: "level-5-overflow",
										title: "五级目录（不应渲染）",
										to: "/docs/l1/l2/l3/l4/l5",
									},
								],
							},
						],
					},
				],
			},
		],
	},
];

const mockGroups: TreeNavGroup[] = [
	{
		id: "group-1",
		title: "测试卷目一",
		items: mockFourLevelItems,
	},
	{
		id: "group-2",
		title: "测试卷目二",
		items: [
			{
				id: "standalone",
				title: "独立单项",
				to: "/docs/standalone",
			},
		],
	},
];

describe("TreeNav", () => {
	it("正确渲染分组标题与一级节点", () => {
		render(<TreeNav currentPath="/docs/standalone" groups={mockGroups} />);
		expect(screen.getByText("测试卷目一")).toBeTruthy();
		expect(screen.getByText("测试卷目二")).toBeTruthy();
		expect(screen.getByText("一级目录")).toBeTruthy();
		expect(screen.getByText("独立单项")).toBeTruthy();
	});

	it("访问深层子路由时自动展开活跃分支至第 4 级", () => {
		render(<TreeNav currentPath="/docs/l1/l2/l3/l4" groups={mockGroups} />);
		// 1 到 4 级应该都被自动展开并可见
		expect(screen.getByText("一级目录")).toBeTruthy();
		expect(screen.getByText("二级目录")).toBeTruthy();
		expect(screen.getByText("三级目录")).toBeTruthy();
		expect(screen.getByText("四级目录")).toBeTruthy();

		// 第 4 级是活跃项，带有 aria-current=page
		const level4Link = screen.getByRole("link", { name: "四级目录" });
		expect(level4Link.getAttribute("aria-current")).toBe("page");

		// 超过 4 级的第 5 级不应被渲染
		expect(screen.queryByText("五级目录（不应渲染）")).toBeNull();
	});

	it("点击折叠/展开按钮可以手动切换子节点显示", () => {
		render(<TreeNav currentPath="/docs/standalone" groups={mockGroups} />);
		// 初始非活跃分支未展开
		expect(screen.queryByText("二级目录")).toBeNull();

		// 点击一级目录的展开按钮
		const expandBtn = screen.getByRole("button", { name: /展开一级目录子章节/ });
		fireEvent.click(expandBtn);

		expect(screen.getByText("二级目录")).toBeTruthy();
	});

	it("点击导航链接触发 onNavigate 回调", () => {
		const onNavigate = vi.fn();
		render(
			<TreeNav currentPath="/docs/standalone" groups={mockGroups} onNavigate={onNavigate} />,
		);

		fireEvent.click(screen.getByRole("link", { name: "独立单项" }));
		expect(onNavigate).toHaveBeenCalled();
	});

	it("支持 defaultExpandAll 选项默认展开所有 4 级内容", () => {
		render(<TreeNav currentPath="/docs/standalone" groups={mockGroups} defaultExpandAll />);
		expect(screen.getByText("一级目录")).toBeTruthy();
		expect(screen.getByText("二级目录")).toBeTruthy();
		expect(screen.getByText("三级目录")).toBeTruthy();
		expect(screen.getByText("四级目录")).toBeTruthy();
		expect(screen.queryByText("五级目录（不应渲染）")).toBeNull();
	});
});
