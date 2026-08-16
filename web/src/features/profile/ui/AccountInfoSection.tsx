import type { UserDTO } from "@entities/user/model/types";
import {
	AlertTriangle,
	CalendarDays,
	Fingerprint,
	Mail,
	ShieldCheck,
	UserRound,
} from "lucide-react";
import { SectionCard } from "./SectionCard";

interface AccountInfoSectionProps {
	user: UserDTO;
}

/**
 * AccountInfoSection - 账户信息展示（只读）
 *
 * 与 ProfileShell 配合：作为「账户信息」Tab 内容。
 * 字段纵向列表，label 左 value 右。
 */
export const AccountInfoSection = ({ user }: AccountInfoSectionProps) => {
	return (
		<SectionCard title="账户信息">
			{!user.is_active && (
				<div className="mb-5 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
					<AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
					<span className="text-destructive">该账户已被禁用，如有疑问请联系管理员</span>
				</div>
			)}

			<dl className="divide-y">
				<Row icon={<Mail className="size-4" />} label="邮箱">
					<span className="truncate">{user.email}</span>
					{user.email_verified ? (
						<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
							<ShieldCheck className="size-3" />
							已验证
						</span>
					) : (
						<span className="text-xs text-amber-600 dark:text-amber-400">未验证</span>
					)}
				</Row>
				<Row icon={<UserRound className="size-4" />} label="角色">
					<span>{user.is_root ? "root" : user.role_description || user.role}</span>
				</Row>
				<Row icon={<Fingerprint className="size-4" />} label="用户 ID">
					<code className="text-xs text-muted-foreground">{user.id}</code>
				</Row>
				<Row icon={<CalendarDays className="size-4" />} label="注册时间">
					<time>
						{new Date(user.created_at).toLocaleDateString("zh-CN", {
							year: "numeric",
							month: "long",
							day: "numeric",
						})}
					</time>
				</Row>
			</dl>
		</SectionCard>
	);
};

const Row = ({
	icon,
	label,
	children,
}: {
	icon: React.ReactNode;
	label: string;
	children: React.ReactNode;
}) => {
	return (
		<div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
			<dt className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
				{icon}
				{label}
			</dt>
			<dd className="flex min-w-0 items-center gap-2 justify-self-end text-sm">{children}</dd>
		</div>
	);
};
