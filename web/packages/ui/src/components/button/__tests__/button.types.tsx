import { createRef, type Ref } from "react";
import { Button, type ButtonProps } from "../index";

const buttonRef = createRef<HTMLButtonElement>();
const anchorRef = createRef<HTMLAnchorElement>();

const nativeButton = (
	<Button
		ref={buttonRef}
		type="submit"
		form="settings"
		onClick={(event) => {
			const element: HTMLButtonElement = event.currentTarget;
			element.disabled = true;
		}}
	>
		保存
	</Button>
);

// @ts-expect-error 原生模式的 ref 必须指向 button。
const invalidNativeRef = <Button ref={anchorRef}>保存</Button>;

const slottedLink = (
	<Button
		asChild
		ref={anchorRef}
		onClick={(event) => {
			const element: HTMLElement = event.currentTarget;
			element.focus();
			// @ts-expect-error asChild 不保证子元素拥有 button 的 disabled 属性。
			event.currentTarget.disabled = true;
		}}
	>
		<a href="/settings">设置</a>
	</Button>
);

const slottedCallbackRef: Ref<HTMLAnchorElement> = (element) => {
	element?.focus();
};
const slottedButtonProps: ButtonProps = { asChild: true, ref: slottedCallbackRef };

// @ts-expect-error 子元素专属属性由子元素自己接收。
const invalidSlottedAttribute: ButtonProps = { asChild: true, href: "/settings" };

void [nativeButton, invalidNativeRef, slottedLink, slottedButtonProps, invalidSlottedAttribute];
