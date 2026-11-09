import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "../table";

afterEach(cleanup);

function Usage() {
	return (
		<Table className="custom-table" aria-label="用量">
			<TableCaption>最近 30 天</TableCaption>
			<TableHeader>
				<TableRow>
					<TableHead scope="col">模型</TableHead>
					<TableHead scope="col" className="text-right">
						调用
					</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				<TableRow data-state="selected">
					<TableHead scope="row">gpt</TableHead>
					<TableCell className="text-right">12</TableCell>
				</TableRow>
			</TableBody>
			<TableFooter>
				<TableRow>
					<TableCell>合计</TableCell>
					<TableCell>12</TableCell>
				</TableRow>
			</TableFooter>
		</Table>
	);
}

describe("Table 原语", () => {
	it("保持原生表格语义：caption 命名、列头、行头", () => {
		render(<Usage />);

		expect(screen.getByRole("table", { name: "用量" })).toBeTruthy();
		expect(screen.getByRole("columnheader", { name: "模型" })).toBeTruthy();
		expect(screen.getByRole("rowheader", { name: "gpt" })).toBeTruthy();
		expect(screen.getByText("最近 30 天").tagName).toBe("CAPTION");
	});

	it("className 与原生属性落在对应元素上，并保留调用方的类名", () => {
		render(<Usage />);

		expect(screen.getByRole("table").classList).toContain("custom-table");
		expect(screen.getByRole("columnheader", { name: "调用" }).classList).toContain(
			"text-right",
		);
		expect(screen.getAllByRole("cell", { name: "12" })[0].classList).toContain("text-right");
	});

	it("每个部件带稳定的 data-slot，table 外有横向滚动容器", () => {
		const { container } = render(<Usage />);

		const slots = Array.from(container.querySelectorAll("[data-slot]"), (el) =>
			el.getAttribute("data-slot"),
		);
		expect(new Set(slots)).toEqual(
			new Set([
				"table-container",
				"table",
				"table-caption",
				"table-header",
				"table-row",
				"table-head",
				"table-body",
				"table-cell",
				"table-footer",
			]),
		);
		expect(container.querySelector("[data-slot=table-container] > table")).not.toBeNull();
	});

	it("选中的行通过 data-state 表达", () => {
		render(<Usage />);

		expect(screen.getByRole("rowheader", { name: "gpt" }).closest("tr")?.dataset.state).toBe(
			"selected",
		);
	});
});
