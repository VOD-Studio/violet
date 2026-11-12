import { createRef } from "react";
import { Tag, TagToggle } from "../index";

const spanRef = createRef<HTMLSpanElement>();
const anchorRef = createRef<HTMLAnchorElement>();
const buttonRef = createRef<HTMLButtonElement>();

const removable = (
	<Tag ref={spanRef} size="lg" tone="accent" onRemove={() => {}} removeLabel="移除 shell">
		shell
	</Tag>
);

const linkTag = (
	<Tag asChild size="sm" ref={anchorRef}>
		<a href="/tags/shell">#shell</a>
	</Tag>
);

// @ts-expect-error asChild 的子元素自己承载内容，不接收 onRemove。
const invalidSlotRemove = <Tag asChild onRemove={() => {}} />;

// @ts-expect-error asChild 的子元素自己承载内容，不接收 icon。
const invalidSlotIcon = <Tag asChild icon={<svg />} />;

// @ts-expect-error 尺寸只有 xs、sm、md、lg。
const invalidSize = <Tag size="xl">shell</Tag>;

const toggle = (
	<TagToggle ref={buttonRef} pressed onPressedChange={(next: boolean) => void next}>
		前端
	</TagToggle>
);

// @ts-expect-error TagToggle 选中外观固定为强调色，没有 tone。
const invalidToggleTone = <TagToggle tone="accent">前端</TagToggle>;

void [
	removable,
	linkTag,
	invalidSlotRemove,
	invalidSlotIcon,
	invalidSize,
	toggle,
	invalidToggleTone,
];
