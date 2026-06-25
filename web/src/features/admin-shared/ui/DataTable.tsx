import { cn } from "@shared/lib/utils";
import Empty from "@shared/ui/empty";
import Loader from "@shared/ui/loader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@shared/ui/table";

export interface DataTableColumn<T> {
	key: string;
	header: React.ReactNode;
	cell: (row: T) => React.ReactNode;
	className?: string;
}

export interface DataTableProps<T> {
	columns: DataTableColumn<T>[];
	data: T[];
	loading?: boolean;
	keyExtractor: (row: T) => string;
	emptyTitle?: string;
	emptyDescription?: string;
	className?: string;
}

/**
 * DataTable - 通用数据表格
 *
 * 基于 shadcn Table 封装，内置加载与空状态。
 */
export function DataTable<T>({
	columns,
	data,
	loading,
	keyExtractor,
	emptyTitle = "NO_DATA",
	emptyDescription = "暂无数据",
	className,
}: DataTableProps<T>) {
	return (
		<div className={cn("rounded-md border border-edge-hairline", className)}>
			<Table>
				<TableHeader>
					<TableRow>
						{columns.map((col) => (
							<TableHead key={col.key} className={col.className}>
								{col.header}
							</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{loading ? (
						<TableRow>
							<TableCell colSpan={columns.length}>
								<div className="flex justify-center py-12">
									<Loader label="加载中" size="sm" />
								</div>
							</TableCell>
						</TableRow>
					) : data.length === 0 ? (
						<TableRow>
							<TableCell colSpan={columns.length}>
								<div className="py-12">
									<Empty title={emptyTitle} description={emptyDescription} size="sm" />
								</div>
							</TableCell>
						</TableRow>
					) : (
						data.map((row) => (
							<TableRow key={keyExtractor(row)}>
								{columns.map((col) => (
									<TableCell key={`${keyExtractor(row)}-${col.key}`} className={col.className}>
										{col.cell(row)}
									</TableCell>
								))}
							</TableRow>
						))
					)}
				</TableBody>
			</Table>
		</div>
	);
}
