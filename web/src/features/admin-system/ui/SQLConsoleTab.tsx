import { Button } from "@shared/ui/base/button";
import { Switch } from "@shared/ui/base/switch";
import { AlertTriangle, DatabaseZap, Loader2, Play, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useExecuteSQL } from "../api/mutations";
import { useDatabaseSchema } from "../api/queries";
import type { DatabaseSchemaTableDTO, SQLResultDTO } from "../model/types";
import { SQLCodeEditor } from "./SQLCodeEditor";

const initialSQL = "SELECT now() AS server_time, current_database() AS database;";

/** 受控 PostgreSQL 控制台页签。 */
export function SQLConsoleTab() {
	const [sql, setSQL] = useState(initialSQL);
	const [allowMulti, setAllowMulti] = useState(false);
	const [withExplain, setWithExplain] = useState(false);
	const [confirmDangerous, setConfirmDangerous] = useState(false);
	const schema = useDatabaseSchema();
	const execute = useExecuteSQL();

	const handleExecute = () => {
		if (!sql.trim() || execute.isPending) return;
		execute.mutate({
			sql,
			allow_multi: allowMulti,
			with_explain: withExplain,
			confirm_dangerous: confirmDangerous,
		});
	};

	return (
		<div className="space-y-6 pt-5">
			<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
				<section className="space-y-4">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div>
							<h2 className="flex items-center gap-2 text-sm font-semibold">
								<DatabaseZap className="text-primary size-4" />
								查询编辑器
							</h2>
							<p className="text-muted-foreground mt-1 text-xs">
								默认单语句，⌘/Ctrl + Enter 执行；结果最多返回 500 行
							</p>
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="ghost"
								size="sm"
								disabled={execute.isPending}
								onClick={() => {
									setSQL(initialSQL);
									execute.reset();
								}}
							>
								<RotateCcw className="size-3.5" />
								重置
							</Button>
							<Button
								size="sm"
								disabled={!sql.trim() || execute.isPending}
								onClick={handleExecute}
							>
								{execute.isPending ? (
									<Loader2 className="size-3.5 animate-spin" />
								) : (
									<Play className="size-3.5" />
								)}
								执行
							</Button>
						</div>
					</div>

					<SQLCodeEditor
						value={sql}
						onChange={setSQL}
						onExecute={handleExecute}
						schema={schema.data}
					/>

					<div className="grid gap-3 sm:grid-cols-3">
						<OptionSwitch
							label="多语句"
							description="显式允许按顺序执行多条语句"
							checked={allowMulti}
							onCheckedChange={setAllowMulti}
						/>
						<OptionSwitch
							label="EXPLAIN"
							description="仅支持单条只读查询"
							checked={withExplain}
							onCheckedChange={setWithExplain}
						/>
						<OptionSwitch
							label="确认写入风险"
							description="写入或结构变更必须开启"
							checked={confirmDangerous}
							onCheckedChange={setConfirmDangerous}
							danger
						/>
					</div>
				</section>

				<SchemaPanel loading={schema.isLoading} tables={schema.data?.tables ?? []} />
			</div>

			{execute.error && (
				<div className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-4 py-3 text-sm">
					<AlertTriangle className="mt-0.5 size-4 shrink-0" />
					<div>
						<p className="font-medium">SQL 未执行</p>
						<p className="mt-1 text-sm">{execute.error.message}</p>
					</div>
				</div>
			)}

			{execute.data && <SQLResult result={execute.data} />}
		</div>
	);
}

interface OptionSwitchProps {
	label: string;
	description: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	danger?: boolean;
}

function OptionSwitch({
	label,
	description,
	checked,
	onCheckedChange,
	danger = false,
}: OptionSwitchProps) {
	return (
		<div className="flex items-start justify-between gap-3 rounded-lg border bg-card px-3.5 py-3">
			<span>
				<span
					className={
						danger ? "text-destructive text-sm font-medium" : "text-sm font-medium"
					}
				>
					{label}
				</span>
				<span className="text-muted-foreground mt-0.5 block text-xs leading-5">
					{description}
				</span>
			</span>
			<Switch
				aria-label={label}
				checked={checked}
				onCheckedChange={onCheckedChange}
				size="sm"
			/>
		</div>
	);
}

function SchemaPanel({ loading, tables }: { loading: boolean; tables: DatabaseSchemaTableDTO[] }) {
	return (
		<aside className="overflow-hidden rounded-xl border bg-card xl:max-h-112">
			<div className="border-b px-4 py-3.5">
				<h2 className="text-sm font-semibold">public schema</h2>
			</div>
			<div className="max-h-96 space-y-1 overflow-auto p-2 xl:max-h-96">
				{loading ? (
					<p className="text-muted-foreground flex items-center gap-2 px-2 py-4 text-xs">
						<Loader2 className="size-3.5 animate-spin" />
						读取结构
					</p>
				) : (
					tables.map((table) => (
						<details key={`${table.schema}.${table.name}`} className="group rounded-md">
							<summary className="hover:bg-muted cursor-pointer rounded-md px-2 py-1.5 font-mono text-xs">
								{table.name}
							</summary>
							<ul className="text-muted-foreground ml-3 border-l py-1 pl-3 text-xs">
								{table.columns.map((column) => (
									<li
										key={column.name}
										className="flex justify-between gap-2 py-1"
									>
										<code className="text-foreground truncate">
											{column.name}
										</code>
										<span className="shrink-0">{column.data_type}</span>
									</li>
								))}
							</ul>
						</details>
					))
				)}
			</div>
		</aside>
	);
}

function SQLResult({ result }: { result: SQLResultDTO }) {
	return (
		<section className="overflow-hidden rounded-xl border bg-card">
			<div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
				<div>
					<h2 className="text-sm font-semibold">执行结果</h2>
					<p className="text-muted-foreground mt-1 text-xs">
						{result.statement_type} · {result.elapsed_ms}ms · 影响{" "}
						{result.affected_rows} 行
					</p>
				</div>
				{result.truncated && (
					<span className="bg-primary/10 text-primary rounded-md px-2 py-1 text-xs font-medium">
						已截断至安全上限
					</span>
				)}
			</div>
			{result.columns.length > 0 ? (
				<div className="max-h-112 overflow-auto">
					<table className="w-full min-w-max text-left text-sm">
						<caption className="sr-only">SQL 查询结果</caption>
						<thead className="bg-muted/80 text-muted-foreground sticky top-0 text-xs">
							<tr>
								{result.columns.map((column) => (
									<th
										key={column}
										className="border-r px-3 py-2.5 font-medium last:border-r-0"
									>
										{column}
									</th>
								))}
							</tr>
						</thead>
						<tbody className="divide-y font-mono text-xs">
							{result.rows.map((row, rowIndex) => (
								<tr key={rowIndex}>
									{row.map((value, columnIndex) => (
										<td
											key={columnIndex}
											className="max-w-120 border-r px-3 py-2 align-top last:border-r-0"
										>
											<code className="break-words whitespace-pre-wrap">
												{formatCell(value)}
											</code>
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<p className="text-muted-foreground px-4 py-10 text-center text-sm">
					语句执行完成，没有结果集
				</p>
			)}
		</section>
	);
}

function formatCell(value: unknown): string {
	if (value === null) return "NULL";
	if (typeof value === "string") return value;
	if (typeof value === "object") return JSON.stringify(value, null, 2);
	return String(value);
}
