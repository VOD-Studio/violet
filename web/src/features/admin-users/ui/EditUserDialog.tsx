import { useAdminRoles } from "@features/admin-roles/api/queries";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/shared/ui/base/button";
import { Input } from "@/shared/ui/base/input";
import { Label } from "@/shared/ui/base/label";
import { Modal } from "@/shared/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/base/select";
import { Switch } from "@/shared/ui/base/switch";
import { useUpdateUser } from "../api/queries";
import { type EditUserForm, editUserSchema } from "../model/schema";
import type { AdminUserDTO } from "../model/types";

interface EditUserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: AdminUserDTO;
    /** 当前登录用户 ID（用于禁止改自己角色） */
    currentUserId?: string;
    /** 当前登录用户是否为内置超级管理员（控制 superadmin 选项可见性；授权链不可传递） */
    isOperatorSuperAdmin?: boolean;
}

/**
 * EditUserDialog - 编辑用户对话框
 *
 * 使用 React Hook Form + Zod 进行表单验证
 * 密码字段可选，不填写表示不修改密码
 * 提交成功后自动关闭对话框
 *
 * 角色限制：目标是内置超管 / 编辑自己 → 禁用角色选择；
 * superadmin 选项仅内置超管可选（被委派超管不可授权他人）。
 */
export function EditUserDialog({
    open,
    onOpenChange,
    user,
    currentUserId,
    isOperatorSuperAdmin = false,
}: EditUserDialogProps) {
    const updateUser = useUpdateUser();
    // 动态拉取角色列表（接口返回的角色，而非硬编码），staleTime 由 useAdminRoles 控制（30min）
    const { data: roles } = useAdminRoles();

    // 角色是否不可选：目标是内置超管（不可降级）或编辑自己（不可改自己角色）
    // 被委派超管可由内置超管改角色，故不在此禁用
    const roleDisabled = user.is_builtin_super_admin || user.id === currentUserId;

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
            role: string;
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
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title="编辑用户"
            description="修改用户账户信息"
            size="md"
            footer={
                <>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={updateUser.isPending}
                    >
                        取消
                    </Button>
                    <Button type="submit" form="edit-user-form" disabled={updateUser.isPending}>
                        {updateUser.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                        保存
                    </Button>
                </>
            }
        >
            <form id="edit-user-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                        <p className="text-sm text-destructive">{errors.username.message}</p>
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
                        <p className="text-sm text-destructive">{errors.password.message}</p>
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
                        onValueChange={(value) => setValue("role", value)}
                        disabled={roleDisabled}
                    >
                        <SelectTrigger
                            id="edit-role"
                            className="w-full"
                            onPointerDown={(e) => e.stopPropagation()}
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {(roles ?? [])
                                // superadmin 选项仅当操作者是超管时可见
                                .filter((r) => r.name !== "superadmin" || isOperatorSuperAdmin)
                                .map((r) => (
                                    <SelectItem key={r.name} value={r.name ?? ""}>
                                        {r.description || r.name}
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                    {roleDisabled ? (
                        <p className="text-xs text-muted-foreground">
                            {user.is_builtin_super_admin
                                ? "不可修改内置超级管理员的角色"
                                : "不可修改自己的角色"}
                        </p>
                    ) : null}
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
            </form>
        </Modal>
    );
}
