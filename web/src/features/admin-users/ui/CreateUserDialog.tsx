import { useAdminRoles } from "@features/admin-roles/api/queries";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/shared/ui/base/button";
import { Input } from "@/shared/ui/base/input";
import { Label } from "@/shared/ui/base/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/ui/base/select";
import { Switch } from "@/shared/ui/base/switch";
import { Modal } from "@/shared/ui/modal";
import { useCreateUser } from "../api/queries";
import { type CreateUserForm, createUserSchema } from "../model/schema";

interface CreateUserDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 当前登录用户是否为 root（控制 superadmin 选项可见性；授权链不可传递） */
	isOperatorRoot?: boolean;
}

/**
 * CreateUserDialog - 创建用户对话框
 *
 * 使用 React Hook Form + Zod 进行表单验证
 * 提交成功后自动关闭对话框并重置表单
 *
 * 角色限制：superadmin 选项仅当操作者是 root 时可见（被委派超管不可创建超管，授权链不可传递）。
 */
export function CreateUserDialog({
	open,
	onOpenChange,
	isOperatorRoot = false,
}: CreateUserDialogProps) {
	const createUser = useCreateUser();
	// 动态拉取角色列表（接口返回的角色，而非硬编码）
	const { data: roles } = useAdminRoles();

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
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title="创建用户"
			description="创建一个新的用户账户"
			size="md"
			footer={
				<>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={createUser.isPending}
					>
						取消
					</Button>
					<Button type="submit" form="create-user-form" disabled={createUser.isPending}>
						{createUser.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
						创建
					</Button>
				</>
			}
		>
			<form id="create-user-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
						<p className="text-sm text-destructive">{errors.username.message}</p>
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
						<p className="text-sm text-destructive">{errors.password.message}</p>
					)}
				</div>

				{/* 角色 */}
				<div className="space-y-2">
					<Label htmlFor="role">角色</Label>
					<Select value={role} onValueChange={(value) => setValue("role", value)}>
						<SelectTrigger
							id="role"
							className="w-full"
							onPointerDown={(e) => e.stopPropagation()}
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{(roles ?? [])
								// superadmin 选项仅当操作者是超管时可见
								.filter((r) => r.name !== "superadmin" || isOperatorRoot)
								.map((r) => (
									<SelectItem key={r.name} value={r.name ?? ""}>
										{r.description || r.name}
									</SelectItem>
								))}
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
			</form>
		</Modal>
	);
}
