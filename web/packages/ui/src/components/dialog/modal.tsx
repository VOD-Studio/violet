import { cn } from "cn";
import type { ReactNode } from "react";
import {
	Dialog,
	DialogBody,
	DialogContent,
	type DialogContentProps,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	type DialogSize,
	DialogTitle,
} from "./dialog";

/** 对话框宽度档，与 DialogContent 的 `size` 相同。 */
export type ModalSize = DialogSize;

/** 用属性写完一个三段式对话框：标题、内容与底栏。 */
export interface ModalProps
	extends Pick<
		DialogContentProps,
		"onEscapeKeyDown" | "onInteractOutside" | "dirty" | "entrance" | "container"
	> {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 标题；写这一步要做的事 */
	title?: ReactNode;
	/** 标题下的说明，不重复标题 */
	description?: ReactNode;
	/** 内容区，默认可滚动 */
	children?: ReactNode;
	/** 底栏按钮，主按钮放最后；表单提交按钮用 `form` 关联内容区里的 form */
	footer?: ReactNode;
	/** @default "md" */
	size?: ModalSize;
	/** @default true */
	showCloseButton?: boolean;
	/** 去掉外壳与三段式，children 自管布局（图片预览） */
	unstyled?: boolean;
	/**
	 * 内容区是否自己滚动；false 时由 children 自管滚动（内部分栏各自滚动）。
	 * @default true
	 */
	scrollable?: boolean;
	/** 标题只给读屏 */
	titleSrOnly?: boolean;
	/** @default true */
	modal?: boolean;
	/** 外壳的类名 */
	className?: string;
	/** 遮罩的类名 */
	overlayClassName?: string;
}

/**
 * 属性式对话框：等价于 Dialog、DialogContent 与标题区、内容区、底栏的组合。
 *
 * @example
 * <Modal open={open} onOpenChange={setOpen} title="新建角色" size="sm"
 *   footer={<><Button variant="secondary" onClick={close}>取消</Button>
 *           <Button type="submit" form="role-form">创建</Button></>}>
 *   <form id="role-form" onSubmit={handleSubmit}>{字段}</form>
 * </Modal>
 */
export function Modal({
	open,
	onOpenChange,
	title,
	description,
	children,
	footer = null,
	size = "md",
	showCloseButton = true,
	unstyled = false,
	scrollable = true,
	titleSrOnly = false,
	modal = true,
	className,
	overlayClassName,
	dirty,
	...contentProps
}: ModalProps) {
	const describedBy = description ? {} : { "aria-describedby": undefined };
	return (
		<Dialog open={open} onOpenChange={onOpenChange} modal={modal}>
			<DialogContent
				size={size}
				bare={unstyled}
				showCloseButton={showCloseButton}
				dirty={dirty}
				className={className}
				overlayClassName={overlayClassName}
				{...describedBy}
				{...contentProps}
			>
				{(title || description) && (
					<DialogHeader
						className={cn(titleSrOnly && !description && "v-dialog__header--hidden")}
					>
						{title && (
							<DialogTitle className={cn(titleSrOnly && "v-dialog__title--hidden")}>
								{title}
							</DialogTitle>
						)}
						{description && <DialogDescription>{description}</DialogDescription>}
					</DialogHeader>
				)}
				{unstyled ? (
					children
				) : (
					<DialogBody className={cn(!scrollable && "v-dialog__body--fixed")}>
						{children}
					</DialogBody>
				)}
				{(footer || dirty) && <DialogFooter>{footer}</DialogFooter>}
			</DialogContent>
		</Dialog>
	);
}
