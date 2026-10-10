import { CroppedImage } from "@shared/ui/image-cropper/CroppedImage";

export interface UserProfileCoverProps {
	/** 未设置自定义封面时，用头像生成模糊背景。 */
	avatarSrc?: string;
	/** 保留 GIF 裁剪坐标的自定义封面地址。 */
	coverSrc?: string;
}

/** 保留原有封面尺寸与渐隐；自定义封面清晰展示，未设置时回退头像背景。 */
export function UserProfileCover({ avatarSrc, coverSrc }: UserProfileCoverProps) {
	return (
		<div
			aria-hidden="true"
			className="relative h-40 overflow-hidden rounded-2xl bg-muted sm:h-48"
		>
			{coverSrc ? (
				<CroppedImage src={coverSrc} fillContainer className="absolute inset-0" />
			) : avatarSrc ? (
				<img
					src={avatarSrc}
					alt=""
					// 向外扩出一圈，避免模糊后边缘透出底色。
					className="absolute -inset-10 h-[calc(100%+5rem)] w-[calc(100%+5rem)] max-w-none object-cover blur-3xl saturate-150"
					referrerPolicy="no-referrer"
				/>
			) : null}
			<div className="absolute inset-0 bg-linear-to-b from-background/10 via-transparent to-background/60" />
		</div>
	);
}
