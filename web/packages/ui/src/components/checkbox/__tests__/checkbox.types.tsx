import { createRef } from "react";
import { Checkbox, type CheckboxProps } from "../checkbox";
import { type CheckboxVariantProps, checkboxVariants } from "../styles";

const buttonRef = createRef<HTMLButtonElement>();
const inputRef = createRef<HTMLInputElement>();
const props: CheckboxProps = {
	checked: "indeterminate",
	defaultChecked: false,
	ref: buttonRef,
	name: "terms",
	value: "accepted",
	form: "settings",
	required: true,
	variant: "primary",
	size: "sm",
	"aria-label": "确认条款",
	onCheckedChange: (checked) => {
		const state: boolean | "indeterminate" = checked;
		void state;
	},
	onKeyDown: (event) => {
		const control: HTMLButtonElement = event.currentTarget;
		void control;
	},
};
const variant: CheckboxVariantProps = { variant: "default", size: "lg" };
void (<Checkbox {...props} />);
void checkboxVariants(variant);

// @ts-expect-error ref 指向 Radix Root 的 button，不是表单桥接 input。
void (<Checkbox ref={inputRef} />);
// @ts-expect-error 指示器由组件维护，公开 API 不接收 children。
void (<Checkbox>选项</Checkbox>);
// @ts-expect-error 组件不提供未实现的 Root 替换能力。
void (<Checkbox asChild />);
// @ts-expect-error Checkbox 固定为 button，不承担表单提交。
void (<Checkbox type="submit" />);
// @ts-expect-error checked 仅允许真实的三态值。
void (<Checkbox checked="mixed" />);
// @ts-expect-error 变体来自公开 recipe。
void (<Checkbox variant="brand" />);
