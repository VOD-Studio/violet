import { useAdminPermissions } from "@features/admin-permissions/api/queries";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { Checkbox } from "@shared/ui/base/checkbox";
import { Label } from "@shared/ui/base/label";
import { Modal } from "@shared/ui/modal";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useRoleDetail, useUpdateRolePermissions } from "../api/queries";

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

	// 对话框打开时从后端数据同步选中状态，避免未保存的改动残留到下次打开
	useEffect(() => {
		if (open && roleDetail?.permission_codes) {
			setSelectedCodes(new Set(roleDetail.permission_codes));
		}
	}, [open, roleDetail]);

	// 后端已返回树：permissions 为 menu 数组，每个 menu.children 为其 action
	const menuTree = permissions;

	// superadmin 角色固有全部权限，后端返回通配码 ["*"] 且不可编辑。
	const isWildcard = roleDetail?.permission_codes?.includes("*") === true;
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

	const handleToggleGroup = (menu: (typeof permissions)[number]) => {
		const groupCodes = (menu.children || []).map((p) => p.code).filter(Boolean) as string[];
		const allSelected = groupCodes.every((code) => selectedCodes.has(code));

		setSelectedCodes((prev) => {
			const next = new Set(prev);
			if (allSelected) {
				groupCodes.forEach((code) => {
					next.delete(code);
				});
			} else {
				groupCodes.forEach((code) => {
					next.add(code);
				});
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
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title={isWildcard ? `角色权限 - ${roleName}` : `配置角色权限 - ${roleName}`}
			description={
				isWildcard
					? `该角色固有全部权限（共 ${permissions.reduce((n, m) => n + (m.children?.length ?? 0), 0)} 项），不可编辑`
					: `选择该角色拥有的权限。已选中 ${selectedCodes.size} 个权限。`
			}
			size="lg"
			footer={
				isWildcard ? (
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
						关闭
					</Button>
				) : (
					<>
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
					</>
				)
			}
		>
			<div className="space-y-6">
				{menuTree.map((menu) => {
					const actions = menu.children || [];
					if (actions.length === 0) return null;
					const groupCodes = actions.map((p) => p.code).filter(Boolean) as string[];
					const selectedCount = isWildcard
						? groupCodes.length
						: groupCodes.filter((code) => selectedCodes.has(code)).length;
					const allSelected =
						groupCodes.length > 0 && selectedCount === groupCodes.length;
					const someSelected = selectedCount > 0 && selectedCount < groupCodes.length;

					return (
						<div key={menu.id} className="space-y-3">
							{/* 分组标题 */}
							<div className="flex items-center justify-between border-b pb-2">
								<div className="flex items-center gap-2">
									<Checkbox
										id={`group-${menu.id}`}
										checked={allSelected}
										onCheckedChange={() => handleToggleGroup(menu)}
										disabled={isWildcard}
										className={
											someSelected
												? "data-[state=checked]:bg-primary/50"
												: ""
										}
									/>
									<Label
										htmlFor={`group-${menu.id}`}
										className="font-semibold text-sm cursor-pointer"
									>
										{menu.name}
									</Label>
									<Badge variant="secondary">
										{selectedCount}/{groupCodes.length}
									</Badge>
								</div>
							</div>

							{/* 权限列表 */}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-6">
								{actions.map((permission) => {
									const code = permission.code;
									if (!code) return null;
									const isChecked = isWildcard || selectedCodes.has(code);

									return (
										<div
											key={permission.id}
											className="flex items-start gap-3 p-2 rounded hover:bg-muted/50"
										>
											<Checkbox
												id={`permission-${permission.id}`}
												checked={isChecked}
												onCheckedChange={() => handleToggle(code)}
												disabled={isWildcard}
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
												<code className="font-mono text-primary text-xs">
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
		</Modal>
	);
}
