# 前端代码规范

## Tailwind CSS 规范

### 使用标准间距类名，避免任意值

❌ **错误示例：**
```tsx
// 使用任意值（方括号语法）
className="after:right-[-6px] after:w-[18px]"
className="p-[24px] m-[32px]"
className="text-[14px] leading-[20px]"
```

✅ **正确示例：**
```tsx
// 使用 Tailwind 标准间距类名
className="after:-right-1.5 after:w-4.5"
className="p-6 m-8"
className="text-sm leading-5"
```

**原因：**
1. 标准类名可以被 Tailwind 优化和复用
2. 避免生成冗余的 CSS
3. 保持代码一致性
4. 更易于维护和重构

**Tailwind 间距对照表：**
- `0.5` = 2px (0.125rem)
- `1` = 4px (0.25rem)
- `1.5` = 6px (0.375rem)
- `2` = 8px (0.5rem)
- `2.5` = 10px (0.625rem)
- `3` = 12px (0.75rem)
- `3.5` = 14px (0.875rem)
- `4` = 16px (1rem)
- `4.5` = 18px (1.125rem)
- `5` = 20px (1.25rem)
- `6` = 24px (1.5rem)
- `8` = 32px (2rem)
- `10` = 40px (2.5rem)
- `12` = 48px (3rem)

**何时可以使用任意值：**
- 特殊设计需求（如品牌色：`bg-[#1DA1F2]`）
- 非标准间距（如 `w-[73px]`，确实无法用标准值表达）
- CSS 变量（如 `bg-[var(--custom-color)]`）

---

## React 组件规范

### 使用箭头函数定义组件内部函数

❌ **错误示例：**
```tsx
export function MyComponent() {
  function handleClick() {
    // ...
  }
  
  return <button onClick={handleClick}>Click</button>;
}
```

✅ **正确示例：**
```tsx
export function MyComponent() {
  const handleClick = () => {
    // ...
  };
  
  return <button onClick={handleClick}>Click</button>;
}
```

**原因：**
1. 符合现代 React 最佳实践
2. 避免 `this` 绑定问题
3. 与 hooks 的使用方式保持一致
4. 更清晰的作用域表达

---

## 目录结构规范

### Feature-Sliced Design 架构

按功能模块和文件类型组织代码：

```
features/
└── feature-name/
    ├── api/          # API 调用
    ├── model/        # 状态管理和业务逻辑
    └── ui/           # UI 组件
        ├── component-name/
        │   ├── components/  # 子组件
        │   ├── hooks/       # 自定义 hooks
        │   ├── utils/       # 工具函数
        │   ├── types/       # 类型定义
        │   ├── styles/      # 样式文件
        │   ├── __tests__/   # 测试文件
        │   └── index.ts     # 公共 API 导出
        └── ...
```

**优势：**
- 清晰的关注点分离
- 更易维护和扩展
- 通过 index.ts 统一导出，对外接口简洁
- 符合 2026 年推荐的 React 项目架构模式

---

## 更新日志

- 2024-06-27: 初始版本，添加 Tailwind CSS 和 React 组件规范
