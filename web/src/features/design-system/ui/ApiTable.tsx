import { cn } from "@shared/lib/utils";
import type { ReactNode } from "react";

/**
 * ApiTable 单列定义：列头文案 + 单元格渲染器，列数与列宽由调用方自由组合。
 */
export interface ApiTableColumn<T> {
	/** 列头文案 */
	label: string;
	/** 表头单元格附加类名（列宽等） */
	headerClassName?: string;
	/** 数据单元格附加类名（字体与配色等） */
	cellClassName?: string;
	/** 单元格内容渲染器 */
	render: (row: T) => ReactNode;
}

/**
 * ApiTable - 组件文档页标准 API 参数表格
 *
 * 泛型列配置驱动：圆角灰底表头 + 行间发丝线，首末列表头自动补圆角，
 * 支持窄容器横向滚动。任意组件文档页可复用，不绑定具体列集。
 */
export function ApiTable<T>({
	title,
	columns,
	rows,
	rowKey,
}: {
	/** 表格标题 */
	title: string;
	/** 列配置（列头与单元格渲染） */
	columns: ApiTableColumn<T>[];
	/** 行数据 */
	rows: T[];
	/** 行 key 提取器 */
	rowKey: (row: T) => string;
}) {
	return (
		<div className="space-y-4 font-sans">
			<h3 className="text-lg font-bold tracking-tight text-foreground">{title}</h3>

			<div className="overflow-x-auto rounded-xl">
				<table className="w-full min-w-160 border-collapse text-left text-xs">
					<thead>
						<tr className="bg-muted/50 font-mono text-muted-foreground">
							{columns.map((col, i) => (
								<th
									className={cn(
										"py-3 px-4 font-semibold",
										i === 0 && "rounded-l-xl",
										i === columns.length - 1 && "rounded-r-xl",
										col.headerClassName,
									)}
									key={col.label}
								>
									{col.label}
								</th>
							))}
						</tr>
					</thead>
					<tbody className="divide-y divide-border/30">
						{rows.map((row) => (
							<tr className="transition-colors hover:bg-muted/15" key={rowKey(row)}>
								{columns.map((col) => (
									<td
										className={cn("py-3.5 px-4 align-top", col.cellClassName)}
										key={col.label}
									>
										{col.render(row)}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
