import { getDisplayName } from "@entities/user/model/display-name";
import type { UserDTO } from "@entities/user/model/types";
import { useUpdateProfile } from "@features/auth/api/mutations";
import { CropUploadDialog, type CropUploadResult } from "@features/upload/ui/CropUploadDialog";
import { avatarUrl } from "@shared/lib/image-url";
import { cn } from "@shared/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shared/ui/base/tabs";
import { ShieldCheck, User as UserIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

interface ProfileShellProps {
	user: UserDTO;
	defaultTab?: ProfileTab;
	profile: ReactNode;
	security: ReactNode;
}

/**
 * ProfileTab - 个人中心 Tab 标识
 */
export type ProfileTab = "profile" | "security";

/**
 * ProfileShell - 个人中心布局壳
 *
 * 桌面（≥ md）：左侧栏（头像 + 用户信息 + Tab 列表）+ 右内容区。
 * 移动（< md）：顶部头像区 + Tab 横排 + 内容区。
 *
 * 头像点击直接唤起裁剪弹窗（CropUploadDialog），无额外遮罩。
 */
export const ProfileShell = ({
	user,
	defaultTab = "profile",
	profile,
	security,
}: ProfileShellProps) => {
	return (
		<Tabs defaultValue={defaultTab} orientation="vertical" className="gap-0">
			<div className="container mx-auto max-w-5xl px-4 py-8 md:py-12">
				<div className="grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr] md:gap-8">
					<aside className="md:sticky md:top-24 md:self-start">
						<ProfileSidebar user={user} />
					</aside>
					<div className="min-w-0">
						<TabsContent value="profile" className="mt-0 outline-none">
							{profile}
						</TabsContent>
						<TabsContent value="security" className="mt-0 outline-none">
							{security}
						</TabsContent>
					</div>
				</div>
			</div>
		</Tabs>
	);
};

const ProfileSidebar = ({ user }: { user: UserDTO }) => {
	const [pendingFile, setPendingFile] = useState<File | null>(null);
	const [cropOpen, setCropOpen] = useState(false);
	const updateProfile = useUpdateProfile();

	const handleConfirm = async (result: CropUploadResult) => {
		try {
			await updateProfile.mutateAsync({ avatar_url: result.url });
			setPendingFile(null);
		} catch (e) {
			console.error(e);
		}
	};

	return (
		<div className="rounded-xl border bg-card p-5 shadow-sm">
			{/* 头像 + 用户信息 */}
			<div className="flex flex-col items-center text-center md:items-start md:text-left">
				<label className="group/avatar relative cursor-pointer">
					<img
						src={avatarUrl(user.avatar_url, user.username)}
						alt={user.username}
						className={cn(
							"size-20 rounded-full object-cover md:size-24",
							"ring-1 ring-transparent transition group-hover/avatar:ring-primary",
							updateProfile.isPending && "opacity-60",
						)}
					/>
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
							e.target.value = "";
						}}
					/>
				</label>

				<h1 className="mt-4 text-lg font-semibold">{getDisplayName(user)}</h1>
				<p className="mt-0.5 truncate text-sm text-muted-foreground">{user.email}</p>
				<p className="mt-1 text-xs text-muted-foreground">
					{user.is_root ? "root" : user.role_description || user.role}
				</p>
			</div>

			{/* Tab 列表 */}
			<TabsList
				variant="line"
				className={cn(
					"mt-6 h-auto w-full justify-start border-t pt-2",
					"flex-row overflow-x-auto md:flex-col md:items-stretch md:overflow-visible",
				)}
			>
				<ProfileSidebarTab
					value="profile"
					icon={<UserIcon className="size-4" />}
					label="个人资料"
				/>
				<ProfileSidebarTab
					value="security"
					icon={<ShieldCheck className="size-4" />}
					label="账户与安全"
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

const ProfileSidebarTab = ({
	value,
	icon,
	label,
}: {
	value: ProfileTab;
	icon?: ReactNode;
	label: string;
}) => {
	return (
		<TabsTrigger
			value={value}
			className={cn(
				"relative flex w-full items-center justify-start gap-2 rounded-md py-2 pr-3 pl-3 text-left text-sm font-medium",
				"text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground",
				"data-[state=active]:bg-accent data-[state=active]:text-foreground",
			)}
		>
			{icon}
			<span className="flex-1">{label}</span>
		</TabsTrigger>
	);
};
