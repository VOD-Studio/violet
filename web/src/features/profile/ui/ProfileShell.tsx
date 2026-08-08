import type { UserDTO } from "@entities/user/model/types";
import { useUpdateProfile } from "@features/auth/api/mutations";
import { CropUploadDialog, type CropUploadResult } from "@features/upload/ui/CropUploadDialog";
import { avatarUrl } from "@shared/lib/image-url";
import { cn } from "@shared/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shared/ui/base/tabs";
import {
	CalendarDays,
	Camera,
	KeyRound,
	Lock,
	Mail,
	Shield,
	ShieldCheck,
	User as UserIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

interface ProfileShellProps {
	user: UserDTO;
	defaultTab?: ProfileTab;
	profile: ReactNode;
	account: ReactNode;
	password: ReactNode;
}

/**
 * ProfileTab - 个人中心 Tab 标识
 */
export type ProfileTab = "profile" | "account" | "password";

/**
 * ProfileShell - 个人中心布局壳
 *
 * 桌面（≥ md）：左 280px 侧栏（头像卡 + Tab 列表）+ 右内容区。
 * 移动（< md）：顶部头像卡 + Tab 横排 + 内容区。
 *
 * 头像卡自带「更换头像」入口，点击触发 CropUploadDialog 走与 ProfileAvatarUploader
 * 相同的裁剪上传流程。状态机：选文件 → 裁剪弹窗 → 提交 → updateProfile.mutateAsync。
 */
export const ProfileShell = ({
	user,
	defaultTab = "profile",
	profile,
	account,
	password,
}: ProfileShellProps) => {
	const [tab, setTab] = useState<ProfileTab>(defaultTab);
	return (
		<Tabs value={tab} onValueChange={(v) => setTab(v as ProfileTab)} orientation="vertical" className="gap-0">
			<div className="container mx-auto max-w-5xl px-4 py-8 md:py-12">
				<ProfileLayout
					user={user}
					profile={profile}
					account={account}
					password={password}
				/>
			</div>
		</Tabs>
	);
};

const ProfileLayout = ({ user, profile, account, password }: ProfileShellProps) => {
	return (
		<div className="grid grid-cols-1 gap-6 md:grid-cols-[280px_1fr] md:gap-8">
			<aside className="md:sticky md:top-24 md:self-start">
				<ProfileSidebar user={user} />
			</aside>

			<div className="min-w-0">
				<TabsContent value="profile" className="mt-0 outline-none">
					{profile}
				</TabsContent>
				<TabsContent value="account" className="mt-0 outline-none">
					{account}
				</TabsContent>
				<TabsContent value="password" className="mt-0 outline-none">
					{password}
				</TabsContent>
			</div>
		</div>
	);
};

/**
 * ProfileSidebar - 头像卡 + 垂直 Tab 列表
 */
const ProfileSidebar = ({ user }: { user: UserDTO }) => {
	const [pendingFile, setPendingFile] = useState<File | null>(null);
	const [cropOpen, setCropOpen] = useState(false);
	const updateProfile = useUpdateProfile();

	const handleConfirm = async (result: CropUploadResult) => {
		try {
			await updateProfile.mutateAsync({ avatar_url: result.url });
			setPendingFile(null);
		} catch (e) {
			// toast 由 hook 内部处理？这里兜底
			console.error(e);
		}
	};

	const roleLabel = user.is_root ? "root" : user.role_description || user.role;

	return (
		<div
			className={cn(
				"rounded-2xl border border-border/40 bg-card/50 p-5 backdrop-blur-sm",
				"shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_8px_24px_-12px_rgba(0,0,0,0.08)]",
				"dark:shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset,0_8px_24px_-12px_rgba(0,0,0,0.5)]",
			)}
		>
			{/* 头像 + 名字 */}
			<div className="flex flex-col items-center text-center md:items-start md:text-left">
				<label className="group/avatar relative cursor-pointer">
					<div className="relative">
						<img
							src={avatarUrl(user.avatar_url, user.username)}
							alt={user.username}
							className={cn(
								"size-24 rounded-full object-cover ring-2 ring-border/40 ring-offset-2 ring-offset-background md:size-28",
								"transition-opacity group-hover/avatar:opacity-90",
							)}
						/>
						{/* 悬停遮罩 + 相机图标 */}
						<div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition-colors group-hover/avatar:bg-black/40">
							<Camera className="size-5 text-white opacity-0 transition-opacity group-hover/avatar:opacity-100" />
						</div>
						{user.email_verified && (
							<div
								role="img"
								aria-label="邮箱已验证"
								className="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full border-2 border-background bg-emerald-500 text-white shadow-md"
							>
								<ShieldCheck className="size-3.5" />
							</div>
						)}
						{updateProfile.isPending && (
							<div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70 backdrop-blur-sm">
								<span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
									保存中
								</span>
							</div>
						)}
					</div>
					<input
						type="file"
						accept="image/jpeg,image/png,image/gif,image/webp"
						className="sr-only"
						disabled={updateProfile.isPending}
						onChange={(e) => {
							const f = e.target.files?.[0];
							if (f) {
								setPendingFile(f);
								setCropOpen(true);
							}
							e.target.value = ""; // 允许重复选同一文件
						}}
					/>
				</label>

				<h1 className="mt-4 truncate font-mono text-xl font-bold tracking-tight md:text-2xl">
					{user.username}
				</h1>
				<p className="mt-1 truncate text-sm text-muted-foreground">{user.email}</p>

				{/* 角色徽章 */}
				<div className="mt-3 flex items-center gap-1.5">
					{user.is_root ? (
						<span className="inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-0.5 font-mono text-[10px] font-medium tracking-wider text-background uppercase">
							<Shield className="size-3" />
							root
						</span>
					) : (
						<span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-2.5 py-0.5 text-[10px] font-medium tracking-wider text-foreground/80 uppercase backdrop-blur-sm">
							<Shield className="size-3" />
							{roleLabel}
						</span>
					)}
				</div>
			</div>

			{/* 桌面端统计区 */}
			<dl className="mt-6 hidden grid-cols-2 gap-3 border-t border-border/40 pt-5 md:grid">
				<div>
					<dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
						<CalendarDays className="size-3" />
						注册时间
					</dt>
					<dd className="mt-1 text-sm font-medium">
						{new Date(user.created_at).toLocaleDateString("zh-CN", {
							year: "numeric",
							month: "short",
						})}
					</dd>
				</div>
				<div>
					<dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
						<Mail className="size-3" />
						邮箱状态
					</dt>
					<dd className="mt-1 text-sm font-medium">
						{user.email_verified ? (
							<span className="text-emerald-600 dark:text-emerald-400">已验证</span>
						) : (
							<span className="text-amber-600 dark:text-amber-400">未验证</span>
						)}
					</dd>
				</div>
			</dl>

			{/* Tab 列表 */}
			<TabsList
				variant="line"
				className={cn(
					"mt-6 h-auto w-full justify-start gap-0 border-t border-border/40 p-0 pt-2",
					"flex-row overflow-x-auto md:flex-col md:items-stretch md:overflow-visible",
				)}
			>
				<ProfileSidebarTab
					value="profile"
					icon={<UserIcon className="size-4" />}
					label="个人资料"
				/>
				<ProfileSidebarTab
					value="account"
					icon={<Shield className="size-4" />}
					label="账户信息"
				/>
				<ProfileSidebarTab
					value="password"
					icon={<Lock className="size-4" />}
					label="安全设置"
					hint={<KeyRound className="size-3" />}
				/>
			</TabsList>

			<CropUploadDialog
				file={pendingFile ?? undefined}
				aspect={1}
				purpose="avatar"
				fileNameBase="avatar"
				open={cropOpen}
				onOpenChange={setCropOpen}
				onConfirm={handleConfirm}
			/>
		</div>
	);
};

/**
 * ProfileSidebarTab - 侧栏 Tab 项
 */
const ProfileSidebarTab = ({
	value,
	icon,
	label,
	hint,
}: {
	value: ProfileTab;
	icon: ReactNode;
	label: string;
	hint?: ReactNode;
}) => {
	return (
		<TabsTrigger
			value={value}
			className={cn(
				"relative flex w-full items-center justify-start gap-2.5 rounded-md py-2 pr-3 pl-4 text-left text-sm font-medium",
				"text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground",
				"data-[state=active]:bg-accent data-[state=active]:text-foreground",
				"before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-foreground before:opacity-0 before:transition-opacity",
				"data-[state=active]:before:opacity-100",
			)}
		>
			<span className="flex size-5 items-center justify-center text-muted-foreground transition-colors data-[state=active]:text-foreground">
				{icon}
			</span>
			<span className="flex-1">{label}</span>
			{hint && (
				<span className="text-muted-foreground opacity-0 transition-opacity data-[state=active]:opacity-100">
					{hint}
				</span>
			)}
		</TabsTrigger>
	);
};
