---
status: accepted
---

# 设计稿 token 并入既有颜色生成，沿用旧变量名

设计稿「基础」给出 bg、sheet、sunk、fg、muted、rule、rule2、deco、accent、danger、ok 十一个语义色，它们不另建色板：ADR-0024 的“全部颜色由种子色算法生成并通过对比度门槛”继续有效。算法新增纸面、纸片、凹陷与强调字的生成规则；四季预设通过“旋钮”写入设计稿的取值，自定义主题取旋钮默认值，同样得到新材质。直接写死设计稿的手调值会让自定义主题拿不到新材质，也违背 ADR-0024 对手写色板的否决。

变量名沿用现有语义 token，只改接新色值，再新增设计稿独有的变量（rule2、半透纸片、纸片描边、软影与时长曲线等）。设计稿的 `muted`（文字色）与 `accent`（强调字）和现有同名变量（背景色）含义相反，不能按名字映射。对应关系：

| 设计稿 | 现有语义 token |
|---|---|
| bg | `background` |
| sheet | `card`、`popover` |
| sunk | `muted`、`secondary`、`accent` 的背景用法 |
| fg | `foreground` |
| muted | `muted-foreground` |
| rule | `edge-hairline`、`border` |
| rule2 | 无，新增 |
| deco | `decoration`、`progress` |
| accent | `link`、`ring`、`selected-foreground` |
| danger、ok | `destructive`、`success` |

全站改成设计稿命名要动 577 个文件，并同步 kanban、react-tweet 与 `@violet/ui` 的公开接口。本方案稳定后如有必要，再用 codemod 分批做。设计稿没有定义的警告色、分类色、图表色与选中色继续保留。

设计稿词汇里的“纸面”不作为标识符：颜色守门把含 `paper` 的类名与选择器视为旧黑名单，实现里使用 `background`、`card` 等现有名。
