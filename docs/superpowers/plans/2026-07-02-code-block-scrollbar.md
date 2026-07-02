# 代码块滚动条美化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为前台文章详情页代码块添加细窄圆角暗色自定义滚动条。

**Architecture:** 在全局 `styles.css` 定义可复用工具类 `.code-block-scrollbar`，覆盖 WebKit 与 Firefox；在 `CodeBlock.tsx` 的两个滚动容器上应用该类。

**Tech Stack:** React, Tailwind CSS v4, Vite

## Global Constraints

- 不使用 `as` 类型断言。
- 样式与组件代码需符合现有代码风格。
- `pnpm test` 与 `pnpm typecheck` 必须通过。
- 不改动 `web/vite.config.ts`。

---

### Task 1: 新增 `.code-block-scrollbar` 工具类

**Files:**
- Modify: `web/src/styles.css`

**Interfaces:**
- Produces: `.code-block-scrollbar` CSS class for horizontal/vertical scrollbars.

- [ ] **Step 1: 打开 `web/src/styles.css`**

- [ ] **Step 2: 在文件末尾追加工具类**

```css
/* 代码块滚动条：细窄圆角暗色 */
.code-block-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}

.code-block-scrollbar::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}

.code-block-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}

.code-block-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 9999px;
}

.code-block-scrollbar:hover::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.25);
}
```

- [ ] **Step 3: 保存文件**

### Task 2: 在 CodeBlock 滚动容器上应用工具类

**Files:**
- Modify: `web/src/shared/ui/markdown-preview/components/CodeBlock.tsx:99-109`

**Interfaces:**
- Consumes: `.code-block-scrollbar` from `styles.css`.

- [ ] **Step 1: 给 shiki-code div 增加类名**

修改前：
```tsx
className="shiki-code overflow-x-auto px-4 py-3 text-sm leading-relaxed [&_pre]:!m-0 [&_pre]:!bg-transparent [&_pre]:!p-0 [&_code]:!font-mono [&_code]:!text-sm"
```

修改后：
```tsx
className="shiki-code code-block-scrollbar overflow-x-auto px-4 py-3 text-sm leading-relaxed [&_pre]:!m-0 [&_pre]:!bg-transparent [&_pre]:!p-0 [&_code]:!font-mono [&_code]:!text-sm"
```

- [ ] **Step 2: 给降级 pre 增加类名**

修改前：
```tsx
<pre className="overflow-x-auto px-4 py-3 text-sm leading-relaxed text-white/90">
```

修改后：
```tsx
<pre className="code-block-scrollbar overflow-x-auto px-4 py-3 text-sm leading-relaxed text-white/90">
```

- [ ] **Step 3: 保存文件**

### Task 3: 验证

**Files:**
- 无需修改。

- [ ] **Step 1: 跑类型检查**

Run: `pnpm typecheck`
Expected: `tsc --noEmit` 无错误。

- [ ] **Step 2: 跑全量测试**

Run: `pnpm test`
Expected: 10 files passed, 34 tests passed。

- [ ] **Step 3: 提交**

```bash
git add web/src/styles.css web/src/shared/ui/markdown-preview/components/CodeBlock.tsx
git commit -m 'feat(ui): 美化代码块滚动条

- styles.css 新增 .code-block-scrollbar 工具类
- CodeBlock 的高亮容器与降级 pre 应用新类，统一细窄圆角暗色滚动条'
```
