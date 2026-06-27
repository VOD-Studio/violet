import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/shared/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { Loader2 } from "lucide-react";
import { useUpdateUser } from "../api/queries";
import { useEffect } from "react";
import type { AdminUserDTO } from "../model/types";

/**
 * 编辑用户表单验证规则
 * 注意：密码字段可选（不修改时留空）
 */
const editUserSchema = z.object({
    username: z
        .string()
        .min(3, "用户名至少 3 个字符")
        .max(32, "用户名最多 32 个字符")
        .regex(/^[a-zA-Z0-9_-]+$/, "用户名只能包含字母、数字、下划线和连字符"),
    email: z.string().email("请输入有效的邮箱地址"),
    password: z
        .string()
        .min(6, "密码至少 6 位")
        .optional()
        .or(z.literal("")),
    role: z.enum(["user", "admin", "superadmin"]),
    is_active: z.boolean(),
});

type EditUserForm = z.infer<typeof editUserSchema>;

interface EditUserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: AdminUserDTO;
}

/**
 * EditUserDialog - 编辑用户对话框
 *
 * 使用 React Hook Form + Zod 进行表单验证
 * 密码字段可选，不填写表示不修改密码
 * 提交成功后自动关闭对话框
 */
export function EditUserDialog({ open, onOpenChange, user }: EditUserDialogProps) {
    const updateUser = useUpdateUser();

    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
        watch,
        reset,
    } = useForm<EditUserForm>({
        resolver: zodResolver(editUserSchema),
        defaultValues: {
            username: user.username,
            email: user.email,
            password: "",
            role: user.role,
            is_active: user.is_active,
        },
    });

    const role = watch("role");
    const isActive = watch("is_active");

    // 用户数据变化时更新表单
    useEffect(() => {
        if (open) {
            reset({
                username: user.username,
                email: user.email,
                password: "",
                role: user.role,
                is_active: user.is_active,
            });
        }
    }, [open, user, reset]);

    const onSubmit = (data: EditUserForm) => {
        // 构建更新数据，排除空密码
        const updateData: {
            username: string;
            email: string;
            password?: string;
            role: "user" | "admin" | "superadmin";
            is_active: boolean;
        } = {
            username: data.username,
            email: data.email,
            role: data.role,
            is_active: data.is_active,
        };

        // 只有填写了密码才更新
        if (data.password && data.password.length > 0) {
            updateData.password = data.password;
        }

        updateUser.mutate(
            { id: user.id, data: updateData },
            {
                onSuccess: () => {
                    onOpenChange(false);
                },
            },
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>编辑用户</DialogTitle>
                    <DialogDescription>修改用户账户信息</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="space-y-4 py-4">
                        {/* 用户名 */}
                        <div className="space-y-2">
                            <Label htmlFor="edit-username">
                                用户名 <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="edit-username"
                                {...register("username")}
                                placeholder="请输入用户名（3-32 字符）"
                                aria-invalid={!!errors.username}
                            />
                            {errors.username && (
                                <p className="text-sm text-destructive">
                                    {errors.username.message}
                                </p>
                            )}
                        </div>

                        {/* 邮箱 */}
                        <div className="space-y-2">
                            <Label htmlFor="edit-email">
                                邮箱 <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="edit-email"
                                type="email"
                                {...register("email")}
                                placeholder="请输入邮箱地址"
                                aria-invalid={!!errors.email}
                            />
                            {errors.email && (
                                <p className="text-sm text-destructive">{errors.email.message}</p>
                            )}
                        </div>

                        {/* 密码 */}
                        <div className="space-y-2">
                            <Label htmlFor="edit-password">密码</Label>
                            <Input
                                id="edit-password"
                                type="password"
                                {...register("password")}
                                placeholder="留空表示不修改密码"
                                aria-invalid={!!errors.password}
                            />
                            {errors.password && (
                                <p className="text-sm text-destructive">
                                    {errors.password.message}
                                </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                                不修改密码请留空，修改密码需至少 6 位
                            </p>
                        </div>

                        {/* 角色 */}
                        <div className="space-y-2">
                            <Label htmlFor="edit-role">角色</Label>
                            <Select
                                value={role}
                                onValueChange={(value) =>
                                    setValue("role", value as "user" | "admin" | "superadmin")
                                }
                            >
                                <SelectTrigger id="edit-role" className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="user">普通用户</SelectItem>
                                    <SelectItem value="admin">管理员</SelectItem>
                                    <SelectItem value="superadmin">超级管理员</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 启用状态 */}
                        <div className="flex items-center justify-between">
                            <Label htmlFor="edit-is_active" className="cursor-pointer">
                                启用账户
                            </Label>
                            <Switch
                                id="edit-is_active"
                                checked={isActive}
                                onCheckedChange={(checked) => setValue("is_active", checked)}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={updateUser.isPending}
                        >
                            取消
                        </Button>
                        <Button type="submit" disabled={updateUser.isPending}>
                            {updateUser.isPending && (
                                <Loader2 className="mr-2 size-4 animate-spin" />
                            )}
                            保存
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
