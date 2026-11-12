import { cn } from "cn";
import type * as React from "react";

/**
 * 静态表格的根：外层容器横向滚动，`className` 与原生属性落在 `<table>` 上。
 *
 * @remarks 勾选、排序、分页、固定列等需要状态的表格用 `DataTable`，它与这些部件共用同一份外观。
 * `data-density="compact"` 切到紧凑尺寸（表头 32、行 40）。
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
	return (
		<div data-slot="table-container" className="v-table__container">
			<table data-slot="table" className={cn("v-table", className)} {...props} />
		</div>
	);
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
	return (
		<thead data-slot="table-header" className={cn("v-table__header", className)} {...props} />
	);
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
	return <tbody data-slot="table-body" className={cn("v-table__body", className)} {...props} />;
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
	return (
		<tfoot data-slot="table-footer" className={cn("v-table__footer", className)} {...props} />
	);
}

/** 行；`data-state="selected"` 换成选中底色，悬停整行换浅底。 */
function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
	return <tr data-slot="table-row" className={cn("v-table__row", className)} {...props} />;
}

/** 表头单元格；`scope="row"` 用作行标题时按正文样式。 */
function TableHead({ className, ...props }: React.ComponentProps<"th">) {
	return <th data-slot="table-head" className={cn("v-table__head", className)} {...props} />;
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
	return <td data-slot="table-cell" className={cn("v-table__cell", className)} {...props} />;
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
	return (
		<caption
			data-slot="table-caption"
			className={cn("v-table__caption", className)}
			{...props}
		/>
	);
}

export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow };
