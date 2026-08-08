import type { UserDTO } from "@entities/user/model/types";
import { useUpdateProfile } from "@features/auth/api/mutations";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Textarea } from "@shared/ui/base/textarea";
import { AtSign, Check, FileText, PencilLine, Quote, X } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";

interface ProfileInfoSectionProps {
	user: UserDTO;
}

/**
 * ProfileInfoSection - 个人资料编辑卡片
 *
 * 与 ProfileShell 配合使用：渲染为右侧 Tab 内容之一。
 * 字段内联编辑态——每个字段独立 Edit/Save/Cancel 按钮，
 * 替代旧版"整组进入编辑态"模式，颗粒度更细、保存粒度更准。
 *
 * 单字段变更 + 不变量：保存 username 时不会把 bio 清空，反之亦然。
 */
export const ProfileInfoSection = ({ user }: ProfileInfoSectionProps) => {
	return (
		<Section
			icon={<FileText className="size-4" />}
			title="个人资料"
			description="展示给其他用户的公开信息"
		>
			<div className="divide-y divide-border/40">
				<UsernameField user={user} />
				<BioField user={user} />
			</div>
		</Section>
	);
};

// ============================================================
// 内部组件：Section / Field / UsernameField / BioField
// ============================================================

interface SectionProps {
	icon: ReactNode;
	title: string;
	description?: string;
	children: ReactNode;
}

/**
 * Section - 内容卡片
 *
 * 头部：图标 + 标题 + 描述；内容区：children。
 */
const Section = ({ icon, title, description, children }: SectionProps) => {
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
					{icon}
				</span>
				<div>
					<h2 className="font-mono text-base font-semibold tracking-tight">{title}</h2>
					{description && (
						<p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
					)}
				</div>
			</header>
			{children}
		</section>
	);
};

/**
 * Field - 单字段内联编辑容器
 *
 * 显示态：左 label/hint + 右 value（displayValue） + hover 显示编辑按钮；
 * 编辑态：value 区域变成 renderInput + Save/Cancel。
 */
interface FieldShellProps {
	label: string;
	hint?: string;
	displayValue: ReactNode;
	editor: ReactNode;
	isEditing: boolean;
	onEdit: () => void;
	editLabel: string;
}

const FieldShell = ({
	label,
	hint,
	displayValue,
	editor,
	isEditing,
	onEdit,
	editLabel,
}: FieldShellProps) => {
	return (
		<div className="grid grid-cols-1 gap-3 py-5 first:pt-0 last:pb-0 md:grid-cols-[140px_1fr] md:items-start md:gap-6">
			<div className="md:pt-2">
				<p className="text-sm font-medium text-foreground">{label}</p>
				{hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
			</div>
			<div className="min-w-0 space-y-2">
				{isEditing ? (
					editor
				) : (
					<div className="group/field flex items-start gap-3">
						<div className="min-w-0 flex-1">{displayValue}</div>
						<Button
							size="icon-xs"
							variant="ghost"
							onClick={onEdit}
							className="opacity-0 transition-opacity group-hover/field:opacity-100 focus-visible:opacity-100"
							aria-label={editLabel}
						>
							<PencilLine className="size-3" />
						</Button>
					</div>
				)}
			</div>
		</div>
	);
};

/**
 * UsernameField - 用户名编辑
 */
const UsernameField = ({ user }: { user: UserDTO }) => {
	const updateProfile = useUpdateProfile();
	const [isEditing, setIsEditing] = useState(false);
	const [value, setValue] = useState(user.username);
	const [error, setError] = useState<string | null>(null);

	const handleEdit = () => {
		setValue(user.username);
		setError(null);
		setIsEditing(true);
	};
	const handleCancel = () => {
		setValue(user.username);
		setError(null);
		setIsEditing(false);
	};
	const handleSave = async () => {
		const v = value.trim();
		if (!v) {
			setError("用户名不能为空");
			return;
		}
		if (v.length < 3 || v.length > 32) {
			setError("用户名长度为 3-32 个字符");
			return;
		}
		try {
			await updateProfile.mutateAsync({ username: v });
			toast.success("用户名已更新");
			setIsEditing(false);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "保存失败");
		}
	};

	return (
		<FieldShell
			label="用户名"
			hint="3-32 个字符，作为你的唯一标识"
			editLabel="编辑用户名"
			isEditing={isEditing}
			onEdit={handleEdit}
			displayValue={
				<p className="font-mono text-base font-medium tracking-tight">{user.username}</p>
			}
			editor={
				<>
					<div className="space-y-1.5">
						<div className="relative">
							<AtSign className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
							<Input
								value={value}
								onChange={(e) => setValue(e.target.value)}
								className="pl-9"
								placeholder="请输入用户名"
								aria-invalid={!!error}
								autoFocus
							/>
						</div>
						{error && <p className="text-xs text-destructive">{error}</p>}
					</div>
					<div className="flex items-center gap-2 pt-1">
						<Button
							size="sm"
							onClick={handleSave}
							disabled={updateProfile.isPending}
							className="gap-1.5"
						>
							<Check className="size-3.5" />
							{updateProfile.isPending ? "保存中..." : "保存"}
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onClick={handleCancel}
							disabled={updateProfile.isPending}
							className="gap-1.5"
						>
							<X className="size-3.5" />
							取消
						</Button>
					</div>
				</>
			}
		/>
	);
};

/**
 * BioField - 个人简介编辑
 */
const BioField = ({ user }: { user: UserDTO }) => {
	const updateProfile = useUpdateProfile();
	const [isEditing, setIsEditing] = useState(false);
	const [value, setValue] = useState(user.bio || "");
	const [error, setError] = useState<string | null>(null);

	const handleEdit = () => {
		setValue(user.bio || "");
		setError(null);
		setIsEditing(true);
	};
	const handleCancel = () => {
		setValue(user.bio || "");
		setError(null);
		setIsEditing(false);
	};
	const handleSave = async () => {
		if (value.length > 500) {
			setError("个人简介最多 500 个字符");
			return;
		}
		try {
			await updateProfile.mutateAsync({ bio: value || undefined });
			toast.success("个人简介已更新");
			setIsEditing(false);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "保存失败");
		}
	};

	return (
		<FieldShell
			label="个人简介"
			hint="最多 500 字，让大家认识你"
			editLabel="编辑个人简介"
			isEditing={isEditing}
			onEdit={handleEdit}
			displayValue={
				user.bio ? (
					<div className="flex gap-2">
						<Quote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" />
						<p className="text-sm leading-relaxed text-foreground/90">{user.bio}</p>
					</div>
				) : (
					<p className="text-sm text-muted-foreground">暂无个人简介</p>
				)
			}
			editor={
				<>
					<div className="space-y-1.5">
						<Textarea
							value={value}
							onChange={(e) => setValue(e.target.value)}
							rows={4}
							placeholder="介绍一下自己吧..."
							className="resize-none"
							aria-invalid={!!error}
							autoFocus
						/>
						<div className="flex items-center justify-between">
							{error ? <p className="text-xs text-destructive">{error}</p> : <span />}
							<span className="ml-auto text-xs text-muted-foreground tabular-nums">
								{value.length} / 500
							</span>
						</div>
					</div>
					<div className="flex items-center gap-2 pt-1">
						<Button
							size="sm"
							onClick={handleSave}
							disabled={updateProfile.isPending}
							className="gap-1.5"
						>
							<Check className="size-3.5" />
							{updateProfile.isPending ? "保存中..." : "保存"}
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onClick={handleCancel}
							disabled={updateProfile.isPending}
							className="gap-1.5"
						>
							<X className="size-3.5" />
							取消
						</Button>
					</div>
				</>
			}
		/>
	);
};
