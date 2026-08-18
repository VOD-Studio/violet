---
name: frontend-conventions
description: Use when writing or placing frontend code — creating a util/hook/component, deciding its file location, extracting shared code across features, or writing TS/TSX doc comments (TSDoc format, what belongs in a header comment vs inline).
---

# 前端编码纪律

## 落笔前查重

写任何新 util / hook / 通用组件前,先搜同款,命中即复用:

1. shared 层(`lib/` / `ui/` 等,项目公共能力所在)。
2. 本 feature 已有文件。
3. 兄弟 feature——有近似实现而确实需要复用时,先把它上提到公共层(独立提交),再在新 feature 接入;两边各复制一份是最后选项。

新建前不存在同款才动笔;搜过但不确定算不算同款时,把候选列给用户。

## 文件落位

| 场景 | 落位 |
|---|---|
| 单 feature 私有工具 | feature 根的 `lib/` 或 `utils/`(与兄弟 feature 既有命名对齐,grep 确认) |
| 单 feature 私有 hook | feature 根的 `hooks/` |
| 复合组件的辅件 | 该组件目录内 `components/` `hooks/` `utils/` 子目录 |
| 跨 feature 复用 | 公共层;先上提(独立提交)再接入 |

- 组件目录建 `utils/` `hooks/` 子目录的门槛是「多文件复合体」;一两个文件平铺在组件旁,建了空目录结构就是堆砌。
- feature 私有内容禁止先放进公共层「备用」;公共化的触发条件是第二个消费方真实出现。

## TS 注释规范

导出符号用 TSDoc 标准形态:首行一句话说明用途,`@typeParam` / `param` / `returns` / `example` 标签,example 可运行:

```ts
/**
 * 服务端分页表格 Hook,管理分页状态并组装 pagination。
 *
 * @typeParam T - 列表项数据类型
 * @param useList - 模块的列表查询 Hook
 * @param baseQuery - 业务筛选参数,省略时查全部
 * @returns 查询结果 + pagination,供 DataTable 直接消费
 */
```

头注释禁写(判定:删掉后调用方损失信息吗?不损失即删):

- **动机叙述**:「本 hook 消除 7 个子页重复的样板」——为什么写它,属于 PR 描述。
- **历史论证**:「原单一全量 query 有竞态,已拆为 X」——演进过程,属于 commit/ADR。
- **被否决方案对比**:「IntersectionObserver 方案在边界会丢选中」——要写就压缩成一句「为什么不用 X」。
- **@param 复读签名**:类型与参数名已表达的不再用文字重述。

保留与提倡:

- **魔法值理由**:值旁一句为什么是这个数(行尾或行上)。
- **行内陷阱注释**:函数体内非显然的坑(为什么解构某个引用、为什么豁免某条 lint 依赖)——这是头注释该让位给它的部分。
- **编排契约**:签名看不出的数据流顺序(「读配置 → 回填 → 提交部分字段」),一行。

interface 字段只在非自解释时加行上注释;组件内部私有函数默认不注释,非显然时一句。
