import { PageShell } from "@features/admin-layout/ui/PageShell";
import { DataTable } from "@features/admin-shared/ui/data-table";
import type { DataTableColumn, DataTableSort } from "@features/admin-shared/ui/data-table";
import { exportToCsv } from "@features/admin-shared/ui/data-table";
import { useDebouncedValue } from "@features/admin-shared/ui/data-table";
import { Badge } from "@shared/ui/badge";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Download, Pencil, RefreshCw, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

export const Route = createFileRoute("/admin/users")({
    component: AdminUsers,
});

type User = {
    id: string;
    nickname: string;
    email: string;
    role: "SuperAdmin" | "Editor" | "User";
    status: "active" | "disabled";
    createdAt: string;
};

type Role = User["role"];
const ROLES: Role[] = ["SuperAdmin", "Editor", "User"];

/** 生成足够多的 mock 数据以演示分页与跨页选择 */
function buildMockData(): User[] {
    return Array.from({ length: 47 }, (_, i) => {
        const num = i + 1;
        const role: Role = i === 0 ? "SuperAdmin" : (ROLES[i % ROLES.length] ?? "User");
        return {
            id: String(num),
            nickname: `用户${num.toString().padStart(2, "0")}`,
            email: `user${num}@example.com`,
            role,
            status: num % 7 === 0 ? "disabled" : "active",
            createdAt: `2024-${String((num % 12) + 1).padStart(2, "0")}-15`,
        };
    });
}

const ALL_DATA = buildMockData();

const columns: DataTableColumn<User>[] = [
    { key: "nickname", header: "昵称", accessorKey: "nickname", sortable: true, ellipsis: true },
    {
        key: "email",
        header: "邮箱",
        accessorKey: "email",
        sortable: true,
        ellipsis: true,
        tooltip: (row) => `点击邮箱 ${row.email} 发送邮件`,
    },
    {
        key: "role",
        header: "角色",
        sortable: true,
        cell: (row) => (
            <Badge variant={row.role === "SuperAdmin" ? "default" : "secondary"}>{row.role}</Badge>
        ),
    },
    {
        key: "status",
        header: "状态",
        cell: (row) => (
            <Badge variant={row.status === "active" ? "outline" : "destructive"}>
                {row.status === "active" ? "正常" : "已禁用"}
            </Badge>
        ),
    },
    { key: "createdAt", header: "注册时间", accessorKey: "createdAt", sortable: true },
    {
        key: "actions",
        header: "操作",
        hideable: false,
        sticky: "right",
        width: "96px",
        align: "center",
        cell: () => (
            <div className="flex justify-center gap-1">
                <Button variant="ghost" size="icon-sm" title="编辑">
                    <Pencil className="size-3.5" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    title="删除"
                    className="hover:bg-destructive/10 hover:text-destructive"
                >
                    <Trash2 className="size-3.5" />
                </Button>
            </div>
        ),
    },
];

/** 客户端模拟服务端：按搜索词过滤 + 排序 + 分页 */
function useMockServer() {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [sort, setSort] = useState<DataTableSort | null>(null);
    const [keyword, setKeyword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    // 防抖：input 受控即时显示，filter 用延迟值避免每次击键重渲染
    const debouncedKeyword = useDebouncedValue(keyword, 300);

    const filtered = useMemo(() => {
        const q = debouncedKeyword.trim().toLowerCase();
        if (!q) return ALL_DATA;
        return ALL_DATA.filter(
            (u) =>
                u.nickname.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q) ||
                u.role.toLowerCase().includes(q),
        );
    }, [debouncedKeyword]);

    const sorted = useMemo(() => {
        if (!sort) return filtered;
        const copy = [...filtered];
        copy.sort((a, b) => {
            const av = a[sort.key as keyof User];
            const bv = b[sort.key as keyof User];
            const cmp = String(av).localeCompare(String(bv), "zh");
            return sort.order === "asc" ? cmp : -cmp;
        });
        return copy;
    }, [filtered, sort]);

    const total = sorted.length;
    const start = (page - 1) * pageSize;
    const data = sorted.slice(start, start + pageSize);

    function refetch(simulateError = false) {
        setLoading(true);
        setError(null);
        setTimeout(() => {
            setLoading(false);
            if (simulateError) setError(new Error("模拟请求失败：网络超时"));
        }, 600);
    }

    return {
        page,
        pageSize,
        sort,
        keyword,
        loading,
        error,
        total,
        data,
        isFiltered: debouncedKeyword.trim().length > 0,
        setPage,
        setPageSize: (size: number) => {
            setPageSize(size);
            setPage(1);
        },
        setSort,
        setKeyword,
        refetch,
    };
}

function AdminUsers() {
    const server = useMockServer();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");

    return (
        <PageShell title="用户管理" description="演示 DataTable 全部功能">
            <DataTable
                columns={columns}
                data={server.data}
                keyExtractor={(row) => row.id}
                page={server.page}
                pageSize={server.pageSize}
                total={server.total}
                onPageChange={server.setPage}
                onPageSizeChange={server.setPageSize}
                sort={server.sort}
                onSortChange={server.setSort}
                selectable
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                bulkActions={
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                            toast.success(`已删除 ${selectedIds.size} 个用户（演示）`);
                            setSelectedIds(new Set());
                        }}
                    >
                        <Trash2 className="size-3.5" />
                        批量删除
                    </Button>
                }
                loading={server.loading}
                error={server.error}
                onRetry={() => server.refetch(false)}
                storageKey="admin-users-columns"
                filtered={server.isFiltered}
                density={density}
                stickyHeader
                maxHeight="60vh"
                resizable
                expandable
                renderExpandedRow={(row) => (
                    <div className="text-muted-foreground space-y-1 text-sm">
                        <p>ID：{row.id}</p>
                        <p>邮箱：{row.email}</p>
                        <p>角色：{row.role}</p>
                        <p>状态：{row.status === "active" ? "正常" : "已禁用"}</p>
                        <p>注册时间：{row.createdAt}</p>
                    </div>
                )}
                onRowClick={(row) => toast.info(`点击查看用户 ${row.nickname}（演示）`)}
                caption="用户列表"
                emptyTitle="NO_USERS"
                emptyDescription="暂无用户"
                toolbar={
                    <>
                        <div className="relative min-w-[200px] max-w-[320px] flex-1">
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="搜索昵称 / 邮箱 / 角色..."
                                value={server.keyword}
                                onChange={(e) => {
                                    server.setKeyword(e.target.value);
                                    server.setPage(1);
                                }}
                                className="pl-9"
                            />
                        </div>
                        <Select
                            value={density}
                            onValueChange={(v) => setDensity(v as "comfortable" | "compact")}
                        >
                            <SelectTrigger size="sm" className="h-9 w-[120px]" aria-label="行密度">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="comfortable">标准密度</SelectItem>
                                <SelectItem value="compact">紧凑密度</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" onClick={() => server.refetch(false)}>
                            <RefreshCw className="size-3.5" />
                            刷新
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => server.refetch(true)}>
                            <AlertTriangle className="size-3.5" />
                            模拟错误
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                exportToCsv("用户列表", columns, server.data);
                                toast.success("已导出当前页 CSV");
                            }}
                        >
                            <Download className="size-3.5" />
                            导出 CSV
                        </Button>
                    </>
                }
            />
        </PageShell>
    );
}
