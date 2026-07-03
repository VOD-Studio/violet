import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@shared/ui/base/table";
import type { SystemDiskInfoDTO } from "../../model/types";
import { formatBytes, formatPercent } from "../format";

/** DiskTableProps - 磁盘列表 props */
interface DiskTableProps {
    /** 各挂载点磁盘使用情况 */
    disks: SystemDiskInfoDTO[];
}

/** DiskTable - 磁盘使用情况表格 */
export function DiskTable({ disks }: DiskTableProps) {
    if (!disks.length) {
        return <p className="text-muted-foreground text-sm">暂无磁盘数据</p>;
    }
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>挂载点</TableHead>
                    <TableHead>设备</TableHead>
                    <TableHead className="text-right">总容量</TableHead>
                    <TableHead className="text-right">已用</TableHead>
                    <TableHead className="text-right">使用率</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {disks.map((d) => (
                    <TableRow key={d.path}>
                        <TableCell className="font-mono text-xs">{d.path}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                            {d.device}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                            {formatBytes(d.totalBytes)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                            {formatBytes(d.usedBytes)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                            <UsageText percent={d.usedPercent} />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

/** UsageText - 按使用率着色（≥85% 红、≥70% 黄、否则默认） */
function UsageText({ percent }: { percent: number }) {
    const color =
        percent >= 85
            ? "text-destructive"
            : percent >= 70
              ? "text-amber-600 dark:text-amber-400"
              : "text-foreground";
    return <span className={color}>{formatPercent(percent)}</span>;
}
