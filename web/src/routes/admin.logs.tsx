import { useAdminAuditLogs } from "@features/admin-audit-logs/api/queries";
import type { AuditEventDTO, FieldChangeDTO } from "@features/admin-audit-logs/model/types";
import { PageShell } from "@features/admin-layout/ui/PageShell";
import { DataTable, type DataTableColumn } from "@features/admin-shared/ui/data-table";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@shared/ui/base/select";
import { Modal } from "@shared/ui/modal";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useState } from "react";

/** 操作日志分页大小 */
const PAGE_SIZE = 20;

/** 操作类型选项（与后端受控枚举对齐） */
const ACTION_OPTIONS = [
    { value: "", label: "全部动作" },
    { value: "create", label: "创建" },
    { value: "update", label: "更新" },
    { value: "delete", label: "删除" },
    { value: "publish", label: "发布" },
    { value: "unpublish", label: "取消发布" },
    { value: "archive", label: "归档" },
    { value: "update_role", label: "改角色" },
    { value: "update_status", label: "改状态" },
    { value: "batch_update", label: "批量更新" },
    { value: "update_perms", label: "改权限" },
    { value: "approve", label: "审核通过" },
    { value: "reject", label: "标记垃圾" },
    { value: "login", label: "登录" },
    { value: "logout", label: "登出" },
    { value: "login_failed", label: "登录失败" },
];

/** 资源类型选项（与后端订阅者映射对齐） */
const RESOURCE_OPTIONS = [
    { value: "", label: "全部资源" },
    { value: "user", label: "用户" },
    { value: "post", label: "文章" },
    { value: "role", label: "角色" },
    { value: "announcement", label: "公告" },
    { value: "comment", label: "评论" },
    { value: "settings", label: "站点设置" },
    { value: "api_token", label: "访问令牌" },
    { value: "auth", label: "认证" },
];

function AdminLogsPage() {
    const [page, setPage] = useState(1);
    const [action, setAction] = useState("");
    const [resourceType, setResourceType] = useState("");
    const [actor, setActor] = useState("");
    const { data, isLoading, error, refetch } = useAdminAuditLogs({
        page,
        limit: PAGE_SIZE,
        action: action || undefined,
        resource_type: resourceType || undefined,
        actor: actor || undefined,
    });
    const [detailLog, setDetailLog] = useState<AuditEventDTO | null>(null);

    const columns: DataTableColumn<AuditEventDTO>[] = [
        {
            key: "occurred_at",
            header: "时间",
            hideable: false,
            sortable: true,
            cell: (row) =>
                format(new Date(row.occurred_at), "MM-dd HH:mm:ss", {
                    locale: zhCN,
                }),
        },
        {
            key: "actor",
            header: "操作人",
            cell: (row) => row.actor.user_name || row.actor.user_id || "匿名",
        },
        {
            key: "action",
            header: "动作",
            cell: (row) => <Badge variant="secondary">{row.action}</Badge>,
        },
        {
            key: "resource",
            header: "资源",
            ellipsis: true,
            cell: (row) =>
                `${row.resource.type}${row.resource.name ? ` · ${row.resource.name}` : ""}`,
        },
        {
            key: "changes",
            header: "变更",
            ellipsis: true,
            cell: (row) => {
                if (!row.changes?.length) {
                    return <span className="text-muted-foreground">-</span>;
                }
                return (
                    <span className="text-xs text-muted-foreground">
                        {row.changes.map((c) => c.field).join(", ")}
                    </span>
                );
            },
        },
        {
            key: "actor_ip",
            header: "IP",
            cell: (row) => row.actor.ip_address || "-",
        },
        {
            key: "_detail",
            header: "操作",
            sticky: "right",
            width: "80px",
            cell: (row) => (
                <Button variant="ghost" size="sm" onClick={() => setDetailLog(row)}>
                    详情
                </Button>
            ),
        },
    ];

    return (
        <PageShell title="操作日志" description="用户操作审计记录">
            {/* 过滤栏 */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <Select
                    value={action}
                    onValueChange={(v) => {
                        setAction(v);
                        setPage(1);
                    }}
                >
                    <SelectTrigger className="w-36">
                        <SelectValue placeholder="全部动作" />
                    </SelectTrigger>
                    <SelectContent>
                        {ACTION_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                                {o.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select
                    value={resourceType}
                    onValueChange={(v) => {
                        setResourceType(v);
                        setPage(1);
                    }}
                >
                    <SelectTrigger className="w-36">
                        <SelectValue placeholder="全部资源" />
                    </SelectTrigger>
                    <SelectContent>
                        {RESOURCE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                                {o.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Input
                    className="w-48"
                    placeholder="操作人 UUID"
                    value={actor}
                    onChange={(e) => {
                        setActor(e.target.value);
                        setPage(1);
                    }}
                />
            </div>

            <DataTable<AuditEventDTO>
                data={data?.data ?? []}
                columns={columns}
                keyExtractor={(row) => row.event_id}
                page={page}
                pageSize={PAGE_SIZE}
                total={data?.pagination?.total ?? 0}
                onPageChange={setPage}
                selectable={false}
                loading={isLoading}
                error={error ? new Error(error.message) : null}
                onRetry={() => refetch()}
                storageKey="admin-audit-logs-columns"
                caption="操作日志列表"
                emptyTitle="暂无操作日志"
                emptyDescription="还没有任何用户操作记录"
            />

            <Modal
                open={!!detailLog}
                onOpenChange={(open) => !open && setDetailLog(null)}
                title="操作详情"
                size="lg"
            >
                {detailLog && <AuditEventDetail event={detailLog} />}
            </Modal>
        </PageShell>
    );
}

/** AuditEventDetail - 事件详情（Actor + 资源 + Changes before/after） */
function AuditEventDetail({ event }: { event: AuditEventDTO }) {
    return (
        <div className="space-y-5 text-sm">
            {/* 基础信息：两列网格，短字段 */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <DetailItem label="动作" value={event.action} />
                <DetailItem
                    label="时间"
                    value={format(new Date(event.occurred_at), "yyyy-MM-dd HH:mm:ss")}
                />
                <DetailItem
                    label="操作人"
                    value={event.actor.user_name || event.actor.user_id || "匿名"}
                />
                <DetailItem label="IP" value={event.actor.ip_address || "-"} />
            </div>

            {/* 资源：拆行展示（type/id/name 各自一行，长 ID 可换行） */}
            <div className="rounded-md border p-3">
                <div className="mb-1 text-xs text-muted-foreground">资源</div>
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{event.resource.type}</Badge>
                    {event.resource.name && <span className="text-sm">{event.resource.name}</span>}
                </div>
                {event.resource.id && (
                    <div className="mt-1 break-all font-mono text-xs text-muted-foreground">
                        #{event.resource.id}
                    </div>
                )}
            </div>

            {/* UA：单独一行（长字符串不挤两列） */}
            <DetailItem label="UA" value={event.actor.user_agent || "-"} />

            {event.changes && event.changes.length > 0 && (
                <div>
                    <h4 className="mb-2 font-medium">变更内容</h4>
                    <div className="space-y-2">
                        {event.changes.map((c) => (
                            <ChangeRow key={c.field} change={c} />
                        ))}
                    </div>
                </div>
            )}

            {event.metadata && Object.keys(event.metadata).length > 0 && (
                <div>
                    <h4 className="mb-2 font-medium">元数据</h4>
                    <pre className="max-h-48 overflow-auto rounded bg-muted p-3 font-mono text-xs">
                        {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}

/** DetailItem - 键值展示行 */
function DetailItem({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="break-all">{value}</div>
        </div>
    );
}

/** ChangeRow - 单字段 before/after 变更 */
function ChangeRow({ change }: { change: FieldChangeDTO }) {
    return (
        <div className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-xs">
            <Badge variant="outline">{change.field}</Badge>
            <span className="text-muted-foreground line-through">{formatValue(change.from)}</span>
            <span aria-hidden>→</span>
            <span className="font-medium">{formatValue(change.to)}</span>
        </div>
    );
}

/** formatValue - 任意值展示（对象 JSON 化，其余 String） */
function formatValue(v: unknown): string {
    if (v === null || v === undefined) {
        return "null";
    }
    if (typeof v === "object") {
        return JSON.stringify(v);
    }
    return String(v);
}

export const Route = createFileRoute("/admin/logs")({
    component: AdminLogsPage,
});
