import type { UserDTO } from "@entities/user/model/types";
import { AvatarUploader } from "@features/upload/ui/AvatarUploader";
import { Card } from "@shared/ui/base/card";

interface AvatarSectionProps {
	user: UserDTO;
}

/**
 * AvatarSection - 头像上传区域
 *
 * 复用 upload feature 的 AvatarUploader 组件。
 */
export const AvatarSection = ({ user }: AvatarSectionProps) => {
	return (
		<Card className="p-6">
			<h2 className="mb-6 text-xl font-semibold">头像</h2>
			<AvatarUploader user={user} />
		</Card>
	);
};
