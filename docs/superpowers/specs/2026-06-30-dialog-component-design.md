# 统一 Dialog 组件设计

> 日期：2026-06-30
> 分支：release/2.0
> 状态：已确认设计，待实现

## 背景与问题

项目现有 16 个 dialog，全部直接使用 `shared/ui/dialog.tsx`（Radix 原语 + shadcn 包装）裸拼，导致：

1. **滚动策略混乱**（核心问题）——3 种写法并存：
   - 无滚动（多数表单）：内容长就撑破视口。
   - 整框滚（`DialogContent` 上 `overflow-y-auto`）：header/footer 跟着滚走。
   - flex 三段式（仅 EmojiManageDialog）：header/footer 固定、中间滚——正确但未复用。
2. **调用方要"堆积木"**——每个 dialog 手写 `Dialog > DialogContent > DialogHeader > form(flex) > DialogFooter` 多层嵌套 + 自己拼布局 class（`flex min-h-0 flex-1`、`max-h-[85vh] overflow-y-auto` 等），复杂度全部泄漏给业务代码。
3. **尺寸散落**——`sm:max-w-md` / `lg` / `2xl` / `[500px]` / `105` / `300` 等任意值。
4. **动画观感不一致**——根因是内容滚动态下 zoom 动画形变，非动画配置本身（配置其实已统一）。

## 调研结论（最佳实践）

来源：[developerway Modal 设计](https://www.developerway.com/posts/hard-react-questions-and-modal-dialog)、[web.dev Dialog](https://web.dev/articles/building/a-dialog-component)、[MUI Dialog](https://mui.com/material-ui/react-dialog/)、[Primer Dialog](https://primer.style/product/components/dialog/guidelines/)、[Motion Radix 指南](https://motion.dev/docs/radix)、[radix#2023](https://github.com/radix-ui/primitives/issues/2023)。

1. **两层 API 并存**：简单场景用 prop-driven（title/description/footer 当 prop），复杂场景用逃生口（自定义 children + 无 footer）。成熟库（MUI/Primer/antd）均如此。
2. **滚动封装在组件内部**——长内容时仅 content 区滚，header/footer 固定，是组件职责，不应让调用方写布局。
3. **form 是业务边界，组件不替它写**——但组件必须让 form 当 children 原样传入而不承担布局职责。
4. **Radix + Motion 组合**：`forceMount` + `AnimatePresence` 包裹，Motion 接管进出动画。项目已装 `motion@12`，已在 tilted-card/MusicPlayer/Hero/Header 使用。

## 目标

做一个**真正吸收布局复杂度**的 `Dialog` 组件（仿 `DataTable` 的封装思路），调用方只关心 title/字段/footer，不再写任何布局 class 或多层嵌套。

## 已确认的关键决策

| 决策点 | 选择 |
|--------|------|
| 理想形态 | 单组件吃掉布局，form 当 children 传 |
| footer submit 关联 | **`form={id}` HTML 原生属性**关联到 form（footer 在 form 外、按钮照样提交） |
| 动画 | **motion 接管**（AnimatePresence + forceMount），替换 Radix data-state CSS 动画 |
| 复杂场景逃生 | `footer={null}` + `unstyled` 自定义 children |

## 组件设计：`Dialog`（单组件，prop-driven + 逃生口）

### API

```ts
interface DialogProps {
  /** 受控开关 */
  open: boolean;
  onOpenChange: (open: boolean) => void;

  // —— 标准内容（简单/中等场景）——
  /** 标题（可传字符串或自定义节点）。复杂场景可省略，自行在 children 渲染 */
  title?: ReactNode;
  /** 副标题/说明 */
  description?: ReactNode;
  /** 中间内容（自动可滚）。逃生场景可放任意自定义布局 */
  children?: ReactNode;

  // —— 操作区 ——
  /**
   * 底部操作区。固定在底部、不随内容滚。
   * - 标准：传按钮（submit 按钮用 form={id} 关联到 children 里的 form）。
   * - 无底部：传 null（复杂场景如 Tabs/lightbox）。
   */
  footer?: ReactNode | null;

  // —— 外观 ——
  /** 尺寸档位，默认 md */
  size?: "sm" | "md" | "lg" | "xl";
  /** 右上角关闭按钮，默认 true */
  showCloseButton?: boolean;
  /**
   * 无样式逃生口：去掉 padding/border/bg/gap，children 完全自管。
   * 给 MediaLightbox 这种 lightbox 场景用。
   */
  unstyled?: boolean;

  // —— Radix 透传（逃生用）——
  modal?: boolean;
  onEscapeKeyDown?: (e: KeyboardEvent) => void;
  onInteractOutside?: (e: Event) => void;
}
```

### 内部结构（调用方完全不可见）

```
<RadixDialog.Root open onOpenChange modal>
  <AnimatePresence>                         ← motion 接管进出
    {open && (
      <RadixDialog.Portal forceMount>
        <motion.overlay>                    ← 渐入渐出遮罩
        <motion.content                     ← 缩放+渐入内容
                 flex flex-col max-h-[85vh]>
          <header shrink-0 px-6 pt-6>       ← 固定标题区
            {title}{description}
            {showCloseButton && <CloseButton/>}
          </header>
          {!unstyled ? (
            <main flex-1 min-h-0 overflow-y-auto px-6 py-4>  ← 唯一可滚区
              {children}
            </main>
          ) : children}                      ← unstyled 时 children 自管布局
          {footer && <footer shrink-0 border-t px-6 py-4>}   ← 固定操作区
        </motion.content>
      </RadixDialog.Portal>
    )}
  </AnimatePresence>
</RadixDialog.Root>
```

**动画**（motion）：overlay 用 `opacity` 渐变；content 用 `opacity + scale(0.95→1)`，`AnimatePresence` 的 `mode="wait"` 或默认同步均可，进出各 ~150-200ms（与原 duration-200 对齐）。

### 调用方写法（3 种典型场景）

**1. 表单 dialog（占多数）—— form 当 children，footer 用 form={id}**

```tsx
<Dialog
  open={open}
  onOpenChange={onOpenChange}
  title="创建角色"
  description="创建新的系统角色"
  size="sm"
  footer={
    <>
      <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>取消</Button>
      <Button type="submit" form="role-form">创建</Button>
    </>
  }
>
  <form id="role-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
    {/* 只有字段，无任何布局 class */}
  </form>
</Dialog>
```

**2. 确认框（ConfirmDialog）**

```tsx
<Dialog
  open={open} onOpenChange={onOpenChange}
  title={title} description={description}
  size="sm" showCloseButton={false}
  footer={
    <>
      <Button variant="outline" onClick={close}>{cancelLabel}</Button>
      <Button variant="destructive" onClick={onConfirm}>{confirmLabel}</Button>
    </>
  }
/>
```

**3. 复杂场景（MediaLightbox / EmojiManage）—— footer={null} + 自定义 children**

```tsx
<Dialog open onOpenChange size="xl" footer={null} unstyled showCloseButton
        onEscapeKeyDown={...} onInteractOutside={...}>
  {/* lightbox: 自己拼切换栏 + 预览区，无 padding/无 border */}
</Dialog>
```

## 16 个现有 dialog 的迁移映射

| Dialog | 形态 | 迁移要点 |
|--------|------|----------|
| ConfirmDialog | 简单 | title/description/footer，showCloseButton=false |
| CreateRoleDialog / EditRoleDialog | 表单 | form={id}，size=sm |
| CreateUserDialog / EditUserDialog | 表单 | form={id}，size=md |
| TagDialog | 表单 | form={id}，size=sm |
| CreatePermissionDialog | 表单 | form={id}，size=sm |
| AnnouncementSheet | 表单 | form={id}，size=md（长内容，验证滚动） |
| EditMediaDialog | 表单 | form={id}，size=sm |
| EmojiGroupFormDialog / EmojiEditDialog | 表单 | form={id}，size=md |
| LoginDialog | 表单 | form={id}，size=sm |
| RolePermissionsDialog | 中等 | footer 固定，权限树放 children 滚，size=lg |
| MediaCoverDialog | 中等 | footer={null}（FramePicker 自带按钮），size=lg |
| admin.media 上传 | 中等 | footer={null}（Uploader 自带按钮），size=md |
| EmojiManageDialog | 复杂 | footer={null}，children 放 Tabs+按钮，size=xl（验证 Tabs 滚动 + 嵌套 dialog 防穿透） |
| MediaLightbox | 复杂 | unstyled + footer={null}，size=自定义（验证 lightbox 逃生口） |

## 文件结构

```
web/src/shared/ui/dialog/
├── index.ts              # 导出 Dialog（新主组件）+ 保留 DialogXxx 兼容导出
├── Dialog.tsx            # ★ 主组件（吃掉布局 + motion 动画 + 三段式滚动）
├── dialog-primitives.tsx # 原 dialog.tsx 内容迁入（Radix 原语，作为 Dialog 底座 + 兼容旧导出）
└── constants.ts          # size 档位映射
```

> 原 `shared/ui/dialog.tsx` 内容迁到 `shared/ui/dialog/dialog-primitives.tsx`，`shared/ui/dialog.tsx` 改为 re-export 新 `Dialog`（或保留旧导出别名，避免破坏未迁移处）。新组件文件名直接叫 `dialog`（覆盖 shadcn 原位置），调用方 `import { Dialog } from "@shared/ui/dialog"` 不变。

## 提交计划（分 4 个 commit）

1. **`feat(ui): 重构统一 Dialog 组件（motion 动画 + 三段式滚动）`** —— 新建 `Dialog` 主组件 + constants，保留旧原语兼容。零业务改动。
2. **`refactor: 迁移表单类 dialog 到新 Dialog`** —— ConfirmDialog + 8 个表单 dialog（roles/users/tags/permissions/announcements/media-edit/emojis-form/login）。
3. **`refactor: 迁移中等复杂度 dialog`** —— RolePermissionsDialog（长内容滚动）+ MediaCoverDialog + admin.media 上传（footer={null}）。
4. **`refactor: 迁移复杂 dialog`** —— EmojiManageDialog（Tabs+嵌套防穿透）+ MediaLightbox（lightbox 逃生口）。

## 验证

- 每个 commit：`tsc --noEmit` + `biome check`（改动文件）通过。
- 视觉逐个核对：
  - 所有 dialog 进出动画一致（motion scale+fade）。
  - 长内容（Announcement/Permission/RolePermissions）仅中间滚，header/footer 固定。
  - 表单 footer 的 submit 按钮（form={id}）能正常触发表单提交。
  - MediaLightbox 仍是透明无边框；EmojiManage 的 Tabs 滚动 + 嵌套 dialog 防穿透未破。

## 不做

- 不动 DataTable / Tooltip 等其它共享组件。
- 不引入新依赖（motion 已有）。
- 不改后端。
