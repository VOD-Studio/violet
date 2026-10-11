import { COVER_FRAME_CLASS } from "@shared/lib/profile-cover";
import { CroppedImage } from "@shared/ui/image-cropper/CroppedImage";
import { cn } from "cn";
import { useState } from "react";

export interface UserProfileCoverProps {
	/** 未设置自定义封面时，用头像生成模糊背景。 */
	avatarSrc?: string;
	/** 保留 GIF 裁剪坐标的自定义封面地址。 */
	coverSrc?: string;
}

/**
 * 主页封面：比例框与裁剪弹窗共用，所见即所得。
 *
 * 自定义封面加载前是骨架底色，加载后淡入；顶部与底部的渐变保证亮图上的
 * 头像卡片与暗图上的文字都有对比，暗色主题再整体压暗一档。
 * 未设置封面时用头像取色做柔和的氛围背景，不是一块纯灰。
 */
export function UserProfileCover({ avatarSrc, coverSrc }: UserProfileCoverProps) {
	const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
	const loaded = !!coverSrc && loadedSrc === coverSrc;

	return (
		<div
			aria-hidden="true"
			className={cn(
				"relative overflow-hidden rounded-2xl bg-muted ring-1 ring-border/60 ring-inset",
				COVER_FRAME_CLASS,
				coverSrc && !loaded && "animate-pulse",
			)}
		>
			{coverSrc ? (
				<CroppedImage
					src={coverSrc}
					fillContainer
					className="absolute inset-0"
					imgClassName={cn(
						"transition-opacity duration-500 motion-reduce:transition-none dark:brightness-90",
						loaded ? "opacity-100" : "opacity-0",
					)}
					onLoad={() => setLoadedSrc(coverSrc)}
					onError={() => setLoadedSrc(coverSrc)}
				/>
			) : avatarSrc ? (
				<>
					<img
						src={avatarSrc}
						alt=""
						// 向外扩出一圈，避免模糊后边缘透出底色。
						className="absolute -inset-10 h-[calc(100%+5rem)] w-[calc(100%+5rem)] max-w-none object-cover opacity-80 blur-3xl saturate-150 dark:opacity-60"
						referrerPolicy="no-referrer"
					/>
					<div className="absolute inset-0 bg-linear-to-br from-primary/15 via-transparent to-primary/10" />
				</>
			) : (
				<div className="absolute inset-0 bg-linear-to-br from-primary/15 via-muted to-primary/10" />
			)}
			<div className="absolute inset-0 bg-linear-to-b from-background/15 via-transparent to-background/55" />
		</div>
	);
}
