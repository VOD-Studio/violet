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
import { useCreateRole } from "../api/queries";

/**
 * 创建角色表单 Schema
 */
const createRoleSchema = z.object({
    name: z
        .string()
        .min(2, "角色名称至少 2 个字符")
        .max(50, "角色名称最多 50 个字符")
        .regex(/^[a-zA-Z0-9_-]+$/, "角色名称只能包含字母、数字、下划线和连字符"),
    description: z.string().min(2, "角色描述至少 2 个字符").max(200, "角色描述最多 200 个字符"),
});

type CreateRoleForm = z.infer<typeof createRoleSchema>;

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
    } = useForm<CreateRoleForm>({
        resolver: zodResolver(createRoleSchema),
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

    const onSubmit = (data: CreateRoleForm) => {
        createRole.mutate(data, {
            onSuccess: () => {
                onOpenChange(false);
                reset();
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>创建角色</DialogTitle>
                    <DialogDescription>创建新的系统角色</DialogDescription>
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
                            disabled={createRole.isPending}
                        >
                            取消
                        </Button>
                        <Button type="submit" disabled={createRole.isPending}>
                            {createRole.isPending && (
                                <Loader2 className="mr-1 size-4 animate-spin" />
                            )}
                            创建
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
