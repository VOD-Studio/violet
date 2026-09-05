---
version: 1
slug: "web-src-routes-index-tsx"
primary_target: "web/src/routes/index.tsx"
related_targets: []
---

# Violet 首页

- Scope: `/` 首页内容区与页脚；现有 Header、Header 导航与移动端 Header 明确不在本轮范围内。
- Audience: 首次与回访的中文读者；先认识站点主人，再自然进入最近文章与站内路径。
- Job: 用克制、有人味的个人主页说明「谁在这里、最近写了什么、还能去哪里」。
- Action: 无营销 CTA；主要继续动作是打开最近发布，其次浏览文章、笔记、时间归档与社区内容。
- Proof: 公开设置、真实发布时间、文章、笔记、推文、图集、系列与生效公告；数据缺失时收拢版面，不编造内容。
- Constraints: 中文优先，SSR 可见，明暗双主题，键盘/触摸/减弱动效完整；匿名首页不受失效登录提示阻断。头像只使用站点配置或已配置 GitHub 用户名对应的公开头像，并以灰阶呈现；两者都不可用时收拢为单栏，不伪造占位图。界面不使用紫色。

## Direction contract

THESIS: 使用克制的个人站结构与自然弹性动效；拒绝简报、刊物、瑞士编号目录、巨型刊头和仪表盘。
OWN-WORLD: 近白或柔和炭黑的中性底色、单一暖珊瑚强调色、轻边界和低对比表面；个人介绍、真实头像、最近动态、细线时间轴与小幅 spring 动效构成组件语言，不以紫色呼应站名。
STORY: 首屏先让读者认识站点主人，底部以一行最近发布承接内容；随后列出文章和动态，再用时间轴与风向标式导航开放全站。
FIRST VIEWPORT: 保持仓库现有 Header 不变；其下是双栏个人介绍，左侧只保留站名、作者、真实简介与可用社交入口，右侧显示真实头像。没有头像时自动成为居中单栏。最近发布收成底部单行，不使用巨型字母占位、内容营销卡、长分割构图或紫色。
FORM: 双栏身份 Hero、recent activity、timeline 与 windsock 构成信息架构；Header 保持现状，所有内容来自 Violet。
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
