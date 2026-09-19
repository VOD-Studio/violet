import { Button } from "@shared/ui/base/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@shared/ui/base/select";
import { Switch } from "@shared/ui/base/switch";
import { Segmented, type SegmentedItem } from "@shared/ui/segmented";
import { Download, FileDown, Loader2, SquareTerminal, Table2 } from "lucide-react";
import { useState } from "react";
import { useExportData } from "../api/mutations";
import { useDatabaseSchema } from "../api/queries";
import type { ExportInput } from "../model/types";
import { saveDownloadedFile } from "./download";
import { SQLCodeEditor } from "./SQLCodeEditor";

type ExportSource = "table" | "query";
type ExportFormat = "csv" | "sql";

const SOURCE_SEGMENTS: SegmentedItem<ExportSource>[] = [
	{ value: "table", label: "按表导出" },
	{ value: "query", label: "只读查询" },
];
const FORMAT_SEGMENTS: SegmentedItem<ExportFormat>[] = [
	{ value: "csv", label: "CSV" },
	{ value: "sql", label: "SQL INSERT" },
];

/** CSV 与 SQL INSERT 流式导出页签。 */
export function DataExportTab() {
	const [source, setSource] = useState<ExportSource>("table");
	const [format, setFormat] = useState<ExportFormat>("csv");
	const [selectedTable, setSelectedTable] = useState("");
	const [query, setQuery] = useState("SELECT * FROM posts ORDER BY created_at DESC;");
	const [includeColumns, setIncludeColumns] = useState(true);
	const schema = useDatabaseSchema();
	const exportMutation = useExportData();
	const firstTable = schema.data?.tables[0];
	const tableValue =
		selectedTable || (firstTable ? `${firstTable.schema}.${firstTable.name}` : "");

	const handleExport = () => {
		const [tableSchema = "", table = ""] = tableValue.split(".", 2);
		const input: ExportInput = {
			source,
			format,
			include_columns: includeColumns,
			schema: source === "table" ? tableSchema : "",
			table: source === "table" ? table : "",
			query: source === "query" ? query : "",
		};
		exportMutation.mutate(input, { onSuccess: saveDownloadedFile });
	};

	const disabled = exportMutation.isPending || (source === "table" ? !tableValue : !query.trim());

	return (
		<div className="pt-5">
			<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
				<section className="space-y-5">
					<div>
						<h2 className="flex items-center gap-2 text-sm font-semibold">
							<FileDown className="text-primary size-4" />
							创建数据附件
						</h2>
						<p className="text-muted-foreground mt-1 text-xs">
							服务端逐行写入响应，不会把完整导出加载进 API 内存
						</p>
					</div>

					<Segmented
						value={source}
						onValueChange={setSource}
						segments={SOURCE_SEGMENTS}
					/>

					{source === "table" ? (
						<div className="rounded-xl border bg-card p-5">
							<label className="text-sm font-medium" htmlFor="system-export-table">
								数据表
							</label>
							<p className="text-muted-foreground mt-1 mb-3 text-xs">
								表名来自数据库 schema 白名单，不能手工输入
							</p>
							<Select value={tableValue} onValueChange={setSelectedTable}>
								<SelectTrigger
									id="system-export-table"
									className="w-full sm:max-w-100"
								>
									<SelectValue
										placeholder={
											schema.isLoading ? "读取数据表…" : "选择数据表"
										}
									/>
								</SelectTrigger>
								<SelectContent>
									{schema.data?.tables.map((table) => {
										const value = `${table.schema}.${table.name}`;
										return (
											<SelectItem key={value} value={value}>
												{value}
											</SelectItem>
										);
									})}
								</SelectContent>
							</Select>
						</div>
					) : (
						<div className="space-y-2">
							<div className="flex items-center gap-2">
								<SquareTerminal className="text-muted-foreground size-4" />
								<p className="text-sm font-medium">只读 SQL</p>
							</div>
							<SQLCodeEditor
								initialValue={query}
								onChange={setQuery}
								onExecute={handleExport}
								schema={schema.data}
							/>
						</div>
					)}
				</section>

				<aside className="self-start rounded-xl border bg-card p-5">
					<h2 className="text-sm font-semibold">附件选项</h2>
					<div className="mt-4 space-y-5">
						<div>
							<p className="text-muted-foreground mb-2 text-xs">格式</p>
							<Segmented
								value={format}
								onValueChange={setFormat}
								segments={FORMAT_SEGMENTS}
								block
							/>
						</div>
						<div className="flex items-center justify-between gap-3">
							<span>
								<span className="block text-sm font-medium">包含列名</span>
								<span className="text-muted-foreground mt-0.5 block text-xs">
									CSV 表头或 INSERT 列清单
								</span>
							</span>
							<Switch
								aria-label="包含导出列名"
								checked={includeColumns}
								onCheckedChange={setIncludeColumns}
								size="sm"
							/>
						</div>
						<Button className="w-full" disabled={disabled} onClick={handleExport}>
							{exportMutation.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Download className="size-4" />
							)}
							下载 {format === "csv" ? "CSV" : "SQL"}
						</Button>
						{exportMutation.error && (
							<p className="text-destructive text-xs leading-5">
								{exportMutation.error.message}
							</p>
						)}
					</div>
				</aside>
			</div>
			<div className="text-muted-foreground mt-6 flex items-start gap-2 rounded-lg border px-4 py-3 text-xs leading-5">
				<Table2 className="mt-0.5 size-3.5 shrink-0" />
				SQL 格式只包含 INSERT 数据，不包含建表语句。查询模式会写入逻辑表名
				export_result，适合审阅或二次处理。
			</div>
		</div>
	);
}
