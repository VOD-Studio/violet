import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Label } from "@shared/ui/base/label";
import { Modal } from "@shared/ui/modal";
import { Textarea } from "@shared/ui/base/textarea";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useCreateRole } from "../api/queries";
import { type RoleForm, roleSchema } from "../model/schema";

interface CreateRoleDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * CreateRoleDialog - 创建角色对话框
 */
export function CreateRoleDialog({ open, onOpenChange }: CreateRoleDialogProps) {
    const createRole = useCreateRole();

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm<RoleForm>({
        resolver: zodResolver(roleSchema),
        defaultValues: {
            name: "",
            description: "",
        },
    });

    // 对话框关闭时重置表单
    useEffect(() => {
        if (!open) {
            reset();
        }
    }, [open, reset]);

    const onSubmit = (data: RoleForm) => {
        createRole.mutate(data, {
            onSuccess: () => {
                onOpenChange(false);
                reset();
            },
        });
    };

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title="创建角色"
            description="创建新的系统角色"
            size="sm"
            footer={
                <>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={createRole.isPending}
                    >
                        取消
                    </Button>
                    <Button type="submit" form="create-role-form" disabled={createRole.isPending}>
                        {createRole.isPending && <Loader2 className="mr-1 size-4 animate-spin" />}
                        创建
                    </Button>
                </>
            }
        >
            <form id="create-role-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* 角色名称 */}
                <div className="space-y-2">
                    <Label htmlFor="name">
                        角色名称 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="name"
                        placeholder="如：editor"
                        {...register("name")}
                        disabled={createRole.isPending}
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
                        disabled={createRole.isPending}
                    />
                    {errors.description && (
                        <p className="text-destructive text-sm">{errors.description.message}</p>
                    )}
                </div>
            </form>
        </Modal>
    );
}
