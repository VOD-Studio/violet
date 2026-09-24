import type { MediaFile } from "@entities/media/model/types";
import { AvatarPicker } from "@entities/media/ui/AvatarPicker";
import type { PersonaAdminAsset } from "@entities/persona/model/types";
import { mediaFileToPersonaAvatar } from "@features/persona-editor/model/document";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/base/card";

interface PersonaAvatarFieldProps {
	avatar: PersonaAdminAsset | null;
	disabled: boolean;
	onChange: (avatar: PersonaAdminAsset | null) => void;
}

/** 编辑跨语言共用、会进入站点导航身份入口的角色头像。 */
export function PersonaAvatarField({ avatar, disabled, onChange }: PersonaAvatarFieldProps) {
	const pickAvatar = (file: MediaFile | null) =>
		onChange(file ? mediaFileToPersonaAvatar(file) : null);

	return (
		<Card>
			<CardHeader>
				<CardTitle>角色头像</CardTitle>
				<p className="text-xs leading-relaxed text-muted-foreground">
					所有语言共用；激活后同步用于顶部站点标志与身份卡片。
				</p>
			</CardHeader>
			<CardContent className="flex flex-wrap items-center gap-4">
				<AvatarPicker
					value={avatar?.thumbnail || avatar?.url || ""}
					shape="square"
					sizeClassName="size-24"
					alt={avatar?.alt_text || "当前角色头像"}
					pickerTitle="选择角色头像"
					source="owned"
					disabled={disabled}
					onChange={pickAvatar}
				/>
				<div className="min-w-52 flex-1 space-y-2">
					<p className="text-sm font-medium">
						{avatar ? "已配置独立头像" : "尚未配置头像"}
					</p>
					<p className="text-xs leading-relaxed text-muted-foreground">
						点击头像块从素材库选择清晰的正方形近景，右上角角标清除；头像独立于各语言的设定图顺序。
					</p>
				</div>
			</CardContent>
		</Card>
	);
}
