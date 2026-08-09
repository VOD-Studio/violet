import { useChangePassword } from "@features/auth/api/mutations";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Label } from "@shared/ui/base/label";
import { useNavigate } from "@tanstack/react-router";
import { Check, PencilLine, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * PasswordSection - 密码修改卡片
 *
 * 与 ProfileShell 配合：作为「密码」Tab 内容。
 * 默认态显示「已设置 + 修改按钮」；编辑态三段密码输入 + Save/Cancel。
 * 成功后 1.5s 跳登录页要求重登。
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
		const next: typeof errors = {};
		if (!oldPassword) next.oldPassword = "请输入原密码";
		if (!newPassword) next.newPassword = "请输入新密码";
		else if (newPassword.length < 8) next.newPassword = "新密码至少 8 位";
		if (!confirmPassword) next.confirmPassword = "请确认新密码";
		else if (confirmPassword !== newPassword) next.confirmPassword = "两次输入的密码不一致";
		setErrors(next);
		return Object.keys(next).length === 0;
	};

	const handleSave = () => {
		if (!validate()) return;
		changePassword.mutate(
			{ old_password: oldPassword, new_password: newPassword },
			{
				onSuccess: () => {
					toast.success("密码已修改，请重新登录");
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

	const handleEdit = () => {
		setOldPassword("");
		setNewPassword("");
		setConfirmPassword("");
		setErrors({});
		setIsEditing(true);
	};

	return (
		<div className="rounded-xl border bg-card p-6 shadow-sm">
			<div className="mb-5 flex items-center justify-between gap-4">
				<h2 className="text-base font-semibold">密码</h2>
				{!isEditing && (
					<Button size="sm" variant="outline" onClick={handleEdit} className="gap-1.5">
						<PencilLine className="size-3.5" />
						修改
					</Button>
				)}
			</div>

			{isEditing ? (
				<div className="space-y-4">
					<PasswordField
						id="old-password"
						label="原密码"
						value={oldPassword}
						onChange={setOldPassword}
						placeholder="请输入原密码"
						error={errors.oldPassword}
						autoFocus
					/>
					<PasswordField
						id="new-password"
						label="新密码"
						value={newPassword}
						onChange={setNewPassword}
						placeholder="至少 8 位"
						error={errors.newPassword}
					/>
					<PasswordField
						id="confirm-password"
						label="确认新密码"
						value={confirmPassword}
						onChange={setConfirmPassword}
						placeholder="再次输入新密码"
						error={errors.confirmPassword}
					/>

					<div className="flex items-center gap-2 pt-1">
						<Button
							onClick={handleSave}
							disabled={changePassword.isPending}
							className="gap-1.5"
						>
							<Check className="size-3.5" />
							{changePassword.isPending ? "修改中..." : "确认修改"}
						</Button>
						<Button
							variant="ghost"
							onClick={handleCancel}
							disabled={changePassword.isPending}
							className="gap-1.5"
						>
							<X className="size-3.5" />
							取消
						</Button>
					</div>

					<p className="text-sm text-muted-foreground">修改密码后需要重新登录</p>
				</div>
			) : (
				<p className="text-sm text-muted-foreground">定期修改密码可提高账户安全性</p>
			)}
		</div>
	);
};

interface PasswordFieldProps {
	id: string;
	label: string;
	value: string;
	onChange: (v: string) => void;
	placeholder?: string;
	error?: string;
	autoFocus?: boolean;
}

const PasswordField = ({
	id,
	label,
	value,
	onChange,
	placeholder,
	error,
	autoFocus,
}: PasswordFieldProps) => {
	return (
		<div className="space-y-1.5">
			<Label htmlFor={id} className="text-sm font-medium">
				{label}
			</Label>
			<Input
				id={id}
				type="password"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				aria-invalid={!!error}
				autoFocus={autoFocus}
			/>
			{error && <p className="text-xs text-destructive">{error}</p>}
		</div>
	);
};
