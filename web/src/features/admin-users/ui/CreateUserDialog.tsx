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
import { useCreateUser } from "../api/queries";
import { useEffect } from "react";

/**
 * 创建用户表单验证规则
 */
const createUserSchema = z.object({
    username: z
        .string()
        .min(3, "用户名至少 3 个字符")
        .max(32, "用户名最多 32 个字符")
        .regex(/^[a-zA-Z0-9_-]+$/, "用户名只能包含字母、数字、下划线和连字符"),
    email: z.string().email("请输入有效的邮箱地址"),
    password: z.string().min(6, "密码至少 6 位"),
    role: z.enum(["user", "admin", "superadmin"]),
    is_active: z.boolean(),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

interface CreateUserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * CreateUserDialog - 创建用户对话框
 *
 * 使用 React Hook Form + Zod 进行表单验证
 * 提交成功后自动关闭对话框并重置表单
 */
export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
    const createUser = useCreateUser();

    const form = useForm<CreateUserForm>({
        resolver: zodResolver(createUserSchema),
        defaultValues: {
            username: "",
            email: "",
            password: "",
            role: "user",
            is_active: true,
        },
    });

    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
        watch,
        reset,
    } = form;

    const role = watch("role");
    const isActive = watch("is_active");

    // 对话框关闭时重置表单
    useEffect(() => {
        if (!open) {
            reset();
        }
    }, [open, reset]);

    const onSubmit = (data: CreateUserForm) => {
        createUser.mutate(data, {
            onSuccess: () => {
                onOpenChange(false);
                reset();
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>创建用户</DialogTitle>
                    <DialogDescription>创建一个新的用户账户</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="space-y-4 py-4">
                        {/* 用户名 */}
                        <div className="space-y-2">
                            <Label htmlFor="username">
                                用户名 <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="username"
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
                            <Label htmlFor="email">
                                邮箱 <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="email"
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
                            <Label htmlFor="password">
                                密码 <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="password"
                                type="password"
                                {...register("password")}
                                placeholder="请输入密码（至少 6 位）"
                                aria-invalid={!!errors.password}
                            />
                            {errors.password && (
                                <p className="text-sm text-destructive">
                                    {errors.password.message}
                                </p>
                            )}
                        </div>

                        {/* 角色 */}
                        <div className="space-y-2">
                            <Label htmlFor="role">角色</Label>
                            <Select value={role} onValueChange={(value) => setValue("role", value as "user" | "admin" | "superadmin")}>
                                <SelectTrigger id="role" className="w-full">
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
                            <Label htmlFor="is_active" className="cursor-pointer">
                                启用账户
                            </Label>
                            <Switch
                                id="is_active"
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
                            disabled={createUser.isPending}
                        >
                            取消
                        </Button>
                        <Button type="submit" disabled={createUser.isPending}>
                            {createUser.isPending && (
                                <Loader2 className="mr-2 size-4 animate-spin" />
                            )}
                            创建
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
