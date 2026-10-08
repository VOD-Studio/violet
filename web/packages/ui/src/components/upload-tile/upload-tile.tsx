import { cn } from "cn";
import { Loader2, Plus } from "lucide-react";
import type { ComponentProps } from "react";

/** 原生上传入口按钮；文件选择与上传状态由消费方管理。 */
export interface UploadTileProps extends ComponentProps<"button"> {
	/** 忙碌时禁止激活并显示加载指示。 */
	busy?: boolean;
}

/** 填满父容器的方形按钮；纯图标用法需提供 aria-label。 */
export function UploadTile({
	busy = false,
	disabled = false,
	type = "button",
	className,
	children,
	ref,
	...props
}: UploadTileProps) {
	return (
		<button
			{...props}
			ref={ref}
			type={type}
			disabled={disabled || busy}
			aria-busy={busy || props["aria-busy"]}
			data-slot="upload-tile"
			data-busy={busy ? "true" : undefined}
			className={cn("v-upload-tile", className)}
		>
			{busy ? (
				<Loader2 aria-hidden="true" className="v-upload-tile__spinner" />
			) : (
				<Plus aria-hidden="true" className="v-upload-tile__icon" />
			)}
			{children}
		</button>
	);
}
