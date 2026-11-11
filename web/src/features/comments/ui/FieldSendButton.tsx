import { Spinner } from "@violet/ui";
import { cn } from "cn";
import { Send } from "lucide-react";
import type { Ref } from "react";

export interface FieldSendButtonProps {
	ref?: Ref<HTMLButtonElement>;
	/** 可访问名称，如「发送」「登录并发送」 */
	label: string;
	/** 没有可发送的内容或不允许发送 */
	disabled: boolean;
	/** 请求在途：图标换成细圆弧，按钮保持不可点 */
	loading?: boolean;
	/**
	 * 点击回调；作为表单提交钮使用时省略并传 `submit`。
	 *
	 * @default undefined
	 */
	onClick?: () => void;
	/**
	 * 原生按钮类型。
	 *
	 * @default "button"
	 */
	type?: "button" | "submit";
}

/**
 * 字段布局里的发送钮：无内容时只是一枚淡淡的图标，有内容后底色转为墨色，提示可以发送。
 *
 * @remarks 底色与文字色只走过渡，不位移不缩放；减弱动态下直接切换。
 */
export function FieldSendButton({
	ref,
	label,
	disabled,
	loading = false,
	onClick,
	type = "button",
}: FieldSendButtonProps) {
	const inactive = disabled || loading;
	return (
		<button
			ref={ref}
			type={type}
			title={label}
			aria-label={label}
			aria-busy={loading || undefined}
			disabled={inactive}
			onClick={onClick}
			className={cn(
				"inline-flex size-6 shrink-0 items-center justify-center rounded-full pointer-coarse:size-7",
				"transition-colors duration-150 motion-reduce:transition-none",
				"focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-ring",
				disabled
					? "cursor-not-allowed text-muted-foreground opacity-50"
					: "bg-foreground text-background enabled:hover:bg-foreground/85",
				loading && "cursor-progress",
			)}
		>
			{loading ? <Spinner size={16} aria-hidden="true" /> : <Send className="size-3.5" />}
		</button>
	);
}
