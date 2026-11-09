import { cn } from "cn";
import { Plus, Upload } from "lucide-react";
import type { ComponentProps } from "react";
import { Spinner } from "../indicator";

/** 原生上传入口按钮；文件选择与上传状态由消费方管理。 */
export interface UploadTileProps extends ComponentProps<"button"> {
	/** 忙碌时禁止激活并显示加载指示。 */
	busy?: boolean;
	/** 拖放状态由宿主拥有；不会读取文件。 */
	dragActive?: boolean;
}

/** 填满父容器的方形按钮；纯图标用法需提供 aria-label。 */
export function UploadTile({
	busy = false,
	dragActive = false,
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
			data-drag-active={dragActive || undefined}
			className={cn("v-upload-tile", className)}
		>
			{busy ? (
				<Spinner aria-hidden="true" size={20} />
			) : dragActive ? (
				<Upload aria-hidden="true" className="v-upload-tile__icon" />
			) : (
				<Plus aria-hidden="true" className="v-upload-tile__icon" />
			)}
			{children}
		</button>
	);
}
