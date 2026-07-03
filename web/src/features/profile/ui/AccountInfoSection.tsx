import type { UserDTO } from "@entities/user/model/types";
import { Badge } from "@shared/ui/base/badge";
import { Card } from "@shared/ui/base/card";
import { Separator } from "@shared/ui/base/separator";
import { Calendar, Mail, Shield } from "lucide-react";

interface AccountInfoSectionProps {
    user: UserDTO;
}

/**
 * AccountInfoSection - 账户信息展示（只读）
 *
 * 显示邮箱、角色、注册时间等账户基本信息。
 */
export const AccountInfoSection = ({ user }: AccountInfoSectionProps) => {
    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString("zh-CN", {
                year: "numeric",
                month: "long",
                day: "numeric",
            });
        } catch {
            return dateStr;
        }
    };

    const getRoleBadge = (role: string) => {
        const roleMap = {
            superadmin: { label: "超级管理员", variant: "default" as const },
            admin: { label: "管理员", variant: "secondary" as const },
            user: { label: "普通用户", variant: "outline" as const },
        };
        const config = roleMap[role as keyof typeof roleMap] || roleMap.user;
        return <Badge variant={config.variant}>{config.label}</Badge>;
    };

    return (
        <Card className="p-6">
            <h2 className="mb-6 text-xl font-semibold">账户信息</h2>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="size-4" />
                        <span>邮箱</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-base">{user.email}</span>
                        {user.email_verified && (
                            <Badge variant="outline" className="text-xs">
                                已验证
                            </Badge>
                        )}
                    </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Shield className="size-4" />
                        <span>角色</span>
                    </div>
                    {getRoleBadge(user.role)}
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="size-4" />
                        <span>注册时间</span>
                    </div>
                    <span className="text-base">{formatDate(user.created_at)}</span>
                </div>

                {!user.is_active && (
                    <>
                        <Separator />
                        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                            该账户已被禁用，如有疑问请联系管理员
                        </div>
                    </>
                )}
            </div>
        </Card>
    );
};
