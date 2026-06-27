import { Button } from "@shared/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@shared/ui/dialog";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Textarea } from "@shared/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useUpdateRole } from "../api/queries";
import type { RoleDTO } from "../model/types";

/**
 * 编辑角色表单 Schema
 */
const editRoleSchema = z.object({
    name: z
        .string()
        .min(2, "角色名称至少 2 个字符")
        .max(50, "角色名称最多 50 个字符")
        .regex(/^[a-zA-Z0-9_-]+$/, "角色名称只能包含字母、数字、下划线和连字符"),
    description: z.string().min(2, "角色描述至少 2 个字符").max(200, "角色描述最多 200 个字符"),
});

type EditRoleForm = z.infer<typeof editRoleSchema>;

interface EditRoleDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    role: RoleDTO;
}

/**
 * EditRoleDialog - 编辑角色对话框
 */
export function EditRoleDialog({ open, onOpenChange, role }: EditRoleDialogProps) {
    const updateRole = useUpdateRole();

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm<EditRoleForm>({
        resolver: zodResolver(editRoleSchema),
        defaultValues: {
            name: role.name || "",
            description: role.description || "",
        },
    });

    // 角色变化时更新表单默认值
    useEffect(() => {
        reset({
            name: role.name || "",
            description: role.description || "",
        });
    }, [role, reset]);

    // 对话框关闭时重置表单
    useEffect(() => {
        if (!open) {
            reset();
        }
    }, [open, reset]);

    const onSubmit = (data: EditRoleForm) => {
        if (!role.id) return;
        updateRole.mutate(
            { id: role.id, data },
            {
                onSuccess: () => {
                    onOpenChange(false);
                    reset();
                },
            },
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>编辑角色</DialogTitle>
                    <DialogDescription>修改角色信息</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {/* 角色名称 */}
                    <div className="space-y-2">
                        <Label htmlFor="name">
                            角色名称 <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="name"
                            placeholder="如：editor"
                            {...register("name")}
                            disabled={updateRole.isPending}
                        />
                        {errors.name && (
                            <p className="text-destructive text-sm">{errors.name.message}</p>
                        )}
                        <p className="text-muted-foreground text-xs">
                            只能包含字母、数字、下划线和连字符
                        </p>
                    </div>

                    {/* 角色描述 */}
                    <div className="space-y-2">
                        <Label htmlFor="description">
                            角色描述 <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                            id="description"
                            placeholder="如：内容编辑"
                            rows={3}
                            {...register("description")}
                            disabled={updateRole.isPending}
                        />
                        {errors.description && (
                            <p className="text-destructive text-sm">
                                {errors.description.message}
                            </p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={updateRole.isPending}
                        >
                            取消
                        </Button>
                        <Button type="submit" disabled={updateRole.isPending}>
                            {updateRole.isPending && (
                                <Loader2 className="mr-1 size-4 animate-spin" />
                            )}
                            保存
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
