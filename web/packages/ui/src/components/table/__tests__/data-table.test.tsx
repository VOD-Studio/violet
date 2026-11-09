import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataTable } from "../data-table";
import type { DataTableColumn, DataTableProps, DataTableSort } from "../data-table-types";

interface Row {
	id: string;
	name: string;
	email: string;
	views: number;
}

const ROWS: Row[] = [
	{ id: "1", name: "Alice", email: "alice@example.com", views: 30 },
	{ id: "2", name: "Bob", email: "bob@example.com", views: 5 },
	{ id: "3", name: "Carol", email: "carol@example.com", views: 12 },
];

const COLUMNS: DataTableColumn<Row>[] = [
	{ key: "name", header: "名称", accessorKey: "name", sortable: true, width: "120px" },
	{ key: "email", header: "邮箱", accessorKey: "email" },
	{ key: "views", header: "浏览", accessorKey: "views", align: "right", sortable: true },
];

function renderTable(props: Partial<DataTableProps<Row>> = {}) {
	return render(
		<DataTable<Row>
			columns={COLUMNS}
			data={ROWS}
			keyExtractor={(row) => row.id}
			caption="用户列表"
			{...props}
		/>,
	);
}

const header = (name: string) => screen.getByRole("columnheader", { name });
const selectAll = () => screen.getByRole("checkbox", { name: "全选本页" });
const rowBox = (n: number) => screen.getByRole("checkbox", { name: `选择第 ${n} 行` });
const bulkBar = () => screen.queryByRole("toolbar", { name: "批量操作" });
const colWidths = (container: HTMLElement) =>
	Array.from(container.querySelectorAll<HTMLElement>("colgroup col"), (col) => col.style.width);

afterEach(() => {
	cleanup();
	localStorage.clear();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("DataTable 列宽", () => {
	it("列定义的宽度写进 colgroup，百分比同样适用；第一个数据列是伸缩列，声明宽度只作最小宽度", () => {
		const { container } = renderTable({
			columns: [
				{ key: "name", header: "名称", width: "120px" },
				{ key: "email", header: "邮箱", width: "20%" },
				{ key: "views", header: "浏览", width: "90px" },
			],
		});

		expect(colWidths(container)).toEqual(["", "20%", "90px"]);
		expect(screen.getByRole("table").style.minWidth).toBe("330px");
	});

	it("勾选、展开、显示列三种窄列宽度精确：展开 32、勾选 36，不被多余宽度分摊", () => {
		const { container } = renderTable({
			expandable: true,
			selectable: true,
			columns: [{ key: "name", header: "名称", width: "200px" }],
		});

		expect(colWidths(container)).toEqual(["32px", "36px", ""]);
	});

	it("设备上记录的窄列与右固定列宽度（旧版曾一并记下）不再采信", () => {
		localStorage.setItem(
			"cols-widths-v2",
			JSON.stringify({ __expand: 37, __select: 41, actions: 140, name: 150 }),
		);

		vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
			this: Element,
		) {
			return { width: this.hasAttribute("data-fit-content") ? 60 : 0 } as DOMRect;
		});
		vi.spyOn(window, "getComputedStyle").mockReturnValue({
			paddingLeft: "12px",
			paddingRight: "12px",
		} as CSSStyleDeclaration);

		const { container } = renderTable({
			storageKey: "cols",
			expandable: true,
			selectable: true,
			columns: [
				{ key: "name", header: "名称", width: "200px" },
				{ key: "email", header: "邮箱", width: "200px" },
				{
					key: "actions",
					header: "操作",
					sticky: "right",
					width: "60px",
					cell: () => "编辑",
				},
			],
		});

		expect(colWidths(container)).toEqual(["32px", "36px", "150px", "", "84px"]);
	});

	it("所有非固定数据列都被拖过宽度时，最后一个非固定列做伸缩列", () => {
		localStorage.setItem(
			"cols-widths-v2",
			JSON.stringify({ name: 150, email: 200, views: 100 }),
		);

		const { container } = renderTable({ storageKey: "cols", selectable: true });

		expect(colWidths(container)).toEqual(["32px", "36px", "150px", "200px", ""]);
		expect(screen.getByRole("table").style.minWidth).toBe("518px");
	});

	it("表格最小宽度是各列宽度之和，窄容器里横向滑动而不是挤压", () => {
		renderTable({
			selectable: true,
			columns: [
				{ key: "name", header: "名称", width: "100px" },
				{ key: "email", header: "邮箱", width: "160px" },
			],
		});

		expect(screen.getByRole("table").style.minWidth).toBe("296px");
	});
});

describe("DataTable 横向滚动区域", () => {
	it("滚动区是可聚焦的 region，以 caption 命名", () => {
		renderTable();

		const region = screen.getByRole("region", { name: "用户列表" });
		expect(region.tabIndex).toBe(0);
		expect(screen.getByRole("table", { name: "用户列表" })).toBeTruthy();
	});

	it("没有 caption 时 region 仍有名称", () => {
		renderTable({ caption: undefined });

		expect(screen.getByRole("region", { name: "数据表格" })).toBeTruthy();
	});

	it("按滚动位置标记两端是否还有内容，供固定列边缘出现细线", () => {
		const { container } = renderTable();
		const root = container.firstElementChild as HTMLElement;
		const region = screen.getByRole("region");
		const metrics = (scrollLeft: number) => {
			Object.defineProperty(region, "scrollWidth", { configurable: true, value: 800 });
			Object.defineProperty(region, "clientWidth", { configurable: true, value: 400 });
			Object.defineProperty(region, "scrollLeft", { configurable: true, value: scrollLeft });
			fireEvent.scroll(region);
		};

		metrics(0);
		expect(root.hasAttribute("data-scrolled-start")).toBe(false);
		expect(root.hasAttribute("data-scrolled-end")).toBe(true);

		metrics(100);
		expect(root.hasAttribute("data-scrolled-start")).toBe(true);
		expect(root.hasAttribute("data-scrolled-end")).toBe(true);

		metrics(400);
		expect(root.hasAttribute("data-scrolled-start")).toBe(true);
		expect(root.hasAttribute("data-scrolled-end")).toBe(false);
	});

	it("没有横向溢出时两端都不标记", () => {
		const { container } = renderTable();
		const root = container.firstElementChild as HTMLElement;
		const region = screen.getByRole("region");
		Object.defineProperty(region, "scrollWidth", { configurable: true, value: 400 });
		Object.defineProperty(region, "clientWidth", { configurable: true, value: 400 });

		fireEvent.scroll(region);

		expect(root.hasAttribute("data-scrolled-start")).toBe(false);
		expect(root.hasAttribute("data-scrolled-end")).toBe(false);
	});
});

describe("DataTable 固定列", () => {
	it("固定列带贴边方向与偏移，只有最靠内的一列带边缘标记", () => {
		renderTable({
			columns: [
				{
					key: "name",
					header: "名称",
					accessorKey: "name",
					sticky: "left",
					width: "120px",
				},
				{ key: "email", header: "邮箱" },
				{ key: "views", header: "浏览", sticky: "right", width: "80px" },
			],
		});

		const name = header("名称");
		expect(name.getAttribute("data-sticky")).toBe("left");
		expect(name.style.left).toBe("0px");
		expect(name.hasAttribute("data-sticky-edge")).toBe(true);
		expect(header("邮箱").hasAttribute("data-sticky")).toBe(false);
		const views = header("浏览");
		expect(views.getAttribute("data-sticky")).toBe("right");
		expect(views.style.right).toBe("0px");
		expect(screen.getByText("Alice").closest("td")?.getAttribute("data-sticky")).toBe("left");
	});

	it("右固定列按内容宽度撑开，宽度为内容加单元格左右内边距", () => {
		vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
			this: Element,
		) {
			return { width: this.hasAttribute("data-fit-content") ? 60 : 0 } as DOMRect;
		});
		vi.spyOn(window, "getComputedStyle").mockReturnValue({
			paddingLeft: "12px",
			paddingRight: "12px",
		} as CSSStyleDeclaration);

		const { container } = renderTable({
			columns: [
				{ key: "name", header: "名称", accessorKey: "name" },
				{
					key: "actions",
					header: "操作",
					sticky: "right",
					width: "40px",
					cell: () => "编辑",
				},
			],
		});

		expect(colWidths(container)).toEqual(["", "84px"]);
	});
});

describe("DataTable 排序", () => {
	it("可排序列带 aria-sort，当前没有排序时是 none，不可排序列没有", () => {
		renderTable();

		expect(header("名称").getAttribute("aria-sort")).toBe("none");
		expect(header("浏览").getAttribute("aria-sort")).toBe("none");
		expect(header("邮箱").hasAttribute("aria-sort")).toBe(false);
	});

	it("点一下升序，再点降序", () => {
		const onSortChange = vi.fn();
		function Harness() {
			const [sort, setSort] = useState<DataTableSort | null>(null);
			return (
				<DataTable<Row>
					columns={COLUMNS}
					data={ROWS}
					keyExtractor={(row) => row.id}
					sort={sort}
					onSortChange={(next) => {
						onSortChange(next);
						setSort(next);
					}}
				/>
			);
		}
		render(<Harness />);
		const name = within(header("名称")).getByRole("button");

		fireEvent.click(name);
		expect(onSortChange).toHaveBeenLastCalledWith({ key: "name", order: "asc" });
		expect(header("名称").getAttribute("aria-sort")).toBe("ascending");

		fireEvent.click(name);
		expect(onSortChange).toHaveBeenLastCalledWith({ key: "name", order: "desc" });
		expect(header("名称").getAttribute("aria-sort")).toBe("descending");

		fireEvent.click(name);
		expect(onSortChange).toHaveBeenLastCalledWith({ key: "name", order: "asc" });
	});

	it("换一列排序从升序开始，原来那列回到 none", () => {
		renderTable({ sort: { key: "name", order: "desc" }, onSortChange: vi.fn() });

		expect(header("名称").getAttribute("aria-sort")).toBe("descending");
		expect(header("浏览").getAttribute("aria-sort")).toBe("none");
	});

	it("正在排序的列名加深", () => {
		renderTable({ sort: { key: "views", order: "asc" } });

		expect(header("浏览").hasAttribute("data-sorted")).toBe(true);
		expect(header("名称").hasAttribute("data-sorted")).toBe(false);
	});
});

describe("DataTable 选择", () => {
	it("部分选中时全选框是 mixed，选满是 true", () => {
		renderTable({ selectable: true });

		expect(selectAll().getAttribute("aria-checked")).toBe("false");
		fireEvent.click(rowBox(1));
		expect(selectAll().getAttribute("aria-checked")).toBe("mixed");
		fireEvent.click(rowBox(2));
		fireEvent.click(rowBox(3));
		expect(selectAll().getAttribute("aria-checked")).toBe("true");
	});

	it("部分选中时点全选框清掉本页选择，再点才选满", () => {
		renderTable({ selectable: true });
		fireEvent.click(rowBox(1));

		fireEvent.click(selectAll());
		expect(rowBox(1).getAttribute("aria-checked")).toBe("false");

		fireEvent.click(selectAll());
		expect([1, 2, 3].map((n) => rowBox(n).getAttribute("aria-checked"))).toEqual([
			"true",
			"true",
			"true",
		]);
	});

	it("选中的行带 aria-selected，并通知调用方", () => {
		const onSelectionChange = vi.fn();
		renderTable({ selectable: true, onSelectionChange });

		fireEvent.click(rowBox(2));

		expect(screen.getByText("Bob").closest("tr")?.getAttribute("aria-selected")).toBe("true");
		expect(screen.getByText("Alice").closest("tr")?.getAttribute("aria-selected")).toBe(
			"false",
		);
		expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(["2"]));
	});

	describe("跨页", () => {
		const PAGES: Record<number, Row[]> = {
			1: ROWS.slice(0, 2),
			2: [
				{ id: "3", name: "Carol", email: "carol@example.com", views: 12 },
				{ id: "4", name: "Dave", email: "dave@example.com", views: 8 },
			],
		};
		function Paged() {
			const [page, setPage] = useState(1);
			const [ids, setIds] = useState(new Set<string>());
			return (
				<>
					<button type="button" onClick={() => setPage(2)}>
						去第二页
					</button>
					<DataTable<Row>
						columns={COLUMNS}
						data={PAGES[page]}
						keyExtractor={(row) => row.id}
						selectable
						selectedIds={ids}
						onSelectionChange={setIds}
						bulkActions={<button type="button">发布</button>}
						pagination={{
							page,
							pageSize: 2,
							total: 4,
							onChange: (next) => setPage(next),
						}}
					/>
				</>
			);
		}

		it("换页后选择保留，批量栏说明有几项不在本页", () => {
			render(<Paged />);
			fireEvent.click(rowBox(1));

			fireEvent.click(screen.getByRole("button", { name: "去第二页" }));

			expect(bulkBar()?.textContent).toContain("已选 1 项，其中 1 项不在本页");
		});

		it("全选只管本页：选满再取消不碰其它页的选择", () => {
			render(<Paged />);
			fireEvent.click(rowBox(1));
			fireEvent.click(screen.getByRole("button", { name: "去第二页" }));
			expect(selectAll().getAttribute("aria-checked")).toBe("false");

			fireEvent.click(selectAll());
			expect(bulkBar()?.textContent).toContain("已选 3 项");

			fireEvent.click(selectAll());
			expect(bulkBar()?.textContent).toContain("已选 1 项");
		});

		it("行号是跨页的全局序号", () => {
			render(<Paged />);
			fireEvent.click(screen.getByRole("button", { name: "去第二页" }));

			expect(screen.getByText("Carol").closest("tr")?.getAttribute("aria-rowindex")).toBe(
				"3",
			);
			expect(screen.getByRole("checkbox", { name: "选择第 3 行" })).toBeTruthy();
		});
	});

	it("没有 onSelectionChange 时选中态由组件自管", () => {
		renderTable({ selectable: true });

		fireEvent.click(rowBox(1));

		expect(rowBox(1).getAttribute("aria-checked")).toBe("true");
	});
});

describe("DataTable 批量操作栏", () => {
	it("没有选中项时栏不可见也不可达，选中后在表头原位出现", () => {
		renderTable({ selectable: true, bulkActions: <button type="button">发布</button> });
		expect(bulkBar()).toBeNull();

		fireEvent.click(rowBox(1));

		const bar = bulkBar();
		expect(bar?.textContent).toContain("已选 1 项");
		expect(within(bar as HTMLElement).getByRole("button", { name: "发布" })).toBeTruthy();
	});

	it("取消选择清空选择、栏随即消失，焦点回到全选框", () => {
		const onSelectionChange = vi.fn();
		renderTable({
			selectable: true,
			bulkActions: <button type="button">发布</button>,
			onSelectionChange,
		});
		fireEvent.click(rowBox(1));

		fireEvent.click(within(bulkBar() as HTMLElement).getByRole("button", { name: "取消选择" }));

		expect(onSelectionChange).toHaveBeenLastCalledWith(new Set());
		expect(bulkBar()).toBeNull();
		expect(document.activeElement).toBe(selectAll());
	});

	it("不传 bulkActions 就没有批量栏", () => {
		renderTable({ selectable: true });

		fireEvent.click(rowBox(1));

		expect(screen.queryByRole("toolbar")).toBeNull();
	});

	describe("选中全部结果", () => {
		const base = {
			selectable: true,
			bulkActions: <button type="button">发布</button>,
			pagination: { page: 1, pageSize: 3, total: 25, onChange: () => {} },
		} satisfies Partial<DataTableProps<Row>>;

		it("整页选满后提示一键选中全部，点击交给调用方", () => {
			const onSelectAll = vi.fn();
			renderTable({ ...base, onSelectAll });
			fireEvent.click(selectAll());

			fireEvent.click(screen.getByRole("button", { name: /选中全部 25 项/ }));

			expect(onSelectAll).toHaveBeenCalledTimes(1);
		});

		it("没选满本页时不提示", () => {
			renderTable({ ...base, onSelectAll: vi.fn() });
			fireEvent.click(rowBox(1));

			expect(screen.queryByRole("button", { name: /选中全部/ })).toBeNull();
		});

		it("已经选中全部结果后不再提示", () => {
			renderTable({
				...base,
				onSelectAll: vi.fn(),
				totalSelectable: 3,
			});
			fireEvent.click(selectAll());

			expect(screen.queryByRole("button", { name: /选中全部/ })).toBeNull();
		});

		it("totalSelectable 优先于分页总数", () => {
			renderTable({ ...base, onSelectAll: vi.fn(), totalSelectable: 40 });
			fireEvent.click(selectAll());

			expect(screen.getByRole("button", { name: /选中全部 40 项/ })).toBeTruthy();
		});

		it("没有 onSelectAll 就没有这个按钮", () => {
			renderTable(base);
			fireEvent.click(selectAll());

			expect(screen.queryByRole("button", { name: /选中全部/ })).toBeNull();
		});
	});
});

describe("DataTable 展开", () => {
	const expandedProps = () => ({
		expandable: true,
		renderExpandedRow: vi.fn((row: Row) => <p>详情 {row.name}</p>),
	});

	it("展开按钮带 aria-expanded，面板只在展开期间挂载", async () => {
		const props = expandedProps();
		renderTable(props);
		expect(props.renderExpandedRow).not.toHaveBeenCalled();
		const toggle = screen.getAllByRole("button", { name: "展开" })[0];
		expect(toggle.getAttribute("aria-expanded")).toBe("false");

		fireEvent.click(toggle);

		expect(toggle.getAttribute("aria-expanded")).toBe("true");
		expect(screen.getByText("详情 Alice")).toBeTruthy();
		expect(props.renderExpandedRow).not.toHaveBeenCalledWith(ROWS[1]);

		fireEvent.click(toggle);

		expect(toggle.getAttribute("aria-expanded")).toBe("false");
		await waitFor(() => expect(screen.queryByText("详情 Alice")).toBeNull(), { timeout: 1500 });
	});

	it("减弱动态下收起时面板立即卸载", () => {
		vi.stubGlobal("matchMedia", (query: string) => ({
			matches: true,
			media: query,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		}));
		renderTable(expandedProps());
		const toggle = screen.getAllByRole("button", { name: "展开" })[0];
		fireEvent.click(toggle);
		expect(screen.getByText("详情 Alice")).toBeTruthy();

		fireEvent.click(toggle);

		expect(screen.queryByText("详情 Alice")).toBeNull();
	});

	it("展开态受控，并通知变化", () => {
		const onExpandedChange = vi.fn();
		renderTable({
			...expandedProps(),
			expandedRowKeys: new Set(["2"]),
			onExpandedChange,
		});

		expect(screen.getByText("详情 Bob")).toBeTruthy();
		fireEvent.click(screen.getAllByRole("button", { name: "展开" })[0]);

		expect(onExpandedChange).toHaveBeenLastCalledWith(new Set(["2", "1"]));
	});

	it("展开列与展开行不触发整行点击", () => {
		const onRowClick = vi.fn();
		renderTable({ ...expandedProps(), onRowClick });

		fireEvent.click(screen.getAllByRole("button", { name: "展开" })[0]);

		expect(onRowClick).not.toHaveBeenCalled();
	});
});

describe("DataTable 状态", () => {
	it("出错最优先：写出现状与原因，表头保留，重试交给调用方", () => {
		const onRetry = vi.fn();
		renderTable({
			error: new Error("502 · 上游超时，已经重试 2 次"),
			loading: true,
			data: [],
			errorTitle: "没能读取文章列表",
			onRetry,
		});

		const alert = screen.getByRole("alert");
		expect(alert.textContent).toContain("没能读取文章列表");
		expect(alert.textContent).toContain("502 · 上游超时，已经重试 2 次");
		expect(header("名称")).toBeTruthy();
		fireEvent.click(within(alert).getByRole("button", { name: "重试" }));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it("没有 onRetry 就没有重试按钮", () => {
		renderTable({ error: new Error("坏了") });

		expect(screen.queryByRole("button", { name: "重试" })).toBeNull();
	});

	it("加载中：4 行骨架，表格 aria-busy，状态播报「加载中」，没有数据行", () => {
		renderTable({ loading: true, data: ROWS });

		const table = screen.getByRole("table");
		expect(table.getAttribute("aria-busy")).toBe("true");
		expect(table.querySelectorAll("tbody tr")).toHaveLength(4);
		expect(screen.getByRole("status").textContent).toBe("加载中");
		expect(screen.queryByText("Alice")).toBeNull();
		expect(header("名称")).toBeTruthy();
	});

	it("加载中优先于空", () => {
		renderTable({ loading: true, data: [], emptyTitle: "还没有文章" });

		expect(screen.queryByText("还没有文章")).toBeNull();
	});

	it("空：标题、说明与主操作由页面传入", () => {
		const onCreate = vi.fn();
		renderTable({
			data: [],
			emptyTitle: "还没有文章",
			emptyDescription: "写下第一篇，它会出现在这里",
			emptyAction: (
				<button type="button" onClick={onCreate}>
					写文章
				</button>
			),
		});

		const status = screen.getByRole("status");
		expect(status.textContent).toContain("还没有文章");
		expect(status.textContent).toContain("写下第一篇，它会出现在这里");
		fireEvent.click(within(status).getByRole("button", { name: "写文章" }));
		expect(onCreate).toHaveBeenCalledTimes(1);
	});

	it("空：没传文案时有兜底标题", () => {
		renderTable({ data: [] });

		expect(screen.getByRole("status").textContent).toContain("暂无数据");
	});

	it("筛选后为空：filtered 为真时换成筛选文案，带清除筛选", () => {
		const onClear = vi.fn();
		renderTable({
			data: [],
			filtered: true,
			emptyTitle: "还没有文章",
			filteredTitle: "没有匹配「独库 2」的文章",
			filteredAction: (
				<button type="button" onClick={onClear}>
					清除筛选
				</button>
			),
		});

		const status = screen.getByRole("status");
		expect(status.textContent).toContain("没有匹配「独库 2」的文章");
		expect(status.textContent).toContain("换个关键词，或者清除筛选");
		expect(status.textContent).not.toContain("还没有文章");
		fireEvent.click(within(status).getByRole("button", { name: "清除筛选" }));
		expect(onClear).toHaveBeenCalledTimes(1);
	});

	it("filtered 为真但有数据时照常显示数据", () => {
		renderTable({ filtered: true });

		expect(screen.getByText("Alice")).toBeTruthy();
		expect(screen.queryByRole("status")).toBeNull();
	});

	it("状态行是一个跨全部列的单元格，不破坏表格结构", () => {
		renderTable({ data: [], selectable: true });

		const cells = screen.getByRole("table").querySelectorAll("tbody td");
		expect(cells).toHaveLength(1);
		expect(cells[0].getAttribute("colspan")).toBe("4");
	});
});

describe("DataTable 列显隐与列宽", () => {
	const openMenu = () => {
		fireEvent.pointerDown(screen.getByRole("button", { name: "显示列", hidden: true }), {
			button: 0,
			ctrlKey: false,
			pointerType: "mouse",
		});
		act(() => vi.advanceTimersByTime(0));
	};
	const colHeader = (name: string) => screen.queryByRole("columnheader", { name, hidden: true });

	describe("菜单", () => {
		beforeEach(() => vi.useFakeTimers());
		afterEach(() => vi.useRealTimers());

		it("没有 storageKey 就没有「显示列」", () => {
			renderTable();

			expect(screen.queryByRole("button", { name: "显示列" })).toBeNull();
		});

		it("隐藏一列后表头与单元格都消失，显隐记在 storageKey 下", () => {
			renderTable({ storageKey: "cols" });
			openMenu();

			fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "邮箱" }));

			expect(colHeader("邮箱")).toBeNull();
			expect(screen.queryByText("alice@example.com")).toBeNull();
			expect(JSON.parse(localStorage.getItem("cols") ?? "null")).toEqual(["email"]);
		});

		it("下次渲染读回这台设备上的显隐", () => {
			localStorage.setItem("cols", JSON.stringify(["views"]));

			renderTable({ storageKey: "cols" });

			expect(colHeader("浏览")).toBeNull();
			expect(colHeader("邮箱")).toBeTruthy();
		});

		it("不可隐藏的列不在菜单里，操作列固定右侧不能隐藏", () => {
			renderTable({
				storageKey: "cols",
				columns: [
					...COLUMNS,
					{
						key: "actions",
						header: "操作",
						sticky: "right",
						hideable: false,
						cell: () => "编辑",
					},
				],
			});
			openMenu();

			expect(screen.getAllByRole("menuitemcheckbox").map((el) => el.textContent)).toEqual([
				"名称",
				"邮箱",
				"浏览",
			]);
		});

		it("重置列恢复全部列与默认列宽，并清掉记录", () => {
			localStorage.setItem("cols-widths-v2", JSON.stringify({ name: 200 }));
			const { container } = renderTable({ storageKey: "cols", resizable: true });
			expect(colWidths(container)[1]).toBe("200px");
			openMenu();
			fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "邮箱" }));
			fireEvent.click(screen.getByRole("menuitem", { name: "重置列" }));

			expect(colHeader("邮箱")).toBeTruthy();
			expect(colWidths(container)).toEqual(["32px", "", "", ""]);
			expect(JSON.parse(localStorage.getItem("cols") ?? "null")).toEqual([]);
			expect(JSON.parse(localStorage.getItem("cols-widths-v2") ?? "{}")).toEqual({});
		});

		it("没有隐藏列也没有调整过列宽时没有「重置列」", () => {
			renderTable({ storageKey: "cols" });
			openMenu();

			expect(screen.queryByRole("menuitem", { name: "重置列" })).toBeNull();
		});

		it("菜单里说明记在这台设备上", () => {
			renderTable({ storageKey: "cols" });
			openMenu();

			expect(screen.getByText("记在这台设备上")).toBeTruthy();
		});
	});

	describe("拖拽列宽", () => {
		const stubWidths = () =>
			vi
				.spyOn(Element.prototype, "getBoundingClientRect")
				.mockReturnValue({ width: 120 } as DOMRect);
		const handle = () => screen.getAllByRole("button", { name: "调整列宽" })[0];

		it("没开 resizable 就没有手柄，列设置 resizable:false 的列也没有", () => {
			const { rerender } = renderTable();
			expect(screen.queryByRole("button", { name: "调整列宽" })).toBeNull();

			rerender(
				<DataTable<Row>
					columns={[
						{ key: "name", header: "名称", resizable: false },
						{ key: "email", header: "邮箱" },
					]}
					data={ROWS}
					keyExtractor={(row) => row.id}
					resizable
				/>,
			);
			expect(screen.getAllByRole("button", { name: "调整列宽" })).toHaveLength(1);
		});

		it("拖动实时改列宽，松手后记在设备上", () => {
			stubWidths();
			const { container } = renderTable({ resizable: true, storageKey: "cols" });

			fireEvent.pointerDown(handle(), { button: 0, clientX: 500 });
			fireEvent.pointerMove(document, { clientX: 550 });
			expect(colWidths(container)[1]).toBe("170px");
			fireEvent.pointerUp(document, { clientX: 550 });

			expect(colWidths(container)[1]).toBe("170px");
			const stored = JSON.parse(localStorage.getItem("cols-widths-v2") ?? "{}");
			expect(stored.name).toBe(170);
		});

		it("最小 80：往回拖不会更窄", () => {
			stubWidths();
			const { container } = renderTable({ resizable: true, storageKey: "cols" });

			fireEvent.pointerDown(handle(), { button: 0, clientX: 500 });
			fireEvent.pointerMove(document, { clientX: 0 });
			expect(colWidths(container)[1]).toBe("80px");
			fireEvent.pointerUp(document, { clientX: 0 });

			expect(JSON.parse(localStorage.getItem("cols-widths-v2") ?? "{}").name).toBe(80);
		});

		it("columnMinWidth 可调整下限", () => {
			stubWidths();
			renderTable({ resizable: true, storageKey: "cols", columnMinWidth: 100 });

			fireEvent.pointerDown(handle(), { button: 0, clientX: 500 });
			fireEvent.pointerMove(document, { clientX: 0 });
			fireEvent.pointerUp(document, { clientX: 0 });

			expect(JSON.parse(localStorage.getItem("cols-widths-v2") ?? "{}").name).toBe(100);
		});

		it("只点一下手柄不固化列宽", () => {
			stubWidths();
			renderTable({ resizable: true, storageKey: "cols" });

			fireEvent.pointerDown(handle(), { button: 0, clientX: 500 });
			fireEvent.pointerUp(document, { clientX: 500 });

			expect(JSON.parse(localStorage.getItem("cols-widths-v2") ?? "{}")).toEqual({});
		});

		it("取消拖拽（pointercancel）还原列宽", () => {
			stubWidths();
			const { container } = renderTable({ resizable: true, storageKey: "cols" });

			fireEvent.pointerDown(handle(), { button: 0, clientX: 500 });
			fireEvent.pointerMove(document, { clientX: 560 });
			fireEvent.pointerCancel(document, { clientX: 560 });

			expect(colWidths(container)[1]).toBe("");
			expect(JSON.parse(localStorage.getItem("cols-widths-v2") ?? "{}")).toEqual({});
		});

		it("键盘 ← → 每次调整 8px", () => {
			stubWidths();
			renderTable({ resizable: true, storageKey: "cols" });

			fireEvent.keyDown(handle(), { key: "ArrowRight" });

			expect(JSON.parse(localStorage.getItem("cols-widths-v2") ?? "{}").name).toBe(128);
		});

		it("读回这台设备上的列宽", () => {
			localStorage.setItem("cols-widths-v2", JSON.stringify({ name: 210 }));

			const { container } = renderTable({ resizable: true, storageKey: "cols" });

			expect(colWidths(container)[1]).toBe("210px");
		});
	});
});

describe("DataTable 行与单元格", () => {
	it("整行点击回调，行带手型标记", () => {
		const onRowClick = vi.fn();
		renderTable({ onRowClick });

		fireEvent.click(screen.getByText("Bob"));

		expect(onRowClick).toHaveBeenCalledWith(ROWS[1]);
		expect(screen.getByText("Bob").closest("tr")?.hasAttribute("data-clickable")).toBe(true);
	});

	it("勾选框不触发整行点击", () => {
		const onRowClick = vi.fn();
		renderTable({ onRowClick, selectable: true });

		fireEvent.click(rowBox(1));

		expect(onRowClick).not.toHaveBeenCalled();
	});

	it("stopClickPropagation 的列点击不触发整行点击，其它列照常", () => {
		const onRowClick = vi.fn();
		const onEdit = vi.fn();
		renderTable({
			onRowClick,
			columns: [
				...COLUMNS,
				{
					key: "actions",
					header: "操作",
					stopClickPropagation: true,
					cell: (row) => (
						<button type="button" onClick={() => onEdit(row.id)}>
							编辑 {row.name}
						</button>
					),
				},
			],
		});

		fireEvent.click(screen.getByRole("button", { name: "编辑 Alice" }));
		expect(onEdit).toHaveBeenCalledWith("1");
		expect(onRowClick).not.toHaveBeenCalled();

		fireEvent.click(screen.getByText("alice@example.com"));
		expect(onRowClick).toHaveBeenCalledTimes(1);
	});

	it("rowClassName 附加到行", () => {
		renderTable({ rowClassName: (row) => (row.views > 20 ? "hot" : "") });

		expect(screen.getByText("Alice").closest("tr")?.classList.contains("hot")).toBe(true);
		expect(screen.getByText("Bob").closest("tr")?.classList.contains("hot")).toBe(false);
	});

	it("cell 优先于 accessorKey，数字原样渲染", () => {
		renderTable({
			columns: [
				{
					key: "name",
					header: "名称",
					accessorKey: "name",
					cell: (row) => `《${row.name}》`,
				},
				{ key: "views", header: "浏览", accessorKey: "views", align: "right" },
			],
		});

		expect(screen.getByText("《Alice》")).toBeTruthy();
		const views = screen.getByText("30").closest("td");
		expect(views?.getAttribute("data-align")).toBe("right");
	});

	it("ellipsis 列的内容单行截断", () => {
		renderTable({
			columns: [{ key: "email", header: "邮箱", accessorKey: "email", ellipsis: true }],
		});

		expect(screen.getByText("alice@example.com").classList).toContain("v-table__truncate");
	});

	it("density 写在根上", () => {
		const { container } = renderTable({ density: "compact" });

		expect((container.firstElementChild as HTMLElement).dataset.density).toBe("compact");
	});
});

describe("DataTable 分页栏", () => {
	const pagination = (
		overrides: Partial<NonNullable<DataTableProps<Row>["pagination"]>> = {},
	) => ({
		page: 2,
		pageSize: 10,
		total: 25,
		onChange: vi.fn(),
		...overrides,
	});

	it("左侧写总数与页码", () => {
		renderTable({ pagination: pagination() });

		expect(screen.getByText(/共/).textContent).toBe("共 25 条 · 第 2/3 页");
	});

	it("翻页保持每页条数", () => {
		const options = pagination();
		renderTable({ pagination: options });

		fireEvent.click(screen.getByRole("button", { name: "下一页" }));

		expect(options.onChange).toHaveBeenCalledWith(3, 10);
	});

	it("切换每页条数回到第 1 页", () => {
		const options = pagination();
		renderTable({ pagination: options });

		fireEvent.click(screen.getByRole("combobox", { name: "每页条数" }));
		fireEvent.click(screen.getByRole("option", { name: "20 条/页" }));

		expect(options.onChange).toHaveBeenCalledWith(1, 20);
	});

	it("每页条数选项默认 10 / 20 / 50", () => {
		renderTable({ pagination: pagination() });

		fireEvent.click(screen.getByRole("combobox", { name: "每页条数" }));

		expect(screen.getAllByRole("option").map((el) => el.textContent)).toEqual([
			"10 条/页",
			"20 条/页",
			"50 条/页",
		]);
	});

	it("每页条数选项可自定义", () => {
		renderTable({ pagination: pagination({ pageSizeOptions: [5, 10] }) });

		fireEvent.click(screen.getByRole("combobox", { name: "每页条数" }));

		expect(screen.getAllByRole("option").map((el) => el.textContent)).toEqual([
			"5 条/页",
			"10 条/页",
		]);
	});

	it("hidePageSizeSelect 隐藏条数选择器", () => {
		renderTable({ pagination: pagination({ hidePageSizeSelect: true }) });

		expect(screen.queryByRole("combobox", { name: "每页条数" })).toBeNull();
	});

	it("没有分页配置或总数为 0 时没有分页栏", () => {
		const { rerender } = renderTable();
		expect(screen.queryByText(/共/)).toBeNull();

		rerender(
			<DataTable<Row>
				columns={COLUMNS}
				data={[]}
				keyExtractor={(row) => row.id}
				pagination={pagination({ total: 0 })}
			/>,
		);
		expect(screen.queryByText(/共/)).toBeNull();
	});
});

describe("DataTable 工具栏", () => {
	it("工具栏槽位渲染在表格上方", () => {
		const { container } = renderTable({ toolbar: <input aria-label="搜索标题" /> });

		const input = screen.getByRole("textbox", { name: "搜索标题" });
		const region = screen.getByRole("region");
		expect(
			input.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
		expect(container.contains(input)).toBe(true);
	});
});

describe("DataTable 浮层容器", () => {
	let host: HTMLElement;
	beforeEach(() => {
		vi.useFakeTimers();
		host = document.createElement("div");
		document.body.appendChild(host);
	});
	afterEach(() => {
		vi.useRealTimers();
		host.remove();
	});

	it("每页条数的选项面板挂到 container", () => {
		renderTable({
			container: host,
			pagination: { page: 1, pageSize: 10, total: 25, onChange: vi.fn() },
		});

		fireEvent.click(screen.getByRole("combobox", { name: "每页条数" }));

		expect(host.querySelector('[role="listbox"]')).not.toBeNull();
	});

	it("显示列菜单挂到 container", () => {
		renderTable({ container: host, storageKey: "cols" });

		fireEvent.pointerDown(screen.getByRole("button", { name: "显示列" }), {
			button: 0,
			ctrlKey: false,
			pointerType: "mouse",
		});
		act(() => vi.advanceTimersByTime(0));

		expect(host.querySelector('[role="menu"]')).not.toBeNull();
	});

	it("单元格提示挂到 container", () => {
		renderTable({
			container: host,
			columns: [{ key: "email", header: "邮箱", accessorKey: "email", ellipsis: true }],
		});
		const cell = screen.getByText("alice@example.com");
		Object.defineProperty(cell, "scrollWidth", { configurable: true, value: 300 });
		Object.defineProperty(cell, "clientWidth", { configurable: true, value: 100 });

		fireEvent.pointerMove(cell, { pointerType: "mouse" });
		act(() => vi.advanceTimersByTime(0));

		expect(host.querySelector('[role="tooltip"]')).not.toBeNull();
	});

	it("没有 container 时浮层挂到 body", () => {
		renderTable({ pagination: { page: 1, pageSize: 10, total: 25, onChange: vi.fn() } });

		fireEvent.click(screen.getByRole("combobox", { name: "每页条数" }));

		expect(host.querySelector('[role="listbox"]')).toBeNull();
		expect(document.body.querySelector('[role="listbox"]')).not.toBeNull();
	});
});
