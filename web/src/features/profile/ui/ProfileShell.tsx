import { getDisplayName } from "@entities/user/model/display-name";
import type { UserDTO } from "@entities/user/model/types";
import { useUpdateProfile } from "@features/auth/api/mutations";
import { CropUploadDialog, type CropUploadResult } from "@features/upload/ui/CropUploadDialog";
import { avatarUrl } from "@shared/lib/image-url";
import { Link } from "@tanstack/react-router";
import {
	PageShell,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@violet/ui";
import { cn } from "cn";
import { ArrowUpRight, Camera, ShieldCheck, User as UserIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

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
	const [tab, setTab] = useState<ProfileTab>(defaultTab);
	const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");

	useEffect(() => {
		const desktop = window.matchMedia("(min-width: 48rem)");
		const updateOrientation = () => setOrientation(desktop.matches ? "vertical" : "horizontal");
		updateOrientation();
		desktop.addEventListener("change", updateOrientation);
		return () => desktop.removeEventListener("change", updateOrientation);
	}, []);

	return (
		<Tabs
			value={tab}
			onValueChange={(v) => setTab(v as ProfileTab)}
			orientation={orientation}
			className="gap-0"
		>
			<PageShell>
				<div className="mx-auto w-full max-w-7xl">
					<div className="grid grid-cols-1 gap-6 px-1 md:grid-cols-[17rem_minmax(0,1fr)] md:gap-8">
						<aside className="md:sticky md:top-24 md:self-start">
							<ProfileSidebar user={user} />
						</aside>
						<div className="min-w-0">
							<TabsContent
								value="profile"
								className="mt-0 outline-none data-[state=active]:animate-tab-panel-in"
							>
								{profile}
							</TabsContent>
							<TabsContent
								value="security"
								className="mt-0 outline-none data-[state=active]:animate-tab-panel-in"
							>
								{security}
							</TabsContent>
						</div>
					</div>
				</div>
			</PageShell>
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
		<div className="rounded-xl border bg-card p-5 shadow-[0_4px_24px_rgb(0_0_0/0.05)]">
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
					{/* 触屏没有 hover，角标常显提示「可点击更换」 */}
					<span
						className={cn(
							"absolute right-0 bottom-0 flex size-6 items-center justify-center",
							"rounded-full border-2 border-card bg-muted text-muted-foreground",
							"transition-colors group-hover/avatar:bg-primary group-hover/avatar:text-primary-foreground",
						)}
					>
						<Camera className="size-3" />
					</span>
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

				<h1 className="mt-4 max-w-full text-lg font-semibold">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Link
									to="/users/$username"
									params={{ username: user.username }}
									className="group/public inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-sm align-middle text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
								>
									<span className="truncate">{getDisplayName(user)}</span>
									<ArrowUpRight
										aria-hidden
										className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover/public:text-primary group-focus-visible/public:text-primary"
									/>
								</Link>
							</TooltipTrigger>
							<TooltipContent side="top">查看公开主页</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</h1>
				<p className="mt-0.5 truncate text-sm text-muted-foreground">{user.email}</p>
				<p className="mt-1 text-xs text-muted-foreground">
					{user.is_root ? "root" : user.role_description || user.role}
				</p>
			</div>

			{/* Tab 列表：竖排侧栏，移动端横排可滚动 */}
			<TabsList className="mt-6">
				<TabsTrigger value="profile">
					<UserIcon className="size-4" />
					<span>个人资料</span>
				</TabsTrigger>
				<TabsTrigger value="security">
					<ShieldCheck className="size-4" />
					<span>账户与安全</span>
				</TabsTrigger>
			</TabsList>

			<CropUploadDialog
				file={pendingFile ?? undefined}
				aspect={1}
				purpose="avatar"
				fileNameBase="avatar"
				title="调整头像"
				confirmLabel="使用此头像"
				previews={[{ label: "头像", aspect: 1, round: true }]}
				outputMaxWidth={1024}
				open={cropOpen}
				onOpenChange={setCropOpen}
				onConfirm={handleConfirm}
			/>
		</div>
	);
};
