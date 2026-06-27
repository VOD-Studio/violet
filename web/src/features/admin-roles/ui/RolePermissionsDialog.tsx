import { Button } from "@shared/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@shared/ui/dialog";
import { Checkbox } from "@shared/ui/checkbox";
import { Label } from "@shared/ui/label";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAdminPermissions } from "@features/admin-permissions/api/queries";
import { useRoleDetail, useUpdateRolePermissions } from "../api/queries";
import { Badge } from "@shared/ui/badge";

interface RolePermissionsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    roleId: number;
    roleName?: string;
}

/**
 * RolePermissionsDialog - 角色权限配置对话框
 *
 * 展示所有可用权限（按分组），允许用户勾选/取消权限
 */
export function RolePermissionsDialog({
    open,
    onOpenChange,
    roleId,
    roleName,
}: RolePermissionsDialogProps) {
    const { data: permissions = [] } = useAdminPermissions();
    const { data: roleDetail } = useRoleDetail(roleId);
    const updateRolePermissions = useUpdateRolePermissions();

    const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

    // 角色权限加载后初始化选中状态
    useEffect(() => {
        if (roleDetail?.permission_codes) {
            setSelectedCodes(new Set(roleDetail.permission_codes));
        }
    }, [roleDetail]);

    // 按权限代码分组
    const groupedPermissions = useMemo(() => {
        const groups: Record<string, typeof permissions> = {};
        permissions.forEach((permission) => {
            if (!permission.code) return;
            const prefix = permission.code.split(":")[0] || "other";
            if (!groups[prefix]) {
                groups[prefix] = [];
            }
            groups[prefix].push(permission);
        });
        return groups;
    }, [permissions]);

    const handleToggle = (code: string) => {
        setSelectedCodes((prev) => {
            const next = new Set(prev);
            if (next.has(code)) {
                next.delete(code);
            } else {
                next.add(code);
            }
            return next;
        });
    };

    const handleToggleGroup = (group: string) => {
        const groupCodes = groupedPermissions[group].map((p) => p.code).filter(Boolean) as string[];
        const allSelected = groupCodes.every((code) => selectedCodes.has(code));

        setSelectedCodes((prev) => {
            const next = new Set(prev);
            if (allSelected) {
                // 取消选中该组的所有权限
                groupCodes.forEach((code) => next.delete(code));
            } else {
                // 选中该组的所有权限
                groupCodes.forEach((code) => next.add(code));
            }
            return next;
        });
    };

    const handleSave = () => {
        updateRolePermissions.mutate(
            {
                id: roleId,
                data: { permission_codes: Array.from(selectedCodes) },
            },
            {
                onSuccess: () => {
                    onOpenChange(false);
                },
            },
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>配置角色权限 - {roleName}</DialogTitle>
                    <DialogDescription>
                        选择该角色拥有的权限。已选中 {selectedCodes.size} 个权限。
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {Object.entries(groupedPermissions).map(([group, perms]) => {
                        const groupCodes = perms.map((p) => p.code).filter(Boolean) as string[];
                        const selectedCount = groupCodes.filter((code) =>
                            selectedCodes.has(code),
                        ).length;
                        const allSelected = groupCodes.length > 0 && selectedCount === groupCodes.length;
                        const someSelected = selectedCount > 0 && selectedCount < groupCodes.length;

                        return (
                            <div key={group} className="space-y-3">
                                {/* 分组标题 */}
                                <div className="flex items-center justify-between border-b pb-2">
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id={`group-${group}`}
                                            checked={allSelected}
                                            onCheckedChange={() => handleToggleGroup(group)}
                                            className={someSelected ? "data-[state=checked]:bg-primary/50" : ""}
                                        />
                                        <Label
                                            htmlFor={`group-${group}`}
                                            className="font-semibold text-sm uppercase cursor-pointer"
                                        >
                                            {group}
                                        </Label>
                                        <Badge variant="secondary">
                                            {selectedCount}/{groupCodes.length}
                                        </Badge>
                                    </div>
                                </div>

                                {/* 权限列表 */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-6">
                                    {perms.map((permission) => {
                                        if (!permission.code) return null;
                                        const isChecked = selectedCodes.has(permission.code);

                                        return (
                                            <div
                                                key={permission.id}
                                                className="flex items-start gap-3 p-2 rounded hover:bg-muted/50"
                                            >
                                                <Checkbox
                                                    id={`permission-${permission.id}`}
                                                    checked={isChecked}
                                                    onCheckedChange={() =>
                                                        handleToggle(permission.code!)
                                                    }
                                                />
                                                <div className="flex-1">
                                                    <Label
                                                        htmlFor={`permission-${permission.id}`}
                                                        className="font-medium cursor-pointer"
                                                    >
                                                        {permission.name}
                                                    </Label>
                                                    <p className="text-muted-foreground text-xs mt-0.5">
                                                        {permission.description}
                                                    </p>
                                                    <code className="text-primary text-xs">
                                                        {permission.code}
                                                    </code>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={updateRolePermissions.isPending}
                    >
                        取消
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={updateRolePermissions.isPending}
                    >
                        {updateRolePermissions.isPending && (
                            <Loader2 className="mr-1 size-4 animate-spin" />
                        )}
                        保存
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
