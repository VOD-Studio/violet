import type { UserDTO } from "@entities/user/model/types";
import { useUpdateProfile } from "@features/auth/api/mutations";
import { Button } from "@shared/ui/button";
import { Card } from "@shared/ui/card";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Check, Edit2, User, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ProfileInfoSectionProps {
	user: UserDTO;
}

/**
 * ProfileInfoSection - 个人资料编辑区域
 *
 * 支持编辑用户名和个人简介，包含前端验证和乐观更新。
 */
export const ProfileInfoSection = ({ user }: ProfileInfoSectionProps) => {
	const [isEditing, setIsEditing] = useState(false);
	const [username, setUsername] = useState(user.username);
	const [bio, setBio] = useState(user.bio || "");
	const [errors, setErrors] = useState<{ username?: string; bio?: string }>({});

	const updateProfile = useUpdateProfile();

	const validate = (): boolean => {
		const nextErrors: typeof errors = {};

		if (!username.trim()) {
			nextErrors.username = "用户名不能为空";
		} else if (username.length < 3 || username.length > 32) {
			nextErrors.username = "用户名长度为 3-32 个字符";
		}

		if (bio.length > 500) {
			nextErrors.bio = "个人简介最多 500 个字符";
		}

		setErrors(nextErrors);
		return Object.keys(nextErrors).length === 0;
	};

	const handleSave = () => {
		if (!validate()) return;

		updateProfile.mutate(
			{ username, bio: bio || undefined },
			{
				onSuccess: () => {
					toast.success("个人资料已更新");
					setIsEditing(false);
				},
				onError: (err) => {
					toast.error(err instanceof Error ? err.message : "更新失败");
				},
			},
		);
	};

	const handleCancel = () => {
		setUsername(user.username);
		setBio(user.bio || "");
		setErrors({});
		setIsEditing(false);
	};

	return (
		<Card className="p-6">
			<div className="mb-6 flex items-center justify-between">
				<h2 className="text-xl font-semibold">个人资料</h2>
				{!isEditing && (
					<Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
						<Edit2 className="mr-2 size-4" />
						编辑
					</Button>
				)}
			</div>

			<div className="space-y-4">
				{/* 用户名 */}
				<div className="space-y-2">
					<Label htmlFor="username" className="flex items-center gap-2">
						<User className="size-4" />
						用户名
					</Label>
					{isEditing ? (
						<>
							<Input
								id="username"
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								placeholder="请输入用户名（3-32 个字符）"
								aria-invalid={!!errors.username}
							/>
							{errors.username && <p className="text-sm text-destructive">{errors.username}</p>}
						</>
					) : (
						<p className="text-base">{user.username}</p>
					)}
				</div>

				{/* 个人简介 */}
				<div className="space-y-2">
					<Label htmlFor="bio" className="flex items-center justify-between">
						<span>个人简介</span>
						{isEditing && <span className="text-xs text-muted-foreground">{bio.length} / 500</span>}
					</Label>
					{isEditing ? (
						<>
							<textarea
								id="bio"
								value={bio}
								onChange={(e) => setBio(e.target.value)}
								placeholder="介绍一下自己吧..."
								rows={4}
								className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
								aria-invalid={!!errors.bio}
							/>
							{errors.bio && <p className="text-sm text-destructive">{errors.bio}</p>}
						</>
					) : (
						<p className="text-base text-muted-foreground">{user.bio || "暂无个人简介"}</p>
					)}
				</div>

				{/* 操作按钮 */}
				{isEditing && (
					<div className="flex gap-2 pt-2">
						<Button
							onClick={handleSave}
							disabled={updateProfile.isPending}
							className="flex items-center gap-2"
						>
							<Check className="size-4" />
							{updateProfile.isPending ? "保存中..." : "保存"}
						</Button>
						<Button
							variant="outline"
							onClick={handleCancel}
							disabled={updateProfile.isPending}
							className="flex items-center gap-2"
						>
							<X className="size-4" />
							取消
						</Button>
					</div>
				)}
			</div>
		</Card>
	);
};
