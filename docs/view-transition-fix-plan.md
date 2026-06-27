# 主题切换 View Transition 问题修复计划

**模型编号**: Claude Opus 4.8 (claude-opus-4-8)  
**创建时间**: 2024-06-27  
**问题分类**: View Transitions API 集成问题

---

## 问题描述

### 现象
当用户点击全局的暗色/亮色模式切换按钮时：
- **期望行为**: 圆圈扩散动画，圆圈经过的区域才逐渐变成新主题颜色
- **实际行为**: 页面上的某些元素（如阴影）直接变色，不等待圆圈动画

### 根本原因
View Transitions API 的工作机制：
1. 调用 `document.startViewTransition(() => setTheme(targetTheme))` 时
2. 浏览器会捕获切换前的快照（old）和切换后的快照（new）
3. 在两个快照之间做 crossfade 动画

**问题在于**: CSS 变量（如 `--sticky-shadow-color`）在 `setTheme()` 执行时立即变化，导致：
- 使用这些变量的元素在新快照中已经是新颜色
- View Transition 无法捕获到渐变过程
- 结果就是这些元素"直接变色"

---

## 受影响的范围

### 1. 固定列阴影
**文件**: `web/src/features/admin-shared/ui/data-table/styles/sticky-shadow.css`  
**问题**: `--sticky-shadow-color` 变量立即变化

### 2. 全局其他使用 CSS 变量的元素
需要排查项目中所有使用以下模式的代码：
- CSS 变量定义在 `:root` / `.dark` 下
- 这些变量用于颜色、背景、边框等视觉属性
- 没有添加 `view-transition-name`

---

## 解决方案

### 方案 A: 为每个元素添加 `view-transition-name`（推荐）

**原理**: 给需要平滑过渡的元素分配唯一的 `view-transition-name`，让它们独立参与 View Transition。

**优点**:
- 精确控制哪些元素参与过渡
- 符合 View Transitions API 的设计理念
- 可以为不同元素设置不同的过渡效果

**缺点**:
- 需要为每个相关元素添加 CSS
- `view-transition-name` 必须在页面中唯一

**实施步骤**:
1. 审计项目中所有使用 CSS 变量且受主题切换影响的元素
2. 为每个元素/组件添加唯一的 `view-transition-name`
3. 测试验证圆圈扩散效果

**示例**:
```css
/* 固定列阴影 */
.sticky-shadow-left::after {
  view-transition-name: sticky-shadow-left;
}

/* 其他元素 */
.some-component {
  view-transition-name: some-component;
}
```

**注意**: 如果页面上有多个相同的阴影（多个表格），需要动态生成唯一名称或使用其他方案。

---

### 方案 B: 使用 `view-transition-class`（CSS 隔离）

**原理**: 将所有需要平滑过渡的元素放到一个容器中，只给容器添加 `view-transition-name`。

**优点**:
- 减少需要命名的元素数量
- 适合整体布局的过渡

**缺点**:
- 粒度较粗，可能影响性能
- 不适合分散在页面各处的元素

---

### 方案 C: 延迟 CSS 变量更新（Hack 方案，不推荐）

**原理**: 在 `theme-transition.tsx` 中延迟更新 CSS 变量，等待 View Transition 动画完成。

**缺点**:
- Hack 性质，违反 API 设计
- 可能出现闪烁
- 难以维护

---

## 推荐实施方案

### 阶段 1: 快速修复固定列阴影（当前问题）

```css
/* sticky-shadow.css */
.sticky-shadow-left::after {
  view-transition-name: sticky-shadow-left;
}

.sticky-shadow-right::before {
  view-transition-name: sticky-shadow-right;
}
```

**风险**: 如果页面上有多个表格，会导致 `view-transition-name` 冲突。

**解决冲突的方法**:
- 为每个 DataTable 实例生成唯一 ID
- 使用 CSS 变量动态注入 name：`view-transition-name: var(--vt-name-left);`
- 或者改用方案 D

---

### 阶段 2: 全局审计和修复

1. **排查所有受影响的组件**
   ```bash
   grep -r "var(--" web/src --include="*.css" --include="*.tsx"
   ```

2. **分类处理**:
   - 全局通用元素（如 body、main）→ 添加固定的 `view-transition-name`
   - 可重复元素（如列表项）→ 使用动态 name 或移除 CSS 变量依赖
   - 装饰性元素（如阴影）→ 评估是否必须参与过渡

3. **测试验证**:
   - 多页面测试
   - 多实例测试（多个表格）
   - 不同浏览器测试

---

### 方案 D: 混合方案（最优解）

**针对固定列阴影的特殊处理**:

由于固定列阴影是伪元素（`::after`、`::before`），且可能在页面上有多个实例，我们可以：

1. **不使用 CSS 变量**，直接根据主题 class 设置颜色
2. **依赖 View Transition 的默认行为**，让 DOM 树的变化自动触发过渡

```css
/* 移除 CSS 变量 */
.sticky-shadow-left::after {
  box-shadow: inset 10px 0 8px -8px rgba(0, 0, 0, 0.15);
}

.dark .sticky-shadow-left::after {
  box-shadow: inset 10px 0 8px -8px rgba(0, 0, 0, 0.4);
}

/* 不需要 view-transition-name，让 View Transition 自动处理 */
```

**原理**: 
- `.dark` class 的添加会改变 DOM 树
- View Transition 会捕获到这个变化
- 自动在两个状态之间做 crossfade

**优点**:
- 简单，无需管理 unique names
- 适合可重复元素
- 符合 CSS 级联原则

**缺点**:
- 过渡效果是 crossfade，不是圆圈扩散
- 如果需要自定义过渡效果，仍需 `view-transition-name`

---

## 最终推荐方案

### 对于固定列阴影: **方案 D**
- 移除 CSS 变量
- 直接使用 `.dark` class 选择器
- 依赖 View Transition 的默认行为

### 对于全局其他元素: 
- **重要的、唯一的元素**: 方案 A（添加 `view-transition-name`）
- **可重复的、装饰性元素**: 方案 D（移除 CSS 变量）
- **整体布局**: 保持当前的 `view-transition-name: root` 实现

---

## 实施优先级

1. **P0 - 立即修复**: 固定列阴影（使用方案 D）
2. **P1 - 短期优化**: 审计全局 CSS 变量使用，识别其他受影响元素
3. **P2 - 长期规划**: 建立 View Transition 最佳实践文档，规范新组件开发

---

## 测试检查清单

- [ ] 暗→亮模式切换，圆圈动画流畅
- [ ] 亮→暗模式切换，圆圈动画流畅  
- [ ] 单个表格页面，阴影颜色随圆圈变化
- [ ] 多个表格页面，阴影颜色随圆圈变化
- [ ] 不支持 View Transitions 的浏览器降级正常
- [ ] 移动端触摸切换正常
- [ ] 无 JS 错误或警告

---

## 参考资料

- [View Transitions API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API)
- [Smooth theme transitions with View Transitions](https://developer.chrome.com/docs/web-platform/view-transitions/)
- 当前实现: `web/src/shared/ui/theme-transition.tsx`
