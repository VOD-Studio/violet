# 统一 Dialog 组件 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 做一个真正吸收布局复杂度的 `Dialog` 组件（单组件 + props），调用方只传 title/description/footer/children，不再堆积木；用 motion 接管动画，三段式滚动封装在内部。

**Architecture:** 单组件 `Dialog`（prop-driven）吃掉 header/可滚 body/固定 footer 的三段式布局 + motion AnimatePresence 动画。表单场景用 HTML 原生 `form={id}` 把 footer 的 submit 按钮关联到 children 里的 form。复杂场景（lightbox/Tabs）用 `footer={null}` + `unstyled` 逃生。原 `shared/ui/dialog.tsx`（Radix 原语）作为底座保留并兼容导出。

**Tech Stack:** React 19 + TypeScript + radix-ui@1.6（Dialog 原语）+ framer-motion@12（已装）+ Tailwind v4 + Biome。

**对应 spec:** `docs/superpowers/specs/2026-06-30-dialog-component-design.md`

**提交结构（4 个 commit，按顺序）：**
- Phase 1 → `feat(ui): 重构统一 Dialog 组件（motion 动画 + 三段式滚动）`
- Phase 2 → `refactor: 迁移表单类 dialog 到新 Dialog`
- Phase 3 → `refactor: 迁移中等复杂度 dialog`
- Phase 4 → `refactor: 迁移复杂 dialog（EmojiManage / MediaLightbox）`

---

## 文件结构总览

### Phase 1（新组件，commit `feat(ui)`）

- Create: `web/src/shared/ui/dialog/Dialog.tsx` — ★ 主组件（三段式布局 + motion 动画 + props）
- Create: `web/src/shared/ui/dialog/constants.ts` — size 档位映射
- Create: `web/src/shared/ui/dialog/primitives.tsx` — 原 `dialog.tsx` 的 Radix 原语迁入（底座 + 兼容旧导出）
- Modify: `web/src/shared/ui/dialog.tsx` — 改为 re-export（`Dialog` 主组件 + 旧 `DialogXxx` 别名），保证现有 import 不破

### Phase 2（表单类迁移，commit `refactor`）

- Modify: `web/src/features/admin-shared/ui/confirm-dialog/ConfirmDialog.tsx`
- Modify: `web/src/features/admin-roles/ui/CreateRoleDialog.tsx`
- Modify: `web/src/features/admin-roles/ui/EditRoleDialog.tsx`
- Modify: `web/src/features/admin-users/ui/CreateUserDialog.tsx`
- Modify: `web/src/features/admin-users/ui/EditUserDialog.tsx`
- Modify: `web/src/features/admin-tags/ui/TagDialog.tsx`
- Modify: `web/src/features/admin-permissions/ui/CreatePermissionDialog.tsx`
- Modify: `web/src/features/admin-announcements/ui/AnnouncementDialog.tsx`
- Modify: `web/src/features/media/ui/EditMediaDialog.tsx`
- Modify: `web/src/features/admin-emojis/ui/EmojiGroupFormDialog.tsx`
- Modify: `web/src/features/admin-emojis/ui/EmojiEditDialog.tsx`
- Modify: `web/src/features/auth/ui/LoginDialog.tsx`

### Phase 3（中等复杂度，commit `refactor`）

- Modify: `web/src/features/admin-roles/ui/RolePermissionsDialog.tsx`
- Modify: `web/src/features/media/ui/MediaCoverDialog.tsx`
- Modify: `web/src/routes/admin.media.tsx`（上传 dialog）

### Phase 4（复杂场景，commit `refactor`）

- Modify: `web/src/features/admin-emojis/ui/EmojiManageDialog.tsx`
- Modify: `web/src/features/media/ui/MediaLightbox.tsx`

---

# Phase 1：新 Dialog 组件

## Task 1.1：constants.ts（size 档位）

**Files:**
- Create: `web/src/shared/ui/dialog/constants.ts`

- [ ] **Step 1: 写 constants.ts**

Create `web/src/shared/ui/dialog/constants.ts`:

```ts
/**
 * Dialog 统一尺寸档位
 *
 * 收敛散落的任意 max-w 值（历史里的 sm:max-w-[500px]/sm:max-w-105/2xl 等）。
 * 值为 Tailwind 任意值写法（项目 Tailwind v4 支持任意数字值）。
 */
export const DIALOG_SIZES = {
    /** 小：约 28rem（448px），确认框、简单表单 */
    sm: "sm:max-w-[28rem]",
    /** 中：约 32rem（512px），默认值，多数表单 */
    md: "sm:max-w-[32rem]",
    /** 大：约 42rem（672px），权限树等较宽内容 */
    lg: "sm:max-w-[42rem]",
    /** 超大：约 56rem（896px），表情管理等复杂场景 */
    xl: "sm:max-w-[56rem]",
} as const;

/** 尺寸档位类型 */
export type DialogSize = keyof typeof DIALOG_SIZES;
```

- [ ] **Step 2: Biome 检查**

Run: `cd web && npx --no-install biome check src/shared/ui/dialog/constants.ts`
Expected: 通过（无 lint 错误）。

> 本任务不单独 commit，与 Task 1.3 一起提交。

---

## Task 1.2：primitives.tsx（Radix 原语底座，兼容旧导出）

**Files:**
- Create: `web/src/shared/ui/dialog/primitives.tsx`

把现有 `web/src/shared/ui/dialog.tsx` 的全部内容（Radix 原语 + shadcn 包装：Dialog/DialogContent/DialogHeader/DialogFooter/DialogTitle/DialogDescription/DialogOverlay/DialogPortal/DialogTrigger/DialogClose）原样迁移到 `primitives.tsx`，**只改两处**：

- [ ] **Step 1: 写 primitives.tsx（复制现有 dialog.tsx 内容）**

Create `web/src/shared/ui/dialog/primitives.tsx`，内容 = 现有 `web/src/shared/ui/dialog.tsx` 的完整代码（import、所有组件函数、export 块），**原样不动**。

> 实施时：`cat web/src/shared/ui/dialog.tsx` 取全文，粘进 primitives.tsx。

- [ ] **Step 2: Biome 检查**

Run: `cd web && npx --no-install biome check src/shared/ui/dialog/primitives.tsx`
Expected: 通过。

> 本任务不单独 commit，与 Task 1.3 一起提交。

---

## Task 1.3：Dialog.tsx 主组件（三段式 + motion）

**Files:**
- Create: `web/src/shared/ui/dialog/Dialog.tsx`

- [ ] **Step 1: 写 Dialog.tsx**

Create `web/src/shared/ui/dialog/Dialog.tsx`:

```tsx
import { AnimatePresence, motion } from "framer-motion";
import { XIcon } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { cn } from "@/shared/lib/utils";
import { DIALOG_SIZES, type DialogSize } from "./constants";

/**
 * DialogProps - 统一 Dialog 组件 props
 */
export interface DialogProps {
    /** 受控开关 */
    open: boolean;
    onOpenChange: (open: boolean) => void;

    /** 标题（字符串或自定义节点）。复杂场景可省略自行在 children 渲染 */
    title?: ReactNode;
    /** 副标题/说明 */
    description?: ReactNode;
    /** 中间内容（自动可滚）。逃生场景可放任意自定义布局 */
    children?: ReactNode;

    /**
     * 底部操作区。固定在底部、不随内容滚。
     * - 标准：传按钮（submit 按钮用 form={id} 关联到 children 里的 form）。
     * - 无底部：传 null（复杂场景如 Tabs/lightbox）。
     */
    footer?: ReactNode | null;

    /** 尺寸档位，默认 md */
    size?: DialogSize;
    /** 右上角关闭按钮，默认 true */
    showCloseButton?: boolean;
    /**
     * 无样式逃生口：去掉 padding/border/bg，children 完全自管布局。
     * 给 MediaLightbox 这种 lightbox 场景用。
     */
    unstyled?: boolean;
    /**
     * 中间内容区是否自动滚动，默认 true。
     * 设为 false 时内容区为 overflow-hidden（不自动滚），由 children 自管滚动——
     * 给 EmojiManage 这种内部 Tabs 各自滚动的场景用。
     */
    scrollable?: boolean;
    /** 标题是否仅屏幕阅读器可见（lightbox a11y），默认 false */
    titleSrOnly?: boolean;

    /** Radix Root 的 modal（默认 true） */
    modal?: boolean;
    /** 透传 Radix Content 的 onEscapeKeyDown */
    onEscapeKeyDown?: (e: KeyboardEvent) => void;
    /** 透传 Radix Content 的 onInteractOutside */
    onInteractOutside?: (e: Event) => void;
}

/**
 * Dialog - 统一 Dialog 组件
 *
 * 吸收三段式滚动布局（header 固定 / body 可滚 / footer 固定）+ motion 进出动画。
 * 调用方只传 title/description/children/footer，不写任何布局 class。
 *
 * 表单场景：children 放 `<form id="xxx">`，footer 的 submit 按钮用 `form="xxx"` 关联。
 *
 * @example
 * <Dialog open={open} onOpenChange={setOpen} title="创建角色" size="sm"
 *   footer={<><Button variant="outline" onClick={close}>取消</Button>
 *           <Button type="submit" form="role-form">创建</Button></>}>
 *   <form id="role-form" onSubmit={handleSubmit} className="space-y-4">{字段}</form>
 * </Dialog>
 */
export function Dialog({
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
}: DialogProps) {
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
                                    DIALOG_SIZES[size],
                                )}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                            >
                                {/* 标题区：固定。titleSrOnly 时也渲染（保证 a11y Title 存在） */}
                                {(title || description || showCloseButton || titleSrOnly) && (
                                    <div
                                        className={cn(
                                            "flex shrink-0 flex-col gap-2",
                                            unstyled ? "" : "px-6 pt-6",
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex flex-col gap-2">
                                                {title && (
                                                    <DialogPrimitive.Title
                                                        className={cn(
                                                            "text-lg leading-none font-semibold",
                                                            titleSrOnly && "sr-only",
                                                        )}
                                                    >
                                                        {title}
                                                    </DialogPrimitive.Title>
                                                )}
                                                {description && (
                                                    <DialogPrimitive.Description className="text-sm text-muted-foreground">
                                                        {description}
                                                    </DialogPrimitive.Description>
                                                )}
                                            </div>
                                            {showCloseButton && (
                                                <DialogPrimitive.Close
                                                    className="rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:outline-hidden [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
                                                    aria-label="关闭"
                                                >
                                                    <XIcon />
                                                </DialogPrimitive.Close>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* 内容区 */}
                                {unstyled ? (
                                    children
                                ) : (
                                    <div
                                        className={cn(
                                            "min-h-0 flex-1 px-6 py-4",
                                            scrollable ? "overflow-y-auto" : "overflow-hidden",
                                        )}
                                    >
                                        {children}
                                    </div>
                                )}

                                {/* 底部：固定，有内容才渲染 */}
                                {footer && (
                                    <div
                                        className={cn(
                                            "flex shrink-0 flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end",
                                        )}
                                    >
                                        {footer}
                                    </div>
                                )}
                            </motion.div>
                        </DialogPrimitive.Content>
                    </DialogPrimitive.Portal>
                )}
            </AnimatePresence>
        </DialogPrimitive.Root>
    );
}
```

- [ ] **Step 2: tsc + biome**

Run: `cd web && npm run typecheck && npx --no-install biome check src/shared/ui/dialog/Dialog.tsx`
Expected: tsc 通过；biome 通过（必要时 `--write` 修格式）。

> 本任务不单独 commit，与 Task 1.4 一起提交。

---

## Task 1.4：dialog.tsx 改为 re-export（兼容旧导出）

**Files:**
- Modify: `web/src/shared/ui/dialog.tsx`

把 `dialog.tsx` 清空，改为 re-export：新 `Dialog` 主组件 + 旧 `DialogXxx` 原语别名（保证现有 `import { DialogContent, DialogHeader, ... } from "@shared/ui/dialog"` 不破）。

> **命名冲突处理**：旧文件里的根组件叫 `Dialog`（Radix Root），新主组件也叫 `Dialog`。为避免冲突，把 primitives 里的 Root **改名 `DialogRoot`** 导出。现有用裸 `Dialog`（Root）的文件只有 4 个：EmojiManageDialog / EmojiGroupFormDialog / MediaLightbox（Phase 2-4 会迁移成新 Dialog）+ `command.tsx`（Command 组件，非 dialog，需立即改 import）。

- [ ] **Step 1: 调整 primitives.tsx 的 Root 导出名**

Modify `web/src/shared/ui/dialog/primitives.tsx`（Task 1.2 创建的）：把根组件函数 `Dialog` 改名为 `DialogRoot`，对应 export 改为 `DialogRoot`。其余原语（DialogContent/Header/Footer/...）名字不变。

具体：找到
```tsx
function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
    return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}
```
改为
```tsx
function DialogRoot({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
    return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}
```
并把文件末尾 export 块里的 `Dialog,` 改为 `DialogRoot,`。

- [ ] **Step 2: 重写 dialog.tsx 为 re-export**

Replace entire content of `web/src/shared/ui/dialog.tsx` with:

```tsx
/**
 * Dialog 模块统一出口
 *
 * - `Dialog`：新统一组件（推荐，吸收布局 + motion 动画）。见 ./dialog/Dialog.tsx
 * - `DialogContent` / `DialogHeader` / ... / `DialogRoot`：旧 Radix 原语，兼容历史 import。
 *   新代码请直接用 `Dialog`，不要再用这些原语堆积布局。
 *   （旧根组件改名 DialogRoot，避免与新 Dialog 冲突）
 */
export { Dialog, type DialogProps } from "./dialog/Dialog";

export {
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogOverlay,
    DialogPortal,
    DialogRoot,
    DialogTitle,
    DialogTrigger,
} from "./dialog/primitives";
```

- [ ] **Step 3: 修复 command.tsx 的 Root 引用（唯一非 dialog 消费者）**

Modify `web/src/shared/ui/command.tsx`：把 `import { Dialog }` 改为 `import { DialogRoot as Dialog }`（最小改动，保持内部 `Dialog` 用法不变）。

Run: `cd web && grep -n "import { Dialog" src/shared/ui/command.tsx` 确认位置后改。

- [ ] **Step 4: 临时修复 3 个待迁移 dialog 的 Root 引用**

对 EmojiManageDialog / EmojiGroupFormDialog / MediaLightbox（Phase 2-4 才迁移）：把 `import { Dialog, ... }` 改为 `import { DialogRoot as Dialog, ... }`（从 primitives 拿 Root 别名），保证编译过。迁移时再换成新 `Dialog`。

逐个文件改（注意保留它们对 DialogContent/Header 等原语的 import）。

- [ ] **Step 5: 全量 tsc + biome**

Run: `cd web && npm run typecheck && npx --no-install biome check src/shared/ui/dialog.tsx src/shared/ui/dialog/ src/shared/ui/command.tsx src/features/admin-emojis/ui/EmojiManageDialog.tsx src/features/admin-emojis/ui/EmojiGroupFormDialog.tsx src/features/media/ui/MediaLightbox.tsx`
Expected: 全通过。现有所有文件编译过。

- [ ] **Step 6: Commit**

```bash
cd /Users/sun/Developer/mimo-blog
git add web/src/shared/ui/dialog.tsx web/src/shared/ui/dialog/ web/src/shared/ui/command.tsx web/src/features/admin-emojis/ui/EmojiManageDialog.tsx web/src/features/admin-emojis/ui/EmojiGroupFormDialog.tsx web/src/features/media/ui/MediaLightbox.tsx
git commit -m "feat(ui): 重构统一 Dialog 组件（motion 动画 + 三段式滚动）

- 新 Dialog 主组件：单组件吸收 header/可滚 body/固定 footer 三段式布局
- motion AnimatePresence 接管进出动画（Radix forceMount）
- 表单 footer 用 form={id} 关联；复杂场景 footer={null}/unstyled/scrollable 逃生
- 旧 Radix 原语迁入 dialog/primitives.tsx 作底座，Root 改名 DialogRoot 兼容"
```

---

# Phase 2：迁移表单类 dialog

> **通用迁移模式**（每个表单 dialog 都按此改）：
>
> 旧：
> ```tsx
> <Dialog open={open} onOpenChange={onOpenChange}>
>   <DialogContent className="sm:max-w-md">
>     <DialogHeader><DialogTitle>..</DialogTitle><DialogDescription>..</DialogDescription></DialogHeader>
>     <form onSubmit={handleSubmit} className="space-y-4">
>       {字段}
>       <DialogFooter><Button onClick={close}>取消</Button><Button type="submit">提交</Button></DialogFooter>
>     </form>
>   </DialogContent>
> </Dialog>
> ```
>
> 新：
> ```tsx
> <Dialog
>   open={open} onOpenChange={onOpenChange}
>   title=".." description=".." size="md"
>   footer={<><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
>           <Button type="submit" form="xxx-form">提交</Button></>}
> >
>   <form id="xxx-form" onSubmit={handleSubmit} className="space-y-4">{字段}</form>
> </Dialog>
> ```
>
> **要点**：
> 1. 删 `DialogContent/DialogHeader/DialogFooter/DialogTitle/DialogDescription` 的嵌套。
> 2. form 加 `id="xxx-form"`，去掉 `className="space-y-4"` 之外的所有布局 class。
> 3. footer 按钮里 submit 用 `form="xxx-form"`，cancel 用 `type="button" onClick={() => onOpenChange(false)}`。
> 4. `import { Dialog } from "@shared/ui/dialog"`（新主组件）。

## Task 2.1：ConfirmDialog

**Files:**
- Modify: `web/src/features/admin-shared/ui/confirm-dialog/ConfirmDialog.tsx`

- [ ] **Step 1: 迁移 ConfirmDialog**

现有 ConfirmDialog 结构（读自现状）：`Dialog > DialogContent(showCloseButton=false) > DialogHeader(Title+Description) + DialogFooter(取消/确认)`。

替换为（用新 `Dialog`）：

```tsx
import { Button } from "@shared/ui/button";
import { Dialog } from "@shared/ui/dialog";
import { Loader2 } from "lucide-react";

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    loading?: boolean;
    onConfirm: () => void;
}

/**
 * ConfirmDialog - 通用确认弹窗
 *
 * 危险操作（删除等）的二次确认。确认按钮支持 loading 态防止重复提交。
 */
export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = "确认",
    cancelLabel = "取消",
    loading = false,
    onConfirm,
}: ConfirmDialogProps) {
    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
            title={title}
            description={description}
            size="sm"
            showCloseButton={false}
            footer={
                <>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                    >
                        {cancelLabel}
                    </Button>
                    <Button variant="destructive" onClick={onConfirm} disabled={loading}>
                        {loading && <Loader2 className="mr-1 size-4 animate-spin" />}
                        {confirmLabel}
                    </Button>
                </>
            }
        />
    );
}
```

- [ ] **Step 2: tsc + biome**

Run: `cd web && npm run typecheck && npx --no-install biome check src/features/admin-shared/ui/confirm-dialog/ConfirmDialog.tsx`
Expected: 通过。

> 本任务不单独 commit，Phase 2 全部完成后一起提交。

---

## Task 2.2：CreateRoleDialog（表单模板）

**Files:**
- Modify: `web/src/features/admin-roles/ui/CreateRoleDialog.tsx`

- [ ] **Step 1: 迁移（按通用模式）**

现有结构（读自现状）：`Dialog > DialogContent(sm:max-w-md) > DialogHeader(创建角色/创建新的系统角色) + form(space-y-4){角色名称字段 + 角色描述字段 + DialogFooter(取消/创建)}`。

替换 return 部分（保留 schema/hook/handlers 不变）：

- import：删 `Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle` from dialog；改为 `import { Dialog } from "@shared/ui/dialog"`。
- return：

```tsx
    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
            title="创建角色"
            description="创建新的系统角色"
            size="sm"
            footer={
                <>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={createRole.isPending}
                    >
                        取消
                    </Button>
                    <Button type="submit" form="create-role-form" disabled={createRole.isPending}>
                        {createRole.isPending && (
                            <Loader2 className="mr-1 size-4 animate-spin" />
                        )}
                        创建
                    </Button>
                </>
            }
        >
            <form
                id="create-role-form"
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-4"
            >
                {/* 角色名称 */}
                <div className="space-y-2">
                    <Label htmlFor="name">
                        角色名称 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="name"
                        placeholder="如：editor"
                        {...register("name")}
                        disabled={createRole.isPending}
                    />
                    {errors.name && (
                        <p className="text-destructive text-sm">{errors.name.message}</p>
                    )}
                    <p className="text-muted-foreground text-xs">
                        只能包含字母、数字、下划线和连字符
                    </p>
                </div>

                {/* 角色描述 */}
                <div className="space-y-2">
                    <Label htmlFor="description">
                        角色描述 <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                        id="description"
                        placeholder="如：内容编辑"
                        rows={3}
                        {...register("description")}
                        disabled={createRole.isPending}
                    />
                    {errors.description && (
                        <p className="text-destructive text-sm">{errors.description.message}</p>
                    )}
                </div>
            </form>
        </Dialog>
    );
```

> 字段 JSX（Input/Label/Textarea/register）保持原样，只是从 DialogFooter 嵌套里拎出来放进 `<form>`。

- [ ] **Step 2: tsc + biome**

Run: `cd web && npm run typecheck && npx --no-install biome check src/features/admin-roles/ui/CreateRoleDialog.tsx`
Expected: 通过。

> 不单独 commit。

---

## Task 2.3：EditRoleDialog

**Files:**
- Modify: `web/src/features/admin-roles/ui/EditRoleDialog.tsx`

- [ ] **Step 1: 迁移（同 Task 2.2 模式）**

读现有结构：`Dialog > DialogContent(sm:max-w-md) > DialogHeader(编辑角色/修改角色信息) + form(space-y-4){角色名称 + 角色描述 + DialogFooter(取消/保存，updateRole.isPending)}`。

迁移：
- import 换 `import { Dialog } from "@shared/ui/dialog"`。
- form id 用 `edit-role-form`。
- footer：取消（`onClick={() => onOpenChange(false)}`）+ 保存（`type="submit" form="edit-role-form" disabled={updateRole.isPending}`，带 Loader2）。
- title="编辑角色"，description="修改角色信息"，size="sm"。
- 字段 JSX 原样保留进 `<form id="edit-role-form" className="space-y-4">`。

- [ ] **Step 2: tsc + biome**

Run: `cd web && npm run typecheck && npx --no-install biome check src/features/admin-roles/ui/EditRoleDialog.tsx`
Expected: 通过。

> 不单独 commit。

---

## Task 2.4：CreateUserDialog

**Files:**
- Modify: `web/src/features/admin-users/ui/CreateUserDialog.tsx`

- [ ] **Step 1: 迁移**

读现有结构：`Dialog > DialogContent(sm:max-w-[500px]) > DialogHeader(创建用户/创建一个新的用户账户) + form{ <div className="space-y-4 py-4">{用户名/邮箱/密码/角色 + is_active} + DialogFooter(取消/创建，createUser.isPending) }`。

迁移（注意：`sm:max-w-[500px]` ≈ 31.25rem → 用 size="md" 即 32rem）：
- import 换 `Dialog`。
- form id 用 `create-user-form`。
- title="创建用户"，description="创建一个新的用户账户"，size="md"。
- 把 `<div className="space-y-4 py-4">...</div>` 改成 `<form id="create-user-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">{字段}</form>`（去掉 py-4，新组件 body 自带 padding）。
- footer：取消 + 创建（`form="create-user-form"`）。
- 注意 `is_active` Switch 那段（`<div className="flex items-center justify-between">`）保持原样在 form 内。

- [ ] **Step 2: tsc + biome**

Run: `cd web && npm run typecheck && npx --no-install biome check src/features/admin-users/ui/CreateUserDialog.tsx`
Expected: 通过。

> 不单独 commit。

---

## Task 2.5：EditUserDialog

**Files:**
- Modify: `web/src/features/admin-users/ui/EditUserDialog.tsx`

- [ ] **Step 1: 迁移（同 Task 2.4 模式）**

读现有结构：`Dialog > DialogContent(sm:max-w-[500px]) > DialogHeader(编辑用户/修改用户账户信息) + form{ <div className="space-y-4 py-4">{用户名/邮箱/密码/角色 + is_active} + DialogFooter(取消/保存，updateUser.isPending) }`。

迁移：
- size="md"，form id `edit-user-form`。
- title="编辑用户"，description="修改用户账户信息"。
- footer：取消 + 保存（`form="edit-user-form"`）。

- [ ] **Step 2: tsc + biome**

Run: `cd web && npm run typecheck && npx --no-install biome check src/features/admin-users/ui/EditUserDialog.tsx`
Expected: 通过。

> 不单独 commit。

---

## Task 2.6：TagDialog

**Files:**
- Modify: `web/src/features/admin-tags/ui/TagDialog.tsx`

- [ ] **Step 1: 迁移**

读现有结构：`Dialog > DialogContent(sm:max-w-md) > DialogHeader({isEdit?编辑标签:创建标签}/{isEdit?修改标签名称:新建一个标签}) + form(space-y-4){标签名字段 + DialogFooter(取消/{isEdit?保存:创建})}`。

迁移：
- size="sm"，form id `tag-form`。
- title 用 `{isEdit ? "编辑标签" : "创建标签"}`，description 用 `{isEdit ? "修改标签名称（slug 将自动重算）" : "新建一个标签"}`。
- footer：取消 + 提交（`form="tag-form"`，label `{isEdit ? "保存" : "创建"}`，pending 用 `createTag.isPending || updateTag.isPending`）。
- form 内放标签名字段。

- [ ] **Step 2: tsc + biome**

Run: `cd web && npm run typecheck && npx --no-install biome check src/features/admin-tags/ui/TagDialog.tsx`
Expected: 通过。

> 不单独 commit。

---

## Task 2.7：CreatePermissionDialog

**Files:**
- Modify: `web/src/features/admin-permissions/ui/CreatePermissionDialog.tsx`

- [ ] **Step 1: 迁移**

读现有结构：`Dialog > DialogContent(sm:max-w-md) > DialogHeader({isEdit?编辑权限:创建权限}/...) + form(space-y-4){类型 Select + 父节点 Select(条件) + 代码 + 名称 + 描述 + 排序 + DialogFooter(取消/{isEdit?保存:创建})}`。字段较多（5-6 个），是验证长内容滚动的场景。

迁移：
- size="sm"，form id `permission-form`。
- title `{isEdit ? "编辑权限" : "创建权限"}`，description `{isEdit ? "修改权限定义" : "新建权限点（menu 为分组容器，action 为可授权操作）"}`。
- footer：取消 + 提交（`form="permission-form"`，label `{isEdit ? "保存" : "创建"}`，pending）。
- form 内放全部字段（类型/父节点/代码/名称/描述/排序），保持所有 Controller/register/校验原样。
- 这是长内容场景，迁移后应自动出现 body 滚动——验证。

- [ ] **Step 2: tsc + biome**

Run: `cd web && npm run typecheck && npx --no-install biome check src/features/admin-permissions/ui/CreatePermissionDialog.tsx`
Expected: 通过。

> 不单独 commit。

---

## Task 2.8：AnnouncementDialog

**Files:**
- Modify: `web/src/features/admin-announcements/ui/AnnouncementDialog.tsx`

- [ ] **Step 1: 迁移**

读现有结构：`Dialog > DialogContent(sm:max-w-lg max-h-[85vh] overflow-y-auto) > DialogHeader({isEdit?编辑公告:创建公告}/...) + form(space-y-4){标题 + 类型 Select + 内容 Textarea + 启用 Switch + 生效区间(两个 datetime) + DialogFooter(取消/{isEdit?保存:创建})}`。原本是整框滚（`overflow-y-auto`）。

迁移：
- size="md"（原 sm:max-w-lg ≈ 32rem），form id `announcement-form`。
- 去掉 `max-h-[85vh] overflow-y-auto`（新组件内部处理滚动）。
- title `{isEdit ? "编辑公告" : "创建公告"}`，description `{isEdit ? "修改公告内容与生效设置" : "新建一条站点公告"}`。
- footer：取消 + 提交（`form="announcement-form"`）。
- form 内放全部字段。

- [ ] **Step 2: tsc + biome**

Run: `cd web && npm run typecheck && npx --no-install biome check src/features/admin-announcements/ui/AnnouncementDialog.tsx`
Expected: 通过。

> 不单独 commit。

---

## Task 2.9：EditMediaDialog

**Files:**
- Modify: `web/src/features/media/ui/EditMediaDialog.tsx`

- [ ] **Step 1: 迁移**

读现有结构：`Dialog > DialogContent(sm:max-w-md) > DialogHeader(编辑素材/修改文件名、描述或分类) + form(onSubmit, space-y-4){文件名 + 描述 + 分类 + DialogFooter(取消/保存)}`。注意它的 form 用 `onSubmit={onSubmit}`（不是 react-hook-form 的 handleSubmit）。

迁移：
- size="sm"，form id `edit-media-form`。
- title="编辑素材"，description="修改文件名、描述或分类"。
- footer：取消 + 保存（`form="edit-media-form"`）。
- form 内放字段，`onSubmit` 保持原样。

- [ ] **Step 2: tsc + biome**

Run: `cd web && npm run typecheck && npx --no-install biome check src/features/media/ui/EditMediaDialog.tsx`
Expected: 通过。

> 不单独 commit。

---

## Task 2.10：EmojiGroupFormDialog

**Files:**
- Modify: `web/src/features/admin-emojis/ui/EmojiGroupFormDialog.tsx`

- [ ] **Step 1: 迁移**

读现有结构：`Dialog > DialogContent(无 size，默认 lg) > DialogHeader({editingGroup?编辑表情分组:创建表情分组}) + div(space-y-4){名称 Input + 排序 + 表情类型 + DialogFooter(自定义 className mt-6 border-t pt-4)(取消/{editingGroup?保存:创建})}`。注意：**不是 form 元素**（用 useState 手动管理），DialogFooter 有自定义 border-t 样式。

迁移：
- size="md"，无 form id（不是表单提交，按钮用 onClick）。
- title `{editingGroup ? "编辑表情分组" : "创建表情分组"}`，无 description。
- footer：取消（`onClick={() => onOpenChange(false)}`）+ 提交（`onClick={handleSubmit}`，label `{editingGroup ? "保存" : "创建"}`，submitting）。**去掉 footer 的自定义 className**（新组件 footer 自带 border-t）。
- children 放原来的字段 div（名称/排序/类型），去掉 `space-y-4` 外层的布局职责，保留 `space-y-4` 间距即可。

- [ ] **Step 2: tsc + biome**

Run: `cd web && npm run typecheck && npx --no-install biome check src/features/admin-emojis/ui/EmojiGroupFormDialog.tsx`
Expected: 通过。

> 不单独 commit。

---

## Task 2.11：EmojiEditDialog

**Files:**
- Modify: `web/src/features/admin-emojis/ui/EmojiEditDialog.tsx`

- [ ] **Step 1: 迁移**

读现有结构：`Dialog > DialogContent(无 size) > DialogHeader(编辑表情/修改表情的名称和内容) + div(space-y-4 py-4){名称 + 图片URL + 文本内容 + DialogFooter(取消/保存)}`。**不是 form**，状态由父组件 EmojiManageDialog 通过 props 传入（onSave）。

迁移：
- size="md"，无 form id。
- title="编辑表情"，description="修改表情的名称和内容"。
- footer：取消（`onClick={() => onOpenChange(false)}`）+ 保存（`onClick={onSave}`，isSaving）。
- children 放字段 div（名称/URL/文本）。

- [ ] **Step 2: tsc + biome**

Run: `cd web && npm run typecheck && npx --no-install biome check src/features/admin-emojis/ui/EmojiEditDialog.tsx`
Expected: 通过。

> 不单独 commit。

---

## Task 2.12：LoginDialog

**Files:**
- Modify: `web/src/features/auth/ui/LoginDialog.tsx`

- [ ] **Step 1: 迁移**

读现有结构：`Dialog(open, handleOpenChange) > DialogContent(sm:max-w-105) > DialogHeader(重新登录/...) + form(onSubmit={handleSubmit}){ <div className="space-y-4 py-2">{邮箱 + 密码} + DialogFooter(取消/重新登录) }`。注意 `handleOpenChange` 有自定义逻辑（pending 时拒绝关闭），要保留。

迁移：
- size="sm"（sm:max-w-105 ≈ 26rem，比 sm 的 28rem 略小，但够用）。
- form id `login-form`。
- title="重新登录"，description 保留原文。
- `onOpenChange={handleOpenChange}`（保留自定义逻辑）。
- footer：取消（`onClick={() => handleOpenChange(false)}`）+ 重新登录（`form="login-form"`）。
- form 内放字段。

- [ ] **Step 2: tsc + biome**

Run: `cd web && npm run typecheck && npx --no-install biome check src/features/auth/ui/LoginDialog.tsx`
Expected: 通过。

- [ ] **Step 3: Commit Phase 2**

```bash
cd /Users/sun/Developer/mimo-blog
git add web/src/features/admin-shared/ui/confirm-dialog web/src/features/admin-roles/ui/CreateRoleDialog.tsx web/src/features/admin-roles/ui/EditRoleDialog.tsx web/src/features/admin-users/ui/CreateUserDialog.tsx web/src/features/admin-users/ui/EditUserDialog.tsx web/src/features/admin-tags/ui/TagDialog.tsx web/src/features/admin-permissions/ui/CreatePermissionDialog.tsx web/src/features/admin-announcements/ui/AnnouncementDialog.tsx web/src/features/media/ui/EditMediaDialog.tsx web/src/features/admin-emojis/ui/EmojiGroupFormDialog.tsx web/src/features/admin-emojis/ui/EmojiEditDialog.tsx web/src/features/auth/ui/LoginDialog.tsx
git commit -m "refactor: 迁移表单类 dialog 到新 Dialog（form={id} + 统一布局）"
```

---

# Phase 3：中等复杂度 dialog

## Task 3.1：RolePermissionsDialog

**Files:**
- Modify: `web/src/features/admin-roles/ui/RolePermissionsDialog.tsx`

- [ ] **Step 1: 迁移**

读现有结构：`Dialog > DialogContent(sm:max-w-2xl max-h-[80vh] overflow-y-auto) > DialogHeader(配置角色权限/...) + div(space-y-6){权限树分组 map} + DialogFooter(取消/保存)`。原本整框滚。

迁移：
- size="lg"（sm:max-w-2xl ≈ 42rem），去掉 `max-h-[80vh] overflow-y-auto`。
- title="配置角色权限"，description 保留。
- footer：取消（`onClick={() => onOpenChange(false)}`）+ 保存（`onClick={handleSave}`，saving）。
- children 放权限树分组 `<div className="space-y-6">...</div>`（保持 map 结构）。
- 这是长内容场景，权限树会在 body 区滚动，header/footer 固定——验证。

- [ ] **Step 2: tsc + biome**

Run: `cd web && npm run typecheck && npx --no-install biome check src/features/admin-roles/ui/RolePermissionsDialog.tsx`
Expected: 通过。

> 不单独 commit。

---

## Task 3.2：MediaCoverDialog

**Files:**
- Modify: `web/src/features/media/ui/MediaCoverDialog.tsx`

- [ ] **Step 1: 迁移**

读现有结构：`Dialog > DialogContent(sm:max-w-2xl) > DialogHeader(选择视频封面/...) + <FramePicker onConfirm onCancel submitting />`。**无 DialogFooter**（FramePicker 自带按钮）。

迁移：
- size="lg"，footer={null}（FramePicker 自带按钮）。
- title="选择视频封面"，description 保留。
- children 放 `<FramePicker ... />`。

- [ ] **Step 2: tsc + biome**

Run: `cd web && npm run typecheck && npx --no-install biome check src/features/media/ui/MediaCoverDialog.tsx`
Expected: 通过。

> 不单独 commit。

---

## Task 3.3：admin.media 上传 dialog

**Files:**
- Modify: `web/src/routes/admin.media.tsx`（约 214-235 行的 upload dialog）

- [ ] **Step 1: 迁移**

读现有结构（admin.media.tsx 内）：`Dialog(open=uploadOpen) > DialogContent(sm:max-w-lg) > DialogHeader(上传素材/支持拖拽多文件，分片上传含进度) + <Uploader purpose="material" ... />`。**无 DialogFooter**（Uploader 自带按钮）。

迁移：
- size="md"，footer={null}。
- title="上传素材"，description="支持拖拽多文件，分片上传含进度"。
- children 放 `<Uploader ... />`。
- 该文件还组合了 EditMediaDialog/MediaCoverDialog/ConfirmDialog/MediaLightbox，**只改 upload 这一个 dialog**，其余不动。

- [ ] **Step 2: tsc + biome**

Run: `cd web && npm run typecheck && npx --no-install biome check src/routes/admin.media.tsx`
Expected: 通过。

- [ ] **Step 3: Commit Phase 3**

```bash
cd /Users/sun/Developer/mimo-blog
git add web/src/features/admin-roles/ui/RolePermissionsDialog.tsx web/src/features/media/ui/MediaCoverDialog.tsx web/src/routes/admin.media.tsx
git commit -m "refactor: 迁移中等复杂度 dialog（RolePermissions 滚动 / footer={null}）"
```

---

# Phase 4：复杂 dialog

## Task 4.1：EmojiManageDialog

**Files:**
- Modify: `web/src/features/admin-emojis/ui/EmojiManageDialog.tsx`

- [ ] **Step 1: 迁移**

读现有结构（已读全文）：`Dialog(open, handleOpenChange 防穿透) > DialogContent(flex max-h-[85vh] max-w-xl...sm:max-w-4xl) > DialogHeader(DialogTitle 带图标和计数) + Tabs{ TabsList + TabsContent(manage: EmojiToolbar + 滚动列表) + TabsContent(upload: 滚动上传) }`。**无 DialogFooter**，带嵌套 EmojiEditDialog/ConfirmDialog + innerDialog 防穿透。

迁移：
- size="xl"，footer={null}。
- **title 用自定义节点**（带 Images 图标 + 计数 span）：`title={<><Images className="size-5" /> 管理表情 {计数 span}</>}`。注意 title 渲染在 DialogPrimitive.Title 里，自定义节点 OK。
- `onOpenChange={handleOpenChange}`（保留防穿透逻辑）。
- children 放 `<Tabs>...</Tabs>`（含 TabsList + 两个 TabsContent，内部滚动结构保留——但要注意：新组件 body 已是 `overflow-y-auto`，Tabs 内部又有 `flex-1 overflow-y-auto`，会双重滚动。**处理**：EmojiManage 的 Tabs 需要自己撑满高度且内部各自滚动，所以这里**不能用新组件的默认 body 滚动**。改用 `unstyled`？不行，unstyled 会去掉 padding。

  **正确处理**：EmojiManage 需要标准 header padding（标题区），但内容区要让 Tabs 自管滚动（不自动滚）。用 `scrollable={false}`：内容区变成 `overflow-hidden`（不自动滚），Tabs 内部各自 `flex-1 overflow-y-auto` 滚动。header/footer 由新组件正常提供 padding。

  **方案**：
  - `<Dialog size="xl" footer={null} scrollable={false} title={...} onOpenChange={handleOpenChange}>`
  - children：`<div className="flex h-full flex-col"><Tabs className="flex h-full flex-col overflow-hidden">...</Tabs></div>`（注意 Tabs 要 `h-full` 撑满内容区高度，内部列表/上传各自滚）。原 Tabs 的 `flex flex-1 flex-col overflow-hidden` 改为 `flex h-full flex-col overflow-hidden`。
  - 这样不用 unstyled，header 有正常 padding，Tabs 在内容区里自管滚动。

- import：删 `Dialog, DialogContent, DialogHeader, DialogTitle`；改 `import { Dialog } from "@shared/ui/dialog"`。
- 保留 `<>` fragment 包裹主 Dialog + EmojiEditDialog + ConfirmDialog。

- [ ] **Step 2: tsc + biome**

Run: `cd web && npm run typecheck && npx --no-install biome check src/features/admin-emojis/ui/EmojiManageDialog.tsx`
Expected: 通过。

- [ ] **Step 3: 手动验证（重点）**

跑 `make dev`，打开表情管理：
- Tabs 切换正常。
- 管理侧列表能滚（EmojiList 滚动），上传侧能滚。
- 标题区固定（带图标和计数），有正常 padding。
- 点编辑/删除弹出内层 dialog，期间外层不关（防穿透未破）。

> 不单独 commit。

---

## Task 4.2：MediaLightbox

**Files:**
- Modify: `web/src/features/media/ui/MediaLightbox.tsx`

- [ ] **Step 1: 迁移**

读现有结构：`Dialog(open, modal={!fullscreenOpen}) > DialogContent(max-w-[95vw] gap-0 border-none bg-background/95 p-0 sm:max-w-300 showCloseButton, onInteractOutside/onEscapeKeyDown 阻断) > DialogTitle(sr-only) + 切换栏 + 预览区(max-h-[82vh] overflow-auto)`。lightbox：无 padding、透明背景、无边框、sr-only title、modal 切换、阻断外部关闭。

迁移：
- `unstyled` + `footer={null}` + `showCloseButton` + `titleSrOnly`（sr-only title，a11y）。
- title：传 `title={file.original_name}` + `titleSrOnly`（Task 1.3 已加此 prop，Title 渲染为 sr-only）。
- `modal={!fullscreenOpen}`，`onEscapeKeyDown`/`onInteractOutside` 透传（fullscreenOpen 时阻断）。
- size="xl"（会被 className 的 `sm:max-w-[95vw]` 覆盖，twMerge 保证后者生效）。
- children 放切换栏 + 预览区（原样）。
- className 传 `sm:max-w-[95vw] gap-0 bg-background/95`（unstyled 已去 padding/border，再补透明背景和自定义 max-w）。

- [ ] **Step 2: tsc + biome**

Run: `cd web && npm run typecheck && npx --no-install biome check src/features/media/ui/MediaLightbox.tsx`
Expected: 通过。

- [ ] **Step 3: 手动验证（重点）**

跑 `make dev`，打开 media lightbox：
- 透明无边框背景（接近原样）。
- 切换栏 + 预览区正常，预览区可滚。
- 关闭按钮可见。
- fullscreen 态下 ESC/外部点击不关闭（阻断未破）。

- [ ] **Step 4: Commit Phase 4**

```bash
cd /Users/sun/Developer/mimo-blog
git add web/src/features/admin-emojis/ui/EmojiManageDialog.tsx web/src/features/media/ui/MediaLightbox.tsx
git commit -m "refactor: 迁移复杂 dialog（EmojiManage Tabs / MediaLightbox 逃生口）

- EmojiManage 用 scrollable={false} 让 Tabs 自管滚动，保留嵌套 dialog 防穿透
- MediaLightbox 用 unstyled + titleSrOnly + className 覆盖实现透明无边框 lightbox"
```

---

## 完成验证

- [ ] **全量 tsc**：`cd web && npm run typecheck`
- [ ] **全量 biome**：`cd web && npx --no-install biome check .`（改动文件无新增错误）
- [ ] **手动逐个核对**（重点）：
  - 所有 dialog 进出动画一致（motion scale+fade，~200ms）。
  - 长内容（Announcement/Permission/RolePermissions）仅中间滚，header/footer 固定。
  - 表单 footer 的 submit 按钮（form={id}）能触发表单提交（重点验证：填写表单点 footer 的提交按钮，能正常提交）。
  - MediaLightbox 仍是透明无边框；EmojiManage 的 Tabs 滚动 + 嵌套 dialog 防穿透未破。

---

## 计划自检（spec 覆盖核对）

| Spec 要求 | 对应 Task |
|-----------|----------|
| 新 Dialog 主组件（三段式 + motion） | 1.1/1.2/1.3/1.4 |
| 旧原语作底座兼容 | 1.2/1.4 |
| footer={id} 关联 | 2.2-2.12（所有表单） |
| ConfirmDialog 迁移 | 2.1 |
| 8 个表单 dialog 迁移 | 2.2-2.12 |
| RolePermissions（长内容滚动） | 3.1 |
| MediaCover / upload（footer={null}） | 3.2/3.3 |
| EmojiManage（Tabs + 防穿透） | 4.1（scrollable={false}） |
| MediaLightbox（lightbox 逃生口） | 4.2（unstyled + titleSrOnly） |
| titleSrOnly 扩展（lightbox a11y） | 1.3（核心 prop） |
| scrollable 扩展（内部自管滚动） | 1.3（核心 prop） |
| size 四档 | 1.1 |

无遗漏。类型一致性：DialogProps（open/onOpenChange/title/description/children/footer/size/showCloseButton/unstyled/scrollable/titleSrOnly/modal/onEscapeKeyDown/onInteractOutside）在各 Task 引用一致；scrollable 在 4.1 用、titleSrOnly 在 4.2 用、unstyled 在 4.2 用、footer={null} 在 3.2/3.3/4.1/4.2 用。size 档位 sm/md/lg/xl 统一。
