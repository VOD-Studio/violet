# 项目路线图由管理员手工维护，不从 GitHub 派生

项目路线图的条目、阶段与顺序由管理员在站内维护，不从 GitHub Issues、Projects 或 milestone 读取，也不由 webhook 驱动。这与更新日志「数据源是 GitHub Releases、零手工维护」的取向相反：路线图条目是功能点粒度，issue 通常过细；本仓库约定不使用流程性 label，阶段没有可靠的 GitHub 来源；阶段、完成日期、交付版本与条目关系都是站内概念；派生还需新增 webhook 端点与签名校验。

代价是进度需要人工同步。条目带关联链接，数据结构没有堵死将来追加 MCP 写入或 GitHub 同步，二者列入后续规划。

相关决策：[ADR-0022](0022-roadmap-typed-relation-graph.md)、[ADR-0023](0023-roadmap-canvas-drag-controller.md)；术语见 `CONTEXT.md`「项目路线图」。
