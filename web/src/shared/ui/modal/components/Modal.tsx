import { AnimatePresence, motion } from "framer-motion";
import { Dialog as DialogPrimitive } from "radix-ui";

import { cn } from "@/shared/lib/utils";
import { MODAL_SIZES, type ModalProps } from "../types/modal-types";
import { ModalBody } from "./ModalBody";
import { ModalFooter } from "./ModalFooter";
import { ModalHeader } from "./ModalHeader";

/**
 * 判断事件目标是否落在 Radix 浮层（Select/Popover/Tooltip 等独立 Portal）内。
 *
 * Radix Dialog 与 Select 各自走独立 Portal，Dialog 无法感知 Select 的弹出层，
 * 导致 Select 打开时点击其选项（或点别处收起 Select）会被 Dialog 误判为
 * "点击外部"而关闭整个弹窗。拦截此类事件即可修复。
 *
 * 参数用结构类型而非 React.SyntheticEvent：Radix 的 onInteractOutside /
 * onPointerDownOutside 回调参数是 CustomEvent，只保证有 target 与 preventDefault。
 */
function isInsideRadixFloating(event: { target: EventTarget | null }): boolean {
    const target = event.target as HTMLElement | null;
    if (!target) return false;
    return !!target.closest(
        // 覆盖各类 Radix 浮层：Select（popper 包裹 / listbox / viewport）、
        // DropdownMenu、Popover、Tooltip 等，避免嵌套点击误关 Dialog。
        "[data-radix-popper-content-wrapper], [role=listbox], [data-radix-select-viewport], [data-radix-menu-content], [data-radix-popper-anchor]",
    );
}

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
                            // 合并外部交互处理：
                            // 1. Select/Popover 等 Radix 浮层的点击不算"外部"（修复 Select 关 Dialog 的 bug）
                            // 2. 再交给调用方传入的 onInteractOutside（如 lightbox 全屏期间阻断关闭）
                            onInteractOutside={(e) => {
                                if (isInsideRadixFloating(e)) {
                                    e.preventDefault();
                                    return;
                                }
                                onInteractOutside?.(e);
                            }}
                            onPointerDownOutside={(e) => {
                                if (isInsideRadixFloating(e)) {
                                    e.preventDefault();
                                }
                            }}
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
