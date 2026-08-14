import type { UserDTO } from "@entities/user/model/types";
import { useUpdateProfile } from "@features/auth/api/mutations";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Textarea } from "@shared/ui/base/textarea";
import { AtSign, Check, PencilLine, Quote, X } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { SectionCard } from "./SectionCard";

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
 */
export const ProfileInfoSection = ({ user }: ProfileInfoSectionProps) => {
	return (
		<SectionCard title="个人资料" description="这些信息会公开展示给其他访客">
			<div className="divide-y">
				<UsernameField user={user} />
				<DisplayNameField user={user} />
				<BioField user={user} />
			</div>
		</SectionCard>
	);
};

// ============================================================
// 内部组件：Field / UsernameField / DisplayNameField / BioField
// ============================================================

/**
 * Field - 单字段内联编辑容器
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
							size="icon-sm"
							variant="ghost"
							onClick={onEdit}
							// 触屏没有 hover，移动端常显；桌面保持 hover 显现的克制感
							className="opacity-100 transition-opacity md:opacity-0 md:group-hover/field:opacity-100 md:focus-visible:opacity-100"
							aria-label={editLabel}
						>
							<PencilLine className="size-3.5" />
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
			hint="唯一登录标识，3-32 个字符"
			editLabel="编辑用户名"
			isEditing={isEditing}
			onEdit={handleEdit}
			displayValue={<p className="font-mono text-sm font-medium">{user.username}</p>}
			editor={
				<>
					<div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
						<div className="relative flex-1">
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
						<div className="flex shrink-0 items-center gap-2">
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
					</div>
					{error && <p className="text-xs text-destructive">{error}</p>}
				</>
			}
		/>
	);
};

/**
 * DisplayNameField - 显示名编辑
 *
 * 显示名可空（空时回退 username），允许中文/emoji/空格，最多 32 字符。
 * 与 UsernameField（纯 ASCII 登录标识）互补：这里放展示性内容。
 */
const DisplayNameField = ({ user }: { user: UserDTO }) => {
	const updateProfile = useUpdateProfile();
	const [isEditing, setIsEditing] = useState(false);
	const [value, setValue] = useState(user.display_name || "");
	const [error, setError] = useState<string | null>(null);

	const handleEdit = () => {
		setValue(user.display_name || "");
		setError(null);
		setIsEditing(true);
	};
	const handleCancel = () => {
		setValue(user.display_name || "");
		setError(null);
		setIsEditing(false);
	};
	const handleSave = async () => {
		const v = value.trim();
		if (v.length > 32) {
			setError("显示名最多 32 个字符");
			return;
		}
		try {
			await updateProfile.mutateAsync({ display_name: v });
			toast.success("显示名已更新");
			setIsEditing(false);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "保存失败");
		}
	};

	return (
		<FieldShell
			label="显示名"
			hint="展示昵称，可用中文；留空显示用户名"
			editLabel="编辑显示名"
			isEditing={isEditing}
			onEdit={handleEdit}
			displayValue={
				<p className="text-sm font-medium">
					{user.display_name || (
						<span className="font-normal text-muted-foreground">未设置</span>
					)}
				</p>
			}
			editor={
				<>
					<div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
						<Input
							className="flex-1"
							value={value}
							onChange={(e) => setValue(e.target.value)}
							placeholder="留空显示用户名"
							aria-invalid={!!error}
							autoFocus
						/>
						<div className="flex shrink-0 items-center gap-2">
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
					</div>
					{error && <p className="text-xs text-destructive">{error}</p>}
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
			hint="一句话介绍自己，最多 500 字"
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
