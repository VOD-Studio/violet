import { AnimatePresence, motion } from "framer-motion";
import { Dialog as DialogPrimitive } from "radix-ui";

import { cn } from "@/shared/lib/utils";
import { MODAL_SIZES, type ModalProps } from "../types/modal-types";
import { ModalBody } from "./ModalBody";
import { ModalFooter } from "./ModalFooter";
import { ModalHeader } from "./ModalHeader";

/**
 * Modal - 统一 Modal 组件
 *
 * 吸收三段式滚动布局（header 固定 / body 可滚 / footer 固定）+ motion 进出动画。
 * 调用方只传 title/description/children/footer，不写任何布局 class。
 *
 * 表单场景：children 放 `<form id="xxx">`，footer 的 submit 按钮用 `form="xxx"` 关联。
 * 复杂场景：footer={null}（无底部）、unstyled（lightbox 无样式）、scrollable={false}（内部自管滚）。
 *
 * @example
 * <Modal open={open} onOpenChange={setOpen} title="创建角色" size="sm"
 *   footer={<><Button variant="outline" onClick={close}>取消</Button>
 *           <Button type="submit" form="role-form">创建</Button></>}>
 *   <form id="role-form" onSubmit={handleSubmit} className="space-y-4">{字段}</form>
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
    onEscapeKeyDown,
    onInteractOutside,
    className,
}: ModalProps) {
    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={modal}>
            <AnimatePresence>
                {open && (
                    <DialogPrimitive.Portal forceMount>
                        {/* 遮罩：渐入渐出 */}
                        <DialogPrimitive.Overlay asChild forceMount>
                            <motion.div
                                className="fixed inset-0 z-50 bg-black/50"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                            />
                        </DialogPrimitive.Overlay>

                        {/* 内容：缩放 + 渐入 */}
                        <DialogPrimitive.Content
                            forceMount
                            onEscapeKeyDown={onEscapeKeyDown}
                            onInteractOutside={onInteractOutside}
                            asChild
                        >
                            <motion.div
                                className={cn(
                                    "fixed top-[50%] left-[50%] z-50 flex max-h-[85vh] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden rounded-lg bg-background shadow-lg outline-none",
                                    !unstyled && "border",
                                    MODAL_SIZES[size],
                                    className,
                                )}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                            >
                                <ModalHeader
                                    title={title}
                                    description={description}
                                    titleSrOnly={titleSrOnly}
                                    showCloseButton={showCloseButton}
                                    unstyled={unstyled}
                                />

                                {unstyled ? (
                                    children
                                ) : (
                                    <ModalBody scrollable={scrollable}>{children}</ModalBody>
                                )}

                                {footer && <ModalFooter>{footer}</ModalFooter>}
                            </motion.div>
                        </DialogPrimitive.Content>
                    </DialogPrimitive.Portal>
                )}
            </AnimatePresence>
        </DialogPrimitive.Root>
    );
}
