import type { MediaFile } from "@entities/media/model/types";
import { MediaPicker } from "@entities/media/ui/MediaPicker";
import type { PersonaAdminAsset } from "@entities/persona/model/types";
import { mediaFileToPersonaAvatar } from "@features/persona-editor/model/document";
import { Button } from "@shared/ui/base/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/base/card";
import { ImagePlus, UserRound, X } from "lucide-react";
import { useState } from "react";

interface PersonaAvatarFieldProps {
	avatar: PersonaAdminAsset | null;
	disabled: boolean;
	onChange: (avatar: PersonaAdminAsset | null) => void;
}

/** 编辑跨语言共用、会进入站点导航身份入口的角色头像。 */
export function PersonaAvatarField({ avatar, disabled, onChange }: PersonaAvatarFieldProps) {
	const [pickerOpen, setPickerOpen] = useState(false);
	const chooseAvatar = (files: MediaFile[]) => {
		const file = files.find((candidate) => candidate.mime_type.startsWith("image/"));
		if (file) onChange(mediaFileToPersonaAvatar(file));
		setPickerOpen(false);
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>角色头像</CardTitle>
				<p className="text-xs leading-relaxed text-muted-foreground">
					所有语言共用；激活后同步用于顶部站点标志与身份卡片。
				</p>
			</CardHeader>
			<CardContent className="flex flex-wrap items-center gap-4">
				<button
					type="button"
					disabled={disabled}
					className="group relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border border-edge-hairline bg-muted/45 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
					onClick={() => setPickerOpen(true)}
					aria-label={avatar ? "更换角色头像" : "选择角色头像"}
				>
					{avatar ? (
						<img
							src={avatar.thumbnail || avatar.url}
							alt={avatar.alt_text || "当前角色头像"}
							className="size-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.03]"
						/>
					) : (
						<UserRound className="size-8 text-muted-foreground" />
					)}
				</button>
				<div className="min-w-52 flex-1 space-y-2">
					<p className="text-sm font-medium">
						{avatar ? "已配置独立头像" : "尚未配置头像"}
					</p>
					<p className="text-xs leading-relaxed text-muted-foreground">
						选择清晰的正方形近景；头像独立于各语言的设定图顺序。
					</p>
					{!disabled ? (
						<div className="flex flex-wrap gap-2 pt-1">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setPickerOpen(true)}
							>
								<ImagePlus className="size-4" />
								{avatar ? "更换头像" : "选择头像"}
							</Button>
							{avatar ? (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => onChange(null)}
								>
									<X className="size-4" />
									清除
								</Button>
							) : null}
						</div>
					) : null}
				</div>
			</CardContent>

			<MediaPicker
				open={pickerOpen}
				onOpenChange={setPickerOpen}
				onConfirm={chooseAvatar}
				mediaType="image"
				source="owned"
				title="选择角色头像"
			/>
		</Card>
	);
}
