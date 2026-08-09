import type { UserDTO } from "@entities/user/model/types";
import { AlertTriangle } from "lucide-react";

interface AccountInfoSectionProps {
	user: UserDTO;
}

/**
 * AccountInfoSection - 账户信息展示（只读）
 *
 * 与 ProfileShell 配合：作为「账户信息」Tab 内容。
 * 字段纵向列表，label 左 value 右，无图标装饰。
 */
export const AccountInfoSection = ({ user }: AccountInfoSectionProps) => {
	return (
		<div className="rounded-xl border bg-card p-6 shadow-sm">
			<h2 className="mb-5 text-base font-semibold">账户信息</h2>

			{!user.is_active && (
				<div className="mb-5 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
					<AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
					<span className="text-destructive">该账户已被禁用，如有疑问请联系管理员</span>
				</div>
			)}

			<dl className="divide-y">
				<Row label="邮箱">
					<span className="truncate">{user.email}</span>
					{user.email_verified ? (
						<span className="text-xs text-muted-foreground">已验证</span>
					) : (
						<span className="text-xs text-amber-600 dark:text-amber-400">未验证</span>
					)}
				</Row>
				<Row label="角色">
					<span>{user.is_root ? "超级管理员" : user.role_description || user.role}</span>
				</Row>
				<Row label="用户 ID">
					<code className="text-xs text-muted-foreground">{user.id}</code>
				</Row>
				<Row label="注册时间">
					<time>
						{new Date(user.created_at).toLocaleDateString("zh-CN", {
							year: "numeric",
							month: "long",
							day: "numeric",
						})}
					</time>
				</Row>
			</dl>
		</div>
	);
};

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => {
	return (
		<div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
			<dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
			<dd className="flex min-w-0 items-center gap-2 justify-self-end text-sm">{children}</dd>
		</div>
	);
};
