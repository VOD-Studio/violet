import { useChangePassword } from "@features/auth/api/mutations";
import { Button } from "@shared/ui/button";
import { Card } from "@shared/ui/card";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { useNavigate } from "@tanstack/react-router";
import { Check, Lock, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * PasswordSection - 密码修改区域
 *
 * 提供密码修改功能，成功后跳转到登录页要求重新登录。
 */
export const PasswordSection = () => {
    const [isEditing, setIsEditing] = useState(false);
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [errors, setErrors] = useState<{
        oldPassword?: string;
        newPassword?: string;
        confirmPassword?: string;
    }>({});

    const changePassword = useChangePassword();
    const navigate = useNavigate();

    const validate = (): boolean => {
        const nextErrors: typeof errors = {};

        if (!oldPassword) {
            nextErrors.oldPassword = "请输入原密码";
        }

        if (!newPassword) {
            nextErrors.newPassword = "请输入新密码";
        } else if (newPassword.length < 8) {
            nextErrors.newPassword = "新密码至少 8 位";
        }

        if (!confirmPassword) {
            nextErrors.confirmPassword = "请确认新密码";
        } else if (confirmPassword !== newPassword) {
            nextErrors.confirmPassword = "两次输入的密码不一致";
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleSave = () => {
        if (!validate()) return;

        changePassword.mutate(
            { old_password: oldPassword, new_password: newPassword },
            {
                onSuccess: () => {
                    toast.success("密码已修改，请重新登录");
                    // 密码修改成功后跳转到登录页
                    setTimeout(() => {
                        navigate({ to: "/login", search: { redirect: "/profile" } });
                    }, 1500);
                },
                onError: (err) => {
                    toast.error(err instanceof Error ? err.message : "密码修改失败");
                },
            },
        );
    };

    const handleCancel = () => {
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setErrors({});
        setIsEditing(false);
    };

    return (
        <Card className="p-6">
            <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-semibold">安全设置</h2>
                {!isEditing && (
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                        <Lock className="mr-2 size-4" />
                        修改密码
                    </Button>
                )}
            </div>

            {isEditing ? (
                <div className="space-y-4">
                    {/* 原密码 */}
                    <div className="space-y-2">
                        <Label htmlFor="old-password">原密码</Label>
                        <Input
                            id="old-password"
                            type="password"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            placeholder="请输入原密码"
                            aria-invalid={!!errors.oldPassword}
                        />
                        {errors.oldPassword && (
                            <p className="text-sm text-destructive">{errors.oldPassword}</p>
                        )}
                    </div>

                    {/* 新密码 */}
                    <div className="space-y-2">
                        <Label htmlFor="new-password">新密码</Label>
                        <Input
                            id="new-password"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="请输入新密码（至少 8 位）"
                            aria-invalid={!!errors.newPassword}
                        />
                        {errors.newPassword && (
                            <p className="text-sm text-destructive">{errors.newPassword}</p>
                        )}
                    </div>

                    {/* 确认新密码 */}
                    <div className="space-y-2">
                        <Label htmlFor="confirm-password">确认新密码</Label>
                        <Input
                            id="confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="请再次输入新密码"
                            aria-invalid={!!errors.confirmPassword}
                        />
                        {errors.confirmPassword && (
                            <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                        )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-2 pt-2">
                        <Button
                            onClick={handleSave}
                            disabled={changePassword.isPending}
                            className="flex items-center gap-2"
                        >
                            <Check className="size-4" />
                            {changePassword.isPending ? "修改中..." : "确认修改"}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleCancel}
                            disabled={changePassword.isPending}
                            className="flex items-center gap-2"
                        >
                            <X className="size-4" />
                            取消
                        </Button>
                    </div>

                    <p className="text-sm text-muted-foreground">提示：修改密码后需要重新登录</p>
                </div>
            ) : (
                <p className="text-muted-foreground">定期修改密码可以提高账户安全性</p>
            )}
        </Card>
    );
};
