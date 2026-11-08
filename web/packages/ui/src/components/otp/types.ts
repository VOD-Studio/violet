import type { ComponentPropsWithRef, InputHTMLAttributes, ReactNode } from "react";

/** 值与完成事件针对整串验证码；原生 ref 和 id 指向第一格。 */
export interface InputOTPProps
	extends Omit<
		ComponentPropsWithRef<"input">,
		"children" | "value" | "defaultValue" | "onChange" | "size" | "type"
	> {
	value?: string;
	defaultValue?: string;
	onChange?: (value: string) => void;
	/** 仅用户输入令所有格子填满时触发，不验证验证码是否正确。 */
	onComplete?: (value: string) => void;
	children?: ReactNode;
	/** 两个 className 都属于整组；每格覆盖放在 InputOTPSlot。 */
	containerClassName?: string;
	/** 出错边沿播放涟漪，结束后清空并回到首格；文案由 Field 提供。 */
	invalid?: boolean;
	valid?: boolean;
}

/** 每格保留原生 input 的 ref 与可取消事件，值由 InputOTP 根管理。 */
export interface InputOTPSlotProps
	extends Omit<ComponentPropsWithRef<"input">, "value" | "defaultValue" | "name" | "type"> {
	index: number;
}

export type OTPNativeProps = Omit<
	InputHTMLAttributes<HTMLInputElement>,
	"value" | "defaultValue" | "onChange" | "children" | "name" | "id" | "className"
>;
