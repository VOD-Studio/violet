export interface UserProfileCoverProps {
	/** 作为封面底图的图片；缺省时只剩底色。目前传头像，以后接入自定义封面时替换为封面图。 */
	imageSrc?: string;
}

/**
 * 公开用户页的封面：把底图放大模糊成一片柔和的色彩，底部渐隐进页面背景。
 *
 * 色彩来自用户自己的图片，没有上传封面时也不会是一块空白的渐变。
 */
export function UserProfileCover({ imageSrc }: UserProfileCoverProps) {
	return (
		<div
			aria-hidden="true"
			className="relative h-40 overflow-hidden rounded-2xl bg-muted sm:h-48"
		>
			{imageSrc && (
				<img
					src={imageSrc}
					alt=""
					// 向外扩出一圈，避免模糊后边缘透出底色。
					className="absolute -inset-10 h-[calc(100%+5rem)] w-[calc(100%+5rem)] max-w-none object-cover blur-3xl saturate-150"
					referrerPolicy="no-referrer"
				/>
			)}
			<div className="absolute inset-0 bg-linear-to-b from-background/10 via-transparent to-background/60" />
		</div>
	);
}
