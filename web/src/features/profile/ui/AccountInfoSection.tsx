import type { UserDTO } from "@entities/user/model/types";
import {
	AlertTriangle,
	CalendarDays,
	Mail,
	Shield,
	ShieldCheck,
	User as UserIcon,
} from "lucide-react";

interface AccountInfoSectionProps {
	user: UserDTO;
}

/**
 * AccountInfoSection - 账户信息展示（只读）
 *
 * 与 ProfileShell 配合：作为「账户信息」Tab 内容。
 *
 * 视觉：上方角色徽章卡（突出）+ 下方 2x2 信息网格（邮箱/角色/创建时间/状态）。
 * 不可修改的字段集中展示，避免与 ProfileInfoSection 的可编辑字段混淆。
 */
export const AccountInfoSection = ({ user }: AccountInfoSectionProps) => {
	return (
		<section
			className={
				"rounded-2xl border border-border/40 bg-card/50 p-6 backdrop-blur-sm " +
				"shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_8px_24px_-12px_rgba(0,0,0,0.08)] " +
				"dark:shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset,0_8px_24px_-12px_rgba(0,0,0,0.5)]"
			}
		>
			<header className="mb-5 flex items-start gap-3">
				<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
					<Shield className="size-4" />
				</span>
				<div>
					<h2 className="font-mono text-base font-semibold tracking-tight">账户信息</h2>
					<p className="mt-0.5 text-xs text-muted-foreground">只读 · 由系统维护</p>
				</div>
			</header>

			{/* 顶部角色徽章条 */}
			<RoleBanner user={user} />

			{/* 禁用警告 */}
			{!user.is_active && (
				<div className="mt-5 flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
					<AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
					<div className="flex-1 text-sm">
						<p className="font-medium text-destructive">该账户已被禁用</p>
						<p className="mt-0.5 text-xs text-destructive/80">如有疑问请联系管理员</p>
					</div>
				</div>
			)}

			{/* 信息网格 */}
			<dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
				<InfoItem
					icon={<Mail className="size-3.5" />}
					label="邮箱"
					value={user.email}
					trailing={
						user.email_verified ? (
							<span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
								<ShieldCheck className="size-2.5" />
								已验证
							</span>
						) : (
							<span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
								未验证
							</span>
						)
					}
				/>
				<InfoItem
					icon={<UserIcon className="size-3.5" />}
					label="用户 ID"
					value={<span className="font-mono text-xs tracking-tight">{user.id}</span>}
				/>
				<InfoItem
					icon={<Shield className="size-3.5" />}
					label="角色"
					value={
						user.is_root ? (
							<span className="inline-flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 font-mono text-[10px] font-medium tracking-wider text-background uppercase">
								<Shield className="size-2.5" />
								root
							</span>
						) : (
							<span className="inline-flex items-center rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] font-medium tracking-wider text-foreground/80 uppercase backdrop-blur-sm">
								{user.role_description || user.role}
							</span>
						)
					}
				/>
				<InfoItem
					icon={<CalendarDays className="size-3.5" />}
					label="注册时间"
					value={
						<time className="text-sm">
							{new Date(user.created_at).toLocaleDateString("zh-CN", {
								year: "numeric",
								month: "long",
								day: "numeric",
							})}
						</time>
					}
				/>
			</dl>
		</section>
	);
};

/**
 * RoleBanner - 顶部角色徽章条
 *
 * root 用户全宽高对比徽章；其他角色显示「角色 + 权限范围」。
 */
const RoleBanner = ({ user }: { user: UserDTO }) => {
	if (user.is_root) {
		return (
			<div className="relative overflow-hidden rounded-xl border border-foreground/20 bg-foreground p-5 text-background">
				<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
				<div className="relative flex items-center justify-between gap-3">
					<div className="flex items-center gap-3">
						<span className="flex size-9 items-center justify-center rounded-lg bg-background/15 text-background">
							<Shield className="size-4" />
						</span>
						<div>
							<p className="font-mono text-sm font-semibold tracking-wider uppercase">
								root
							</p>
							<p className="mt-0.5 text-xs text-background/70">
								内置超级管理员 · 拥有全部权限
							</p>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/30 p-4">
			<div className="flex items-center gap-3">
				<span className="flex size-9 items-center justify-center rounded-lg bg-background text-foreground/80">
					<Shield className="size-4" />
				</span>
				<div>
					<p className="font-mono text-sm font-medium tracking-wide">
						{user.role_description || user.role}
					</p>
					<p className="mt-0.5 text-xs text-muted-foreground">基于角色授予的权限</p>
				</div>
			</div>
		</div>
	);
};

/**
 * InfoItem - 信息条目（label + value + 可选 trailing 状态徽章）
 */
interface InfoItemProps {
	icon: React.ReactNode;
	label: string;
	value: React.ReactNode;
	trailing?: React.ReactNode;
}

const InfoItem = ({ icon, label, value, trailing }: InfoItemProps) => {
	return (
		<div className="rounded-xl border border-border/40 bg-background/40 p-4 transition-colors hover:border-border/60">
			<dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
				{icon}
				{label}
			</dt>
			<dd className="mt-2 flex items-center justify-between gap-2">
				<div className="min-w-0 flex-1 truncate">{value}</div>
				{trailing}
			</dd>
		</div>
	);
};
