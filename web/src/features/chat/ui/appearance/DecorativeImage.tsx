export interface DecorativeImageProps {
	/** 可信的目录图片路径;绝不接受用户提供的 URL。 */
	src: string;
	/** 纯装饰 CSS;这张图不参与命中测试。 */
	className?: string;
}

/** 加载失败的装饰自行隐藏,不遮挡底下的头像或文字。 */
export function DecorativeImage({ src, className }: DecorativeImageProps) {
	return (
		<img
			key={src}
			src={src}
			alt=""
			aria-hidden="true"
			draggable={false}
			className={className}
			decoding="async"
			onError={(event) => {
				event.currentTarget.hidden = true;
			}}
		/>
	);
}
