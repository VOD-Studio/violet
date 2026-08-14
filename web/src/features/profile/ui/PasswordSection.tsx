import { useChangePassword } from "@features/auth/api/mutations";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Label } from "@shared/ui/base/label";
import { useNavigate } from "@tanstack/react-router";
import { Check, KeyRound, PencilLine, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SectionCard } from "./SectionCard";

interface PasswordSectionProps {
	/** 是否已设置密码；false 时展示「设置密码」引导（OAuth 建号用户） */
	hasPassword: boolean;
}

/**
 * PasswordSection - 密码卡片
 *
 * 与 ProfileShell 配合：作为「账户与安全」Tab 内容之一。
 * 已设置密码：默认态显示「修改按钮」；编辑态三段密码输入 + Save/Cancel，
 * 成功后 1.5s 跳登录页要求重登。
 * 未设置密码（OAuth 建号）：引导走忘记密码邮箱验证流程补设。
 */
export const PasswordSection = ({ hasPassword }: PasswordSectionProps) => {
	const navigate = useNavigate();

	if (!hasPassword) {
		return (
			<SectionCard
				title="密码"
				description="当前使用第三方账号登录，未设置密码"
				action={
					<Button
						size="sm"
						className="gap-1.5"
						onClick={() => navigate({ to: "/forgot-password" })}
					>
						<KeyRound className="size-3.5" />
						设置密码
					</Button>
				}
			>
				<p className="text-sm text-muted-foreground">
					通过邮箱验证设置密码后，即可使用邮箱密码登录；第三方登录不受影响。
				</p>
			</SectionCard>
		);
	}

	return <ChangePasswordCard />;
};

const ChangePasswordCard = () => {
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
					// 存量 OAuth 建号用户（随机哈希）不知道原密码，失败时引导走邮箱重置
					toast.error(err instanceof Error ? err.message : "密码修改失败", {
						action: {
							label: "忘记密码？",
							onClick: () => navigate({ to: "/forgot-password" }),
						},
					});
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
		<SectionCard
			title="密码"
			description={isEditing ? undefined : "定期更换密码有助于保障账户安全"}
			action={
				!isEditing ? (
					<Button size="sm" variant="outline" onClick={handleEdit} className="gap-1.5">
						<PencilLine className="size-3.5" />
						修改
					</Button>
				) : undefined
			}
		>
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

					<div className="flex flex-wrap items-center gap-2 pt-1">
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

					<p className="text-sm text-muted-foreground">修改成功后需重新登录</p>
				</div>
			) : (
				<p className="text-sm text-muted-foreground">已设置密码，可使用邮箱密码登录</p>
			)}
		</SectionCard>
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
