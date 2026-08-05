import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Label } from "@shared/ui/base/label";
import { Textarea } from "@shared/ui/base/textarea";
import { Modal } from "@shared/ui/modal";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useUpdateRole } from "../api/queries";
import { type RoleForm, roleSchema } from "../model/schema";
import type { RoleDTO } from "../model/types";

interface EditRoleDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	role: RoleDTO;
}

/**
 * EditRoleDialog - 编辑角色对话框
 *
 * 内置角色：名称字段禁用（后端仍守卫不可重命名，重命名会破坏 users.role 硬编码），
 * 描述字段可改。
 */
export function EditRoleDialog({ open, onOpenChange, role }: EditRoleDialogProps) {
	const updateRole = useUpdateRole();
	const isBuiltin = role.is_builtin;

	const {
		register,
		handleSubmit,
		formState: { errors },
		reset,
	} = useForm<RoleForm>({
		resolver: zodResolver(roleSchema),
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

	const onSubmit = (data: RoleForm) => {
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
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title="编辑角色"
			description="修改角色信息"
			size="sm"
			footer={
				<>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={updateRole.isPending}
					>
						取消
					</Button>
					<Button type="submit" form="edit-role-form" disabled={updateRole.isPending}>
						{updateRole.isPending && <Loader2 className="mr-1 size-4 animate-spin" />}
						保存
					</Button>
				</>
			}
		>
			<form id="edit-role-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
				{/* 角色名称 */}
				<div className="space-y-2">
					<Label htmlFor="name">
						角色名称 <span className="text-destructive">*</span>
					</Label>
					<Input
						id="name"
						placeholder="如：editor"
						{...register("name")}
						disabled={isBuiltin || updateRole.isPending}
					/>
					{errors.name && (
						<p className="text-destructive text-sm">{errors.name.message}</p>
					)}
					<p className="text-muted-foreground text-xs">
						{isBuiltin ? "内置角色不可重命名" : "只能包含字母、数字、下划线和连字符"}
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
						<p className="text-destructive text-sm">{errors.description.message}</p>
					)}
				</div>
			</form>
		</Modal>
	);
}
