import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Label } from "@shared/ui/base/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@shared/ui/base/select";
import { Textarea } from "@shared/ui/base/textarea";
import { Modal } from "@shared/ui/modal";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { useAdminPermissions, useCreatePermission, useUpdatePermission } from "../api/queries";
import { type PermissionForm, permissionSchema } from "../model/schema";
import type { PermissionDTO, PermissionType } from "../model/types";

interface CreatePermissionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** 传入则编辑模式，否则新建 */
    editing?: PermissionDTO | null;
}

export function CreatePermissionDialog({
    open,
    onOpenChange,
    editing,
}: CreatePermissionDialogProps) {
    const isEdit = !!editing;
    const isBuiltin = !!editing?.is_builtin;
    const createPermission = useCreatePermission();
    const updatePermission = useUpdatePermission();
    const { data: permissions = [] } = useAdminPermissions();

    // 仅 menu 节点可作为父
    const menus = permissions.filter((p) => p.type === "menu");

    const {
        register,
        handleSubmit,
        control,
        watch,
        reset,
        formState: { errors },
    } = useForm<PermissionForm>({
        resolver: zodResolver(permissionSchema),
        defaultValues: {
            type: "action",
            parentId: "",
            code: "",
            name: "",
            description: "",
            sort: 0,
        },
    });

    // 对话框开关 / 编辑对象变化时重置表单
    useEffect(() => {
        if (!open) return;
        if (editing) {
            reset({
                type: (editing.type as PermissionType) || "action",
                parentId: editing.parent_id != null ? String(editing.parent_id) : "",
                code: editing.code || "",
                name: editing.name || "",
                description: editing.description || "",
                sort: editing.sort || 0,
            });
        } else {
            reset({ type: "action", parentId: "", code: "", name: "", description: "", sort: 0 });
        }
    }, [open, editing, reset]);

    const onSubmit = (data: PermissionForm) => {
        const parentId = data.type === "action" && data.parentId ? Number(data.parentId) : null;
        if (isEdit && editing?.id) {
            updatePermission.mutate(
                {
                    id: editing.id,
                    data: {
                        // 内置不改 code；非内置可改
                        code: isBuiltin ? undefined : data.code,
                        name: data.name,
                        description: data.description || undefined,
                        parent_id: parentId,
                        sort: data.sort,
                    },
                },
                { onSuccess: () => onOpenChange(false) },
            );
        } else {
            createPermission.mutate(
                {
                    code: data.code,
                    name: data.name,
                    description: data.description || undefined,
                    type: data.type,
                    parent_id: parentId,
                    sort: data.sort,
                },
                { onSuccess: () => onOpenChange(false) },
            );
        }
    };

    const pending = createPermission.isPending || updatePermission.isPending;

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title={isEdit ? "编辑权限" : "创建权限"}
            description={
                isEdit ? "修改权限定义" : "新建权限点（menu 为分组容器，action 为可授权操作）"
            }
            size="sm"
            footer={
                <>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={pending}
                    >
                        取消
                    </Button>
                    <Button type="submit" form="permission-form" disabled={pending}>
                        {pending && <Loader2 className="mr-1 size-4 animate-spin" />}
                        {isEdit ? "保存" : "创建"}
                    </Button>
                </>
            }
        >
            <form id="permission-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* 类型：独占一行（仅 action / menu 两选项，占半行过窄） */}
                <div className="space-y-2">
                    <Label>类型</Label>
                    <Controller
                        control={control}
                        name="type"
                        render={({ field }) => (
                            <Select
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={isBuiltin || isEdit}
                            >
                                <SelectTrigger
                                    className="w-full"
                                    onPointerDown={(e) => e.stopPropagation()}
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="action">action（操作权限）</SelectItem>
                                    <SelectItem value="menu">menu（分组容器）</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    />
                    {isBuiltin && (
                        <p className="text-muted-foreground text-xs">
                            <Badge variant="secondary">内置</Badge> 类型不可更改
                        </p>
                    )}
                </div>

                {/* 父节点（action 必选；menu 类型不渲染） */}
                {watch("type") === "action" && (
                    <div className="space-y-2">
                        <Label>
                            所属分组 <span className="text-destructive">*</span>
                        </Label>
                        <Controller
                            control={control}
                            name="parentId"
                            render={({ field }) => (
                                <Select
                                    value={field.value ?? ""}
                                    onValueChange={field.onChange}
                                    disabled={pending}
                                >
                                    <SelectTrigger
                                        className="w-full"
                                        onPointerDown={(e) => e.stopPropagation()}
                                    >
                                        <SelectValue placeholder="选择 menu 分组" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {menus.map((m) => (
                                            <SelectItem key={m.id} value={String(m.id)}>
                                                {m.name} ({m.code})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {errors.parentId && (
                            <p className="text-destructive text-sm">{errors.parentId.message}</p>
                        )}
                    </div>
                )}

                {/* 代码 */}
                <div className="space-y-2">
                    <Label htmlFor="code">
                        权限代码 <span className="text-destructive">*</span>
                    </Label>
                    <Input id="code" disabled={isBuiltin || pending} {...register("code")} />
                    {errors.code && (
                        <p className="text-destructive text-sm">{errors.code.message}</p>
                    )}
                    <p className="text-muted-foreground text-xs">
                        menu 为纯小写字母（如 post）；action 为 module:action（如 post:create）
                    </p>
                </div>

                {/* 名称 */}
                <div className="space-y-2">
                    <Label htmlFor="name">
                        权限名称 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="name"
                        placeholder="如：创建文章"
                        disabled={pending}
                        {...register("name")}
                    />
                    {errors.name && (
                        <p className="text-destructive text-sm">{errors.name.message}</p>
                    )}
                </div>

                {/* 描述 */}
                <div className="space-y-2">
                    <Label htmlFor="description">描述</Label>
                    <Textarea
                        id="description"
                        rows={2}
                        disabled={pending}
                        {...register("description")}
                    />
                    {errors.description && (
                        <p className="text-destructive text-sm">{errors.description.message}</p>
                    )}
                </div>

                {/* 排序 */}
                <div className="space-y-2">
                    <Label htmlFor="sort">排序</Label>
                    <Input
                        id="sort"
                        type="number"
                        min={0}
                        disabled={pending}
                        {...register("sort", { valueAsNumber: true })}
                    />
                    {errors.sort && (
                        <p className="text-destructive text-sm">{errors.sort.message}</p>
                    )}
                </div>
            </form>
        </Modal>
    );
}
