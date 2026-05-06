/**
 * 操作日志页面
 * 展示系统操作审计记录，支持分页浏览
 */

import { useAuditLogs, actionLabels, resourceTypeLabels } from "@/features/admin/logs";
import type { AuditLog } from "@/features/admin/logs/types";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ErrorFallback } from "@/components/shared/ErrorFallback";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { FileText } from "lucide-react";

/**
 * 操作类型 Badge 颜色
 */
function getActionColor(action: string): "default" | "secondary" | "destructive" | "outline" {
  if (action === "delete" || action === "ban") return "destructive";
  if (action === "create" || action === "approve") return "default";
  return "secondary";
}

/**
 * 日志列表表格骨架屏
 */
function LogsTableSkeleton() {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">时间</TableHead>
            <TableHead className="w-24">用户</TableHead>
            <TableHead className="w-20">操作</TableHead>
            <TableHead className="w-20">资源</TableHead>
            <TableHead>详情</TableHead>
            <TableHead className="w-28">IP</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 10 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-12" /></TableCell>
              <TableCell><Skeleton className="h-4 w-12" /></TableCell>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * 操作日志管理页面
 */
export default function Logs() {
  const { data, isLoading, error, refetch } = useAuditLogs(0, 50);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">操作日志</h1>
          <p className="text-muted-foreground">加载中...</p>
        </div>
        <LogsTableSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">操作日志</h1>
        <ErrorFallback error={error.message} onRetry={refetch} />
      </div>
    );
  }

  const logs = data?.logs ?? [];

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">操作日志</h1>
        <p className="text-muted-foreground">
          系统操作审计记录，共 {data?.total ?? 0} 条
        </p>
      </div>

      {/* 空数据状态 */}
      {logs.length === 0 && (
        <EmptyState
          title="暂无操作日志"
          description="系统尚未记录任何操作"
          icon={<FileText className="size-12" />}
        />
      )}

      {/* 日志列表表格 */}
      {logs.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">时间</TableHead>
                <TableHead className="w-24">用户</TableHead>
                <TableHead className="w-20">操作</TableHead>
                <TableHead className="w-20">资源</TableHead>
                <TableHead>详情</TableHead>
                <TableHead className="w-28">IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log: AuditLog) => (
                <TableRow key={log.id}>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(log.created_at).toLocaleString("zh-CN", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="font-medium">
                    {log.user_name || "未知用户"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getActionColor(log.action)}>
                      {actionLabels[log.action] || log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {resourceTypeLabels[log.resource_type] || log.resource_type}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {log.resource_name || log.resource_id || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {log.ip_address || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}