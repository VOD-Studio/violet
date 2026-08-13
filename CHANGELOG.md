# Changelog

本项目所有重要变更记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本管理遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

v2.0.0 之前手工维护；v2.0.1 起由 [release-please](https://github.com/googleapis/release-please) 自动维护。分类由 `release-please-config.json` 的 `changelog-sections` 按 Conventional Commit type 归类。

## [2.8.4](https://github.com/VOD-Studio/violet/compare/v2.8.5...v2.8.4) (2026-08-13)


### 新增

* **about:** About 页重设计 + 更新日志（PRD-0009） ([#7](https://github.com/VOD-Studio/violet/issues/7)) ([b718fbe](https://github.com/VOD-Studio/violet/commit/b718fbec809103cec0564a4f06307d9f176a73c6))
* **admin-friend-links:** 友链后台审核管理页 ([d81308e](https://github.com/VOD-Studio/violet/commit/d81308e0c04a8019ccb3ffb9774c8e0371317fb8))
* **admin:** 操作日志列表与详情页支持 summary 展现 ([2177cc5](https://github.com/VOD-Studio/violet/commit/2177cc561bf281964d01c556ac6226c9653b73d8)), closes [#175](https://github.com/VOD-Studio/violet/issues/175)
* **announcement:** 公告创建/更新/删除事件（含 ID 回填） ([1f641dd](https://github.com/VOD-Studio/violet/commit/1f641dd307ac3b9b05ea01854bda6a3ba51d13b7))
* **api-token:** PAT 签发/吊销审计（凭据生命周期） ([378c437](https://github.com/VOD-Studio/violet/commit/378c437b044b41b9c7d8248b778807f2e848d4e7))
* **api:** 升级 Go 版本至 1.26.5 ([31331c6](https://github.com/VOD-Studio/violet/commit/31331c6e5f14bd7d4c7182673717afcd3d54e942))
* **api:** 添加开发环境 Dockerfile ([0a79edf](https://github.com/VOD-Studio/violet/commit/0a79edf80cb80ac658599120c294f7ff734c91ba))
* **audit:** Actor 增加 actor_type 区分真人与系统操作 ([5da1379](https://github.com/VOD-Studio/violet/commit/5da1379e50b1b333dbe0e07572f7acaff116c218))
* **audit:** append-only AuditEventPO + EventStore GORM 实现 ([b623e6f](https://github.com/VOD-Studio/violet/commit/b623e6f27d4da20cf4d18d5e23272856a8803226))
* **audit:** AuditEvent JSON 序列化 + 查询筛选（ListFiltered + Query 用例） ([e707bd3](https://github.com/VOD-Studio/violet/commit/e707bd340ba4ffbb506356d901b2e1b572fba929))
* **audit:** HTTP handler + /admin/logs 路由 + OpenAPI 重建 ([e7310e4](https://github.com/VOD-Studio/violet/commit/e7310e4d9db71e5ecbecd08d4edaa4a07440fa44))
* **audit:** mapEvent 升级为业务 Action 与人话摘要 ([b2a847b](https://github.com/VOD-Studio/violet/commit/b2a847b837197dd8fd9b75da1810d3d05664a856)), closes [#174](https://github.com/VOD-Studio/violet/issues/174)
* **audit:** useradmin 操作发布领域事件（特权操作审计闭环） ([6bc1155](https://github.com/VOD-Studio/violet/commit/6bc1155ad59f4195c1eacc510711d9a349b4087e))
* **audit:** 审计订阅者消费领域事件写入 audit_events ([0887583](https://github.com/VOD-Studio/violet/commit/088758341ae0d032e6c5fb5414e2407fd7aea774))
* **audit:** 操作日志 Action 业务化与人话摘要重构 ([048912e](https://github.com/VOD-Studio/violet/commit/048912e0595f35da9ce8d8993c2339288224054d))
* **audit:** 操作日志模块推倒重做——事件驱动审计基础设施 ([4e354c2](https://github.com/VOD-Studio/violet/commit/4e354c2c3a2a23b5469144b0727e008d98c75ffc))
* **audit:** 数据库迁移 064 drop audit_logs + 065 create audit_events ([240bc63](https://github.com/VOD-Studio/violet/commit/240bc63fb94cc2023865c5747fa276f59fc0afb6))
* **audit:** 结构化 AuditEvent + 受控 Action 枚举 ([5df5007](https://github.com/VOD-Studio/violet/commit/5df5007c2533781143976e0d4ed5cd67755f9aff))
* **audit:** 订阅域全部操作补入操作日志 ([af4420f](https://github.com/VOD-Studio/violet/commit/af4420f1ba85e63f43e44c82f6b06e4612b608cb))
* **audit:** 订阅者映射 auth 登录/登出/失败事件 ([53795f4](https://github.com/VOD-Studio/violet/commit/53795f48a060e19131476610d35c6fa23c97e88d))
* **audit:** 订阅者映射 comment/PAT/settings 事件 ([aade746](https://github.com/VOD-Studio/violet/commit/aade746848e5a6684d686c79b7f4d2248af15245))
* **audit:** 订阅者映射 post/role/announcement 事件 ([7ec661a](https://github.com/VOD-Studio/violet/commit/7ec661aafe6e90c1a6453780e0ae963858810df5))
* **audit:** 领域事件补全资源快照与 before/after（review [#58](https://github.com/VOD-Studio/violet/issues/58) 修复） ([4d60e4f](https://github.com/VOD-Studio/violet/commit/4d60e4f7c0f75bae5e03a1e0ce45dd4385419adc))
* **auth:** login/logout/verify 发布领域事件（审计接入） ([98298e7](https://github.com/VOD-Studio/violet/commit/98298e78109e9fb641b090646bae1ae915e92b08))
* **auth:** 登录支持用户名或邮箱 ([7c293d8](https://github.com/VOD-Studio/violet/commit/7c293d8c5b0d10d85aea3efa82d285784229326d))
* **auth:** 登录表单改为账号输入 ([ef68428](https://github.com/VOD-Studio/violet/commit/ef68428d7144e6e3742a8d53a124f3a16c8ed489))
* **command-palette:** 命令面板整合文章搜索并去重触发入口 ([c7d3097](https://github.com/VOD-Studio/violet/commit/c7d3097d4f021cceca3c92b5e658ccedbe8d40b2))
* **command-palette:** 搜索结果增加加载骨架与空状态 ([cc15980](https://github.com/VOD-Studio/violet/commit/cc15980c51e1892f9cdfd3c95f43a77bb2fb8376))
* **comment:** 评论审核审计（Approve/Spam/Delete + 批量） ([9c4579d](https://github.com/VOD-Studio/violet/commit/9c4579d196b203acd7b492ae574fea87708b5eed))
* **deploy:** 支持仅启动前后端容器并连接宿主机数据库 ([b7d1b62](https://github.com/VOD-Studio/violet/commit/b7d1b624122decb1af63ffae86867a9ba6890bdd))
* **deploy:** 添加仅启动 Redis 与前后端容器的 Makefile 指令 ([dfe16a0](https://github.com/VOD-Studio/violet/commit/dfe16a0c97961ee0f6f2fd5601406da0faea11d2))
* **deploy:** 添加本地 Docker 开发环境配置与 Makefile 指令 ([a3a6cef](https://github.com/VOD-Studio/violet/commit/a3a6cefe2df098779ecccc82358745f3ad2de765))
* **diagram:** 全屏模态查看（T3 [#69](https://github.com/VOD-Studio/violet/issues/69)） ([d5113c6](https://github.com/VOD-Studio/violet/commit/d5113c67c3ebb53f48d92ed8f0b2f463e69255a2))
* **diagram:** 加载占位与失败降级重设计 ([781553c](https://github.com/VOD-Studio/violet/commit/781553c5bc3728ddfa76b3fece554a695a061aa9))
* **diagram:** 图块键盘可访问性与 aria-label 语义化（T4 [#71](https://github.com/VOD-Studio/violet/issues/71)） ([f4af833](https://github.com/VOD-Studio/violet/commit/f4af8334b4f26bf6518c5d64389f0f9f549a440a))
* **diagram:** 移动端双指捏合缩放（T2 [#68](https://github.com/VOD-Studio/violet/issues/68)） ([e87def4](https://github.com/VOD-Studio/violet/commit/e87def423feae5f3b5bc5e006d114521bdd6710a))
* **diagram:** 阅读端图块导出 SVG / PNG（T1 [#67](https://github.com/VOD-Studio/violet/issues/67)） ([5918d6f](https://github.com/VOD-Studio/violet/commit/5918d6fc3df93fdce3769caf0289efcf55ab5ed1))
* **domain:** audit 新增 summary 字段与业务 Action 枚举 ([5c2ac25](https://github.com/VOD-Studio/violet/commit/5c2ac25bc71bb3b92f1ebbc35e8f475e8cc71981)), closes [#173](https://github.com/VOD-Studio/violet/issues/173)
* **domain:** 拆分用户名与显示名并收紧 username 规则 ([96e4efa](https://github.com/VOD-Studio/violet/commit/96e4efa9b65f862f823d711e35ab524ed48d56a9))
* **editor:** 源码模式改用 CodeMirror 6 替换滚动镜像 ([309e901](https://github.com/VOD-Studio/violet/commit/309e90111d65d72a8f9cd3c4b991c6bd93cf10fb))
* **eventbus:** EventBus 加 Subscribe 机制，激活领域事件分发 ([268977f](https://github.com/VOD-Studio/violet/commit/268977ff39ab7ab8ee3d6d8a8fae178471e207cb))
* **feed:** gofeed 实现 + DI 接线 FetchOne 依赖 ([ac88366](https://github.com/VOD-Studio/violet/commit/ac88366cdd2ff509f6b0d44193d02f5e8a7775cb))
* **friend-links:** 前台友链页与申请弹窗 ([d56411b](https://github.com/VOD-Studio/violet/commit/d56411bc88c3662169e7723b6155148f145e884c))
* **friendlink:** 友链后端与审核流落地 ([10a695b](https://github.com/VOD-Studio/violet/commit/10a695b38a680d0934b36749c75dd3219e00183e))
* **friendlink:** 友链模块（申请制全栈） ([7c1a2e5](https://github.com/VOD-Studio/violet/commit/7c1a2e5edf3c0b7e45b536b7b435048b56117fd7))
* **friends-lab:** 友链页视觉原型实验室 ([3df6a6d](https://github.com/VOD-Studio/violet/commit/3df6a6df1815b11444c0b183b6c934c2dedac20e))
* **job:** 订阅定时抓取调度器 + 失败状态机（T8） ([9ee91fc](https://github.com/VOD-Studio/violet/commit/9ee91fc0358599e7c3546590b489945837ee7446))
* MCP 公开只读通道(Resources + Prompts) ([143c938](https://github.com/VOD-Studio/violet/commit/143c938a421dd6b58885089f3a68bda9615aa5d0))
* MCP 批注反馈检索回路(violet-comments) ([#76](https://github.com/VOD-Studio/violet/issues/76)) ([5d570a0](https://github.com/VOD-Studio/violet/commit/5d570a00afc2a68aadf86b04adc2efe9f7cd8599))
* MCP 标签工具与订阅立即拉取及操作日志 ([6929b3a](https://github.com/VOD-Studio/violet/commit/6929b3a86c914a6bfbc50bdfd50abbbc159a704e))
* **mcp:** admin/mcp 客户端接入界面重设计 ([147e3a9](https://github.com/VOD-Studio/violet/commit/147e3a9ec2d58513343135ebbcd55dca5dfd6594))
* **mcp:** admin/mcp 页接入新版客户端接入区 ([a8a5b08](https://github.com/VOD-Studio/violet/commit/a8a5b08b7168722cb130fb89866db3fdc13ec129))
* **mcp:** scrape_url tool 抓取外站文章返回结构化数据 ([c8671e9](https://github.com/VOD-Studio/violet/commit/c8671e9d41454dff16c8c8434ea7f3fbe99fedf3))
* **mcp:** 创建令牌对话框 scope 按 server 分组 ([687b3f8](https://github.com/VOD-Studio/violet/commit/687b3f8a364f03e7f3b08d075d8f1b4a7b2377b8))
* **mcp:** 封装客户端接入面板 ClientConnectPanel ([d1e74b9](https://github.com/VOD-Studio/violet/commit/d1e74b91cb668f50fc27d2298be6473cabc6384d))
* **mcp:** 接入 7 个订阅 tool + subscriptions:read/write scope ([cbbbf26](https://github.com/VOD-Studio/violet/commit/cbbbf26e36b1a3ebd70e18fecb1baae3c38c6384))
* **mcp:** 文章 server 新增三个检索 tool ([865d142](https://github.com/VOD-Studio/violet/commit/865d142769b7fa68b07dbc837aae7f4fbfce365c)), closes [#58](https://github.com/VOD-Studio/violet/issues/58)
* **mcp:** 文章 server 新增三个检索 tool（PRD-0006 S1） ([af5f11e](https://github.com/VOD-Studio/violet/commit/af5f11e16aaef6fc3740b49535c3da1382fa9970))
* **mcp:** 新增 create_tag 与 list_tags tool ([8f5307c](https://github.com/VOD-Studio/violet/commit/8f5307c1f42f05b9724e860bccceb11171d78f66))
* **mcp:** 新增 MCP 客户端接入规格与配置生成器 ([fcf3598](https://github.com/VOD-Studio/violet/commit/fcf35985e1ec210bd820c4595c1b3b647e46b517))
* **mcp:** 新增 violet-reader 匿名公开 server ([da8f5c1](https://github.com/VOD-Studio/violet/commit/da8f5c1a3c1760ded71f6b928f6b2915ecce2243))
* **mcp:** 新增 writing_style 与 polish_draft Prompts ([e5e6bbe](https://github.com/VOD-Studio/violet/commit/e5e6bbe581cb865fdc8237e6143b72ce99a3a964))
* **mcp:** 有效期日历禁选过去日期 ([958d4be](https://github.com/VOD-Studio/violet/commit/958d4be7841cc817fff43b28d9230d546b961242))
* **nav-menu:** 收起态分组图标支持飞出菜单并指示子路由激活 ([f8c47a7](https://github.com/VOD-Studio/violet/commit/f8c47a710cb324f768732eee4471e4d6271a845a))
* **post:** fetchHTML 接入 SSRF 防护 ([2c08513](https://github.com/VOD-Studio/violet/commit/2c08513d4a162e903d42c3a156557688b6ec4ae2)), closes [#77](https://github.com/VOD-Studio/violet/issues/77)
* **post:** ImportURL 扩展返回 Markdown 供 MCP scrape_url 使用 ([5ae909e](https://github.com/VOD-Studio/violet/commit/5ae909eb13d61462f3f7c6063f717038f311103b)), closes [#78](https://github.com/VOD-Studio/violet/issues/78)
* **post:** Service 新增 GetPublishedBySlug 状态过滤 ([cd9a7de](https://github.com/VOD-Studio/violet/commit/cd9a7de5d5366d249e297b831d1cee37321f64db))
* **post:** Service 新增文章检索编排与 snippet 生成 ([15f50ab](https://github.com/VOD-Studio/violet/commit/15f50abc571949a611ac3b8735fe5f401511d343)), closes [#57](https://github.com/VOD-Studio/violet/issues/57)
* **posts:** 文章管理批量操作搜索与标签筛选 ([cabb804](https://github.com/VOD-Studio/violet/commit/cabb80402a2f6d3504c2fc71e9fa13c50d1728a7))
* **post:** 文章仓储新增 ILIKE 语义检索方法 ([cebb191](https://github.com/VOD-Studio/violet/commit/cebb191bdfd10a901374f722fa7312d947bad953)), closes [#55](https://github.com/VOD-Studio/violet/issues/55)
* **post:** 文章批量操作接口与列表搜索 ([c44ca8d](https://github.com/VOD-Studio/violet/commit/c44ca8dd15eeeb7137ce9f660d3be5e6b614684a))
* **post:** 文章状态变更事件（发布/归档/回退草稿） ([bfc1d2d](https://github.com/VOD-Studio/violet/commit/bfc1d2d39283251469c07eaf5db36246f9138393))
* **post:** 新增 Markdown 公式与代码块提取器 ([573b6a9](https://github.com/VOD-Studio/violet/commit/573b6a9b7553095d564c484e4660f135f03b4e62)), closes [#56](https://github.com/VOD-Studio/violet/issues/56)
* **post:** 新增前台公开搜索接口 ([3adb781](https://github.com/VOD-Studio/violet/commit/3adb7814066702fe20f1d019a9219b552e8607a6))
* **role:** 角色更新/删除事件（含创建事件 ID 修复） ([1968f0e](https://github.com/VOD-Studio/violet/commit/1968f0e653012b3c132c42e73ec99f479a9ea35a))
* **settings:** 站点配置变更审计（SettingsUpdated 事件） ([b002297](https://github.com/VOD-Studio/violet/commit/b0022970b1fd533942d0425d9a44cbac1c5a4815))
* **ssrf:** 响应体大小限制防 OOM ([c1c6b16](https://github.com/VOD-Studio/violet/commit/c1c6b16aa0f508536ca74a502f58b81342246747))
* **ssrf:** 新增 SSRF 防护公共组件 ([c9b3205](https://github.com/VOD-Studio/violet/commit/c9b320599be2791f75ddbc279536a17c4b834dfb))
* **subscription:** FeedError 结构化 + GoFeedParser 拿 HTTP 状态码 + FindDue ([f67358e](https://github.com/VOD-Studio/violet/commit/f67358e9e716bbf04bc514f210a18d45043f55b8))
* **subscription:** FetchOne 抓取编排 + subscription_entries 去重 ([12dff50](https://github.com/VOD-Studio/violet/commit/12dff50d3d4f42717781c1969df1e5e8c9b7aaa8))
* **subscriptions:** 后台侧边栏新增订阅管理入口 ([20738bf](https://github.com/VOD-Studio/violet/commit/20738bf0003f08a0a75b9ad466b8e854d2f5afc9))
* **subscription:** 后台订阅管理 HTTP handler + admin 路由 + ListAll ([e270d2d](https://github.com/VOD-Studio/violet/commit/e270d2dfec188239f1cf775f99d2b723238e7615))
* **subscription:** 新增立即拉取端点 ([be6dcd1](https://github.com/VOD-Studio/violet/commit/be6dcd1396c272c8b020f7bb0d87075490bfdf74))
* **subscription:** 订阅源领域 + 持久化 + 应用层 CRUD ([8c73226](https://github.com/VOD-Studio/violet/commit/8c73226981cc9f6cd27e80f241166ce8f87dc91c))
* **tweets:** 推文功能完整实现 ([1dcfc1b](https://github.com/VOD-Studio/violet/commit/1dcfc1b56faa43a39472c1fce259bb4e745db914))
* **tweets:** 推文评论输入与展示接入表情图片 ([b8ccb40](https://github.com/VOD-Studio/violet/commit/b8ccb40eea298dd489182a95fb89fa7b53ce1e0a))
* **tweets:** 评论展示接入 replies_count 驱动回复区显隐 ([688bd34](https://github.com/VOD-Studio/violet/commit/688bd3417b06b7285aec426c10eaaaef9b0dc4ea))
* **tweet:** 推文全局时间线页与发布框 ([40f5112](https://github.com/VOD-Studio/violet/commit/40f5112f8c93061ace81ba5e128021149ed6adc8)), closes [#102](https://github.com/VOD-Studio/violet/issues/102)
* **tweet:** 推文点赞前端交互与乐观更新 ([04caabf](https://github.com/VOD-Studio/violet/commit/04caabf7082182ed41f033281fe411b1022f5255))
* **tweet:** 推文点赞后端领域、存储与 API ([0127c75](https://github.com/VOD-Studio/violet/commit/0127c750182aaf31241c03373681192a58c7f94b))
* **tweet:** 推文评论后端领域、存储与 API ([5207d62](https://github.com/VOD-Studio/violet/commit/5207d622a35844953bc76589a71a5dcfa6eb4a84))
* **tweet:** 推文评论支持表情与图片 ([9b98b47](https://github.com/VOD-Studio/violet/commit/9b98b47ea2bad6a97dfd9d29982a6f7c018fbffe))
* **tweet:** 推文详情页与删除交互 ([258c542](https://github.com/VOD-Studio/violet/commit/258c5421c00e3ccc810c58c615b7e9d5bef60f09))
* **tweet:** 推文详情页评论区与评论计数 ([89b8581](https://github.com/VOD-Studio/violet/commit/89b85813736907601a8bf94d2b0ab0af8de83e57))
* **tweet:** 推文领域与 CRUD API ([e473abd](https://github.com/VOD-Studio/violet/commit/e473abdb185f7b1b7a8a0375d9ed0b9bae2c7a30)), closes [#101](https://github.com/VOD-Studio/violet/issues/101)
* **tweet:** 提供公开用户资料端点 ([df3e185](https://github.com/VOD-Studio/violet/commit/df3e18523d0577d003ba5cdc8779d6e3ae2dc7cc))
* **tweet:** 支持推文引用与话题标签后端能力 ([07077ab](https://github.com/VOD-Studio/violet/commit/07077ab1ed24c66eb7b834c53ff673560b65f534))
* **tweet:** 支持推文引用与话题聚合页前端交互 ([95c646e](https://github.com/VOD-Studio/violet/commit/95c646ee9702a548304a6ad3abd401570bd08365))
* **tweet:** 用户公开主页前端 ([d2f5fbe](https://github.com/VOD-Studio/violet/commit/d2f5fbe3b3070a8ad89d16202f495feee3724599))
* **tweet:** 评论列表返回回复数 replies_count ([336bea1](https://github.com/VOD-Studio/violet/commit/336bea170d620cba8f7b207d7dc98b4558044d44))
* **tweet:** 评论支持纯图片发布 ([f258766](https://github.com/VOD-Studio/violet/commit/f258766f5abb105b196f9e9bfe545c0e9b514c2b))
* **user:** 用户聚合根状态变更事件（角色/状态/用户名/删除/批量） ([8edfdc7](https://github.com/VOD-Studio/violet/commit/8edfdc775afc42227caf570a1ca8498980f2fe63))
* **web:** MCP 接入页支持选 server 生成对应配置 ([fe6fbc2](https://github.com/VOD-Studio/violet/commit/fe6fbc2316c742a3e6321ab13534682e3fcd8a80))
* **web:** PAT 管理页 scope 选项新增 posts:scrape ([751e020](https://github.com/VOD-Studio/violet/commit/751e020830e1e527af607c9b42e2540e037f204b))
* **web:** PAT 管理页 scope 选项新增 subscriptions:read/write ([4dc138a](https://github.com/VOD-Studio/violet/commit/4dc138aae2e47ab0aee9ffee75a4bb2864250a25))
* **web:** 前端适配 display_name 拆分与 username 规则收紧 ([7108843](https://github.com/VOD-Studio/violet/commit/7108843eeeda6dd77a4e6003ad0a413b1be4ecd7))
* **web:** 后台 RSS 订阅管理页（PageShell + DataTable） ([3ab9c2b](https://github.com/VOD-Studio/violet/commit/3ab9c2ba16508a6943f8d3651b61dc7c410a26a1))
* **web:** 后台侧边栏升级——重设计、收起模式，修复菜单转场闪烁 ([af9935b](https://github.com/VOD-Studio/violet/commit/af9935bb5d25e02ee8f87bb72c3b227a8bbe969a))
* **web:** 后台侧边栏接入 wordmark 品牌标识 ([a1e861f](https://github.com/VOD-Studio/violet/commit/a1e861fad4ebedeb364a3d2f078f250fec954998))
* **web:** 后台侧边栏支持收起模式 ([b551aeb](https://github.com/VOD-Studio/violet/commit/b551aeb85445e812c9f96639466768d6c80be2b1))
* **web:** 后台侧边栏重设计——品牌区、菜单分组与激活指示条 ([cec3966](https://github.com/VOD-Studio/violet/commit/cec3966016d79eb9bd46b878638254ba85f85adc))
* **web:** 图块交互增强与图表渲染修复 ([898afca](https://github.com/VOD-Studio/violet/commit/898afca63197a5bcdc2cf8e5c936e12e53379705))
* **web:** 图块缩放平移与交互开关（阅读端） ([54782f4](https://github.com/VOD-Studio/violet/commit/54782f4c7359ed565e99f377292518818b178c4c))
* **web:** 接入 violet 品牌视觉资产（favicon + 后台 wordmark） ([fe31216](https://github.com/VOD-Studio/violet/commit/fe3121674ed0cd3f0e8adb67c4c1c8ebebf2251d))
* **web:** 接入页 MCP_SERVERS 支持 anonymous 维度 ([8c7d3d3](https://github.com/VOD-Studio/violet/commit/8c7d3d31326a700705191c32684317ed62093a7a))
* **web:** 操作日志展示系统操作标记 ([2cb779e](https://github.com/VOD-Studio/violet/commit/2cb779e369397cc71635084f09f526ad18637fc4))
* **web:** 操作日志页适配新 AuditEvent 读模型 ([467b28c](https://github.com/VOD-Studio/violet/commit/467b28c5892848aae55756d32ea8da2c0c5915ae))
* **web:** 文章详情页接入转载 canonical link 与来源标记 ([94f3957](https://github.com/VOD-Studio/violet/commit/94f3957ddd24ccfd74787fddef3de881cdd26e20)), closes [#80](https://github.com/VOD-Studio/violet/issues/80)
* **web:** 更新日志区块渲染优化 ([3ab3d44](https://github.com/VOD-Studio/violet/commit/3ab3d44eec1c09fe4adeccc9531bcc404eb5935d))
* **web:** 更新日志独立页 /changelog + about 入口卡片 ([fca7d60](https://github.com/VOD-Studio/violet/commit/fca7d60722a7da372c113e2006436c10c67608fe))
* **web:** 更新日志页与 about 页加载态（骨架屏 + 错误重试） ([fc9ae94](https://github.com/VOD-Studio/violet/commit/fc9ae94d0415bf617c14ef3b6fd6ad62e67bdb7b))
* **web:** 添加开发环境 Dockerfile ([0fd5ded](https://github.com/VOD-Studio/violet/commit/0fd5dedd15f03d3613c1bf3f2b3b0307e137c176))
* **web:** 站点 favicon 切换为 V 徽章品牌图 ([39a2411](https://github.com/VOD-Studio/violet/commit/39a24110aceee83ea3cf7695c8e5bd2d24735804))
* **web:** 订阅管理页新增立即抓取按钮 ([6c1004a](https://github.com/VOD-Studio/violet/commit/6c1004a16b649118671e88731e48429c6bb3ffa9))
* 前台文章搜索与登录账号输入优化 ([de13f25](https://github.com/VOD-Studio/violet/commit/de13f2571a40c7b2d170a9380275eefa0affbf18))
* 图块（流程图）支持 + 批注按钮边界修复 ([1edf54f](https://github.com/VOD-Studio/violet/commit/1edf54f068f60a3d0ee944ce027cbb1081de2b8f))
* 抓取 MCP（同步抓取 + RSS 订阅 + 转载文章 + MCP server 拆分） ([47613ad](https://github.com/VOD-Studio/violet/commit/47613ada41b36377fa00a9d0083aec5f3cde3685))


### 修复

* **admin-layout:** FLIP 动画 finished promise 加 catch 防未处理拒绝 ([1614849](https://github.com/VOD-Studio/violet/commit/161484904e6387cdbd57460593f81f2087f98dfd))
* **admin-layout:** 恢复 DataTable 高度链修复表格内部滚动失效 ([663fd3b](https://github.com/VOD-Studio/violet/commit/663fd3bf446f2ee2660d7dca9c2d00ddcd581640))
* **admin-layout:** 非表格页内容溢出可滚动 ([e6af4e4](https://github.com/VOD-Studio/violet/commit/e6af4e4cafb613ecb494f8f97de4a3d5d6cfaa34))
* **admin-subscriptions:** 操作列加宽恢复按钮组 padding ([35d3063](https://github.com/VOD-Studio/violet/commit/35d3063529b10c65c7aea030d2bd7a7abb3b28a1))
* **admin:** 全部表格迁移到 pagination 属性 ([06eadcc](https://github.com/VOD-Studio/violet/commit/06eadcc155dc503633b29ac24750539db33381e6))
* **admin:** 后台权限管理修复与 superadmin 语义化重构 ([#81](https://github.com/VOD-Studio/violet/issues/81)) ([591b079](https://github.com/VOD-Studio/violet/commit/591b0794b304316f0fcbedef4e32a0a9f0623665))
* **admin:** 后台表格交互优化与文章管理增强 ([1f1b020](https://github.com/VOD-Studio/violet/commit/1f1b020a95060ead51aaf3d2ff3928067885a7c1))
* **admin:** 恢复 subscriptions 与 users 每页条数选择器 ([4868ed5](https://github.com/VOD-Studio/violet/commit/4868ed5b3eb7a2fe3e60d66e97e5819d12b49bbe))
* **admin:** 文章编辑器移动端布局适配 ([9ccb88f](https://github.com/VOD-Studio/violet/commit/9ccb88fab3be5d0a7b2a2d99e9c4ade010cbcb61))
* **admin:** 文章设置移动端改侧滑抽屉与工具栏排版 ([cc7ec1f](https://github.com/VOD-Studio/violet/commit/cc7ec1f50d732f696029f8dd2fa78fdbf561acd4))
* **admin:** 权限分组默认折叠、侧边栏切换掉帧与分组导航交互 ([99bb67b](https://github.com/VOD-Studio/violet/commit/99bb67b30815e8ea782ea0818c7aa80a88cede31))
* **admin:** 标题行 min-h-9 统一有无 action 页面高度 ([5565fee](https://github.com/VOD-Studio/violet/commit/5565fee3d3b6cb8c935cb58d18bff53cb07ba568))
* **admin:** 移除桌面端冗余的文章设置按钮 ([7f14136](https://github.com/VOD-Studio/violet/commit/7f14136f9deaffa1174a5b20207db8593ccf007f))
* **admin:** 筛选栏 Segmented 统一 h-9 高度消除切换抖动 ([ec7a221](https://github.com/VOD-Studio/violet/commit/ec7a2215e8e2936ba2fd051800fed58bdad5a121))
* **admin:** 统一各页面筛选项位置到表格工具栏 ([6bc6eba](https://github.com/VOD-Studio/violet/commit/6bc6eba495dc876954117c31d730d0f384d99641))
* **api:** 支持从 api 目录加载根目录 .env 文件 ([6245470](https://github.com/VOD-Studio/violet/commit/62454701dc9e539d0429f6b7bb7d164f85f46ef8))
* **api:** 锁定与 Go 1.25 兼容的 air 版本 v1.61.7 ([a8e901e](https://github.com/VOD-Studio/violet/commit/a8e901ec924d4446b750ce62250b44ca9f657b56))
* **audit:** buildPO 补全 IPAddress 与 UserAgent 赋值 ([#100](https://github.com/VOD-Studio/violet/issues/100)) ([720cbab](https://github.com/VOD-Studio/violet/commit/720cbabf098d75a7fb3b0224b9e7ddcaf80ee28d))
* **audit:** Summary 边界文案修复 ([c361976](https://github.com/VOD-Studio/violet/commit/c361976efb89a186aa33aad025b796ac877f107f))
* **audit:** 修复评审两处边界问题 ([9c638e8](https://github.com/VOD-Studio/violet/commit/9c638e833ddb0447d045ee4e08c3c2c7fef92012))
* **audit:** 空值写入 uuid/jsonb 列失败修复（e2e 发现） ([810d629](https://github.com/VOD-Studio/violet/commit/810d6292b5b3a3d2469133399c706703b9455e23))
* **audit:** 订阅抓取摘要隐藏技术错误并兜底空标题 ([22c71a8](https://github.com/VOD-Studio/violet/commit/22c71a806b7a58e042ed6db3ad536fbe950e9944))
* **audit:** 订阅者映射快照字段 + 登录/注册审计修复（review [#58](https://github.com/VOD-Studio/violet/issues/58)） ([e807700](https://github.com/VOD-Studio/violet/commit/e807700357c18221acac3a50d93364672e4d4234))
* **auth:** beforeLoad 不再基于 getAuthSession 清缓存 ([872061f](https://github.com/VOD-Studio/violet/commit/872061fdde6151c89b108032d8dce1a4fb541e26))
* **auth:** cookie 兜底改用 violet_csrf 并清除 debug 日志 ([8957cef](https://github.com/VOD-Studio/violet/commit/8957cefe6240fd7dbf21017df1fe621604bfcafa))
* **auth:** me 接口补全用户 ID 返回 ([5434a9d](https://github.com/VOD-Studio/violet/commit/5434a9d68c69cc95a3348f4fe0173e8e2539022d))
* **auth:** session 过期时同步清 useMe 缓存消除 Header 假登录 ([90d1701](https://github.com/VOD-Studio/violet/commit/90d17017a7d942e2dcf4f226e135efd58f73d955))
* **auth:** 守卫加 violet_csrf cookie 判定页面刷新后登录态 ([324e626](https://github.com/VOD-Studio/violet/commit/324e6269a404e7352f48bba326912e151b625f97))
* **auth:** 守卫追加 me 缓存兜底防止刷新误踢已登录用户 ([aaff231](https://github.com/VOD-Studio/violet/commit/aaff231a450b68676ed1f52b492d8745e9abc5a6))
* **auth:** 客户端 hydrate 用 cookie 兜底 RPC 探活假阴性 ([1898037](https://github.com/VOD-Studio/violet/commit/1898037c87eaf90d18efc2f18316da636738fda9))
* **auth:** 已登录用户访问 /login 自动重定向 ([1f5c882](https://github.com/VOD-Studio/violet/commit/1f5c882c35c1782527c6bda2c34e663757e39e60))
* **changelog:** scope 组头 badge 化对齐分类标签范式 ([d76c702](https://github.com/VOD-Studio/violet/commit/d76c702b2da24433490c1338eb12a6c6376d81bb))
* **changelog:** scope 组头改深色小标题避免与分类 badge 同形 ([4b151b5](https://github.com/VOD-Studio/violet/commit/4b151b5f14545573f116130f3fc7091c2e542316))
* **changelog:** 更新日志页展示修复与内容治理 ([2adfe18](https://github.com/VOD-Studio/violet/commit/2adfe185857bd5a151f0f847a695883f2db6d766))
* **changelog:** 条目列表补 bullet 标记 ([7e0fce2](https://github.com/VOD-Studio/violet/commit/7e0fce231758e293433ed62b07840e6e31f6754b))
* **changelog:** 清洗条目噪音并按 scope 聚合分组 ([027a92e](https://github.com/VOD-Studio/violet/commit/027a92ec78179f26e4f96d4de5fef69ab1b5cc4d))
* **changelog:** 清洗逻辑去中文标点前残留空格 ([e443523](https://github.com/VOD-Studio/violet/commit/e4435234ce8d9f6c12696ebee03eb10ad2c9d33c))
* **changelog:** 版本目录导航与阅读位置高亮 ([13866d3](https://github.com/VOD-Studio/violet/commit/13866d3bb94667bac008e241ab750212b6d0045c))
* **changelog:** 移动端时间线对齐与当前版本徽章浅底化 ([6241f8f](https://github.com/VOD-Studio/violet/commit/6241f8f1ad079060115c0de4c01308b9850bcf70))
* **changelog:** 聚合阈值改为所有 scope 一律成组 ([e820ffc](https://github.com/VOD-Studio/violet/commit/e820ffce6fba3c26de3066351976905c678dd556))
* **changelog:** 阅读位置追踪与版本 chip 跟随修复 ([3d4fc6c](https://github.com/VOD-Studio/violet/commit/3d4fc6c7bad186a853a9208e30aeae086682ddbc))
* **ci:** release-please changelog 从 github 原生改为 release-please 原生 ([#34](https://github.com/VOD-Studio/violet/issues/34)) ([e8ad47c](https://github.com/VOD-Studio/violet/commit/e8ad47ca9f49832d8a6b12af14f5d93561f412c1))
* **ci:** release-please 改用 manifest 配置文件(v4 不再支持内联参数) ([e8218cf](https://github.com/VOD-Studio/violet/commit/e8218cf6075d557f870219850f4d0ea41a75b69a))
* **ci:** release-please 用 PAT 绕过组织 GITHUB_TOKEN 创建 PR 限制 ([2ce1386](https://github.com/VOD-Studio/violet/commit/2ce1386843c7122320651562226c43116837f6f4))
* **cmd:** 简化 godotenv.Load 为无参默认搜索 ([2554162](https://github.com/VOD-Studio/violet/commit/2554162100e0f6dee2649b14e5929463a16f35cb))
* **code-preview:** shiki 语言包改静态映射修复语法高亮静默失效 ([7dd5473](https://github.com/VOD-Studio/violet/commit/7dd547327cef1151c5cb626be56bd25ad2fbe916))
* **command-palette:** 关闭面板时重置输入查询 ([b370a68](https://github.com/VOD-Studio/violet/commit/b370a68986972554693524d5fd8b704125e416cd))
* **command:** 亮色模式命令面板发灰 ([e088c37](https://github.com/VOD-Studio/violet/commit/e088c372ae5ddaea21b6c7eb14b7747da4e6c8b8))
* **data-table:** 每页条数选择器默认显示并支持 opt-out ([df6019c](https://github.com/VOD-Studio/violet/commit/df6019cba9d77c22e8a6ed8361d162d1849b444a))
* **data-table:** 移除工具栏重复的已选数量显示 ([75013ba](https://github.com/VOD-Studio/violet/commit/75013baeb5fe06042422f66b0f5751d173786cc3))
* **data-table:** 移除未实现的 stickyHeader prop ([96760f6](https://github.com/VOD-Studio/violet/commit/96760f6d1a70c9768783cc08be11f69d700c3668))
* **data-table:** 表格自适应剩余空间并内部滚动 ([4d1a6ec](https://github.com/VOD-Studio/violet/commit/4d1a6eceaa09c42a9298b60f09986c763312dd27))
* **date-picker:** 日历补齐日期可点选并区分禁用样式 ([ba147aa](https://github.com/VOD-Studio/violet/commit/ba147aaff9a740cb3e7bef6be7923f46724616c1))
* **deploy:** backend 网络声明 external 复用现有 blog_network ([babcedc](https://github.com/VOD-Studio/violet/commit/babcedcab614ba6e97dfd6d0d47d43863835236d))
* **deploy:** CI 镜像名从 blog-api 统一为 violet-api ([fc1456a](https://github.com/VOD-Studio/violet/commit/fc1456ac057f32f993a3a415176bf54b6a08fc16))
* **deploy:** deploy-web always() 与 release 锚点前置 ([#94](https://github.com/VOD-Studio/violet/issues/94)) ([e77c98b](https://github.com/VOD-Studio/violet/commit/e77c98ba457b3687693a9cd04dcec8c67e27741e))
* **deploy:** detect 恢复全量拉取修复锚点 tag 解析 ([#91](https://github.com/VOD-Studio/violet/issues/91)) ([8fb8b06](https://github.com/VOD-Studio/violet/commit/8fb8b06c398fab8f7cf64a33a4df56f5a842629b))
* **deploy:** Docker 开发环境启动后自动开启日志跟踪保持 std 挂载 ([3f3b056](https://github.com/VOD-Studio/violet/commit/3f3b056a016d2ec3eb4020633ea6506da9efee7b))
* **deploy:** ghcr 包可见性 API 改 org 路径 + 服务器 podman login 兜底 ([175ecf3](https://github.com/VOD-Studio/violet/commit/175ecf334f879945fc4b43ef5a3cf0de54eafb8e))
* **deploy:** npm registry 换国内镜像源 ([#89](https://github.com/VOD-Studio/violet/issues/89)) ([fa44bd3](https://github.com/VOD-Studio/violet/commit/fa44bd312db93495ba6ffc7e218f200b9f1b7624))
* **deploy:** 下游 job 补 prepare-server 检查 + ghcr 操作重试 ([f499b2f](https://github.com/VOD-Studio/violet/commit/f499b2fe153792789b309f93f5806b64786308c0))
* **deploy:** 下游 job 补 prepare-server 检查 + ghcr 操作重试 ([4d69376](https://github.com/VOD-Studio/violet/commit/4d69376916f1c3d71e1c5f097732b82b7282bb93))
* **deploy:** 删除 web Dockerfile 对已移除 .npmrc 的 COPY 引用 ([#74](https://github.com/VOD-Studio/violet/issues/74)) ([1022a44](https://github.com/VOD-Studio/violet/commit/1022a448df41aebb488f6dc72eabe17ba8879bba))
* **deploy:** 可见性按实际部署侧设置 + 去括号注释噪声 ([e23158b](https://github.com/VOD-Studio/violet/commit/e23158b932b505769d808185b6f4ee843042ba09))
* **deploy:** 给开发环境 Dockerfile 添加国内镜像源加速 ([49187b5](https://github.com/VOD-Studio/violet/commit/49187b51e042eb50aad29962b4ada236d4648891))
* **deploy:** 网络名从 blog_network 规范化为 violet_network ([84027b8](https://github.com/VOD-Studio/violet/commit/84027b8ae6851295e4fbc13b9ffe8e3b9238cf07))
* **deploy:** 调大 pnpm 下载超时容忍慢链路 ([#87](https://github.com/VOD-Studio/violet/issues/87)) ([6fa555b](https://github.com/VOD-Studio/violet/commit/6fa555b8647d1ef924b55f1cfcaad96ec3246af3))
* **dev:** dev-mixed 加 --build 确保新代码进入容器 ([12b9c0b](https://github.com/VOD-Studio/violet/commit/12b9c0b59d98e0c79d6cee66c03bd86d3dd53fbf))
* **diagram:** mermaid 渲染临时容器改为离屏挂载 ([ff13782](https://github.com/VOD-Studio/violet/commit/ff13782861beeae571158f29124616cc7c63d389))
* **diagram:** 修复 DOMPurify 剥除 foreignObject 导致五类图文字丢失 ([822322d](https://github.com/VOD-Studio/violet/commit/822322d82f3120c93ed2f8ea6bde49342f7ed212))
* **diagram:** 全屏灯箱交互与渲染缺陷修复 ([ea3c6a6](https://github.com/VOD-Studio/violet/commit/ea3c6a6d27099b3daef802a516a820648943c785))
* **diagram:** 加大占位高度缓解渲染撑开的布局跳动 ([0b0b356](https://github.com/VOD-Studio/violet/commit/0b0b356519f8a68147d95b0e38fe923657492d33))
* **diagram:** 加载态容器结构稳定，消除撑开缩小跳变 ([6b6b2da](https://github.com/VOD-Studio/violet/commit/6b6b2daf0226f2104ff6c4e6767ef42ee58f9fca))
* **diagram:** 图块批注拦截与失败占位样式修复 ([5cebe98](https://github.com/VOD-Studio/violet/commit/5cebe98f8b2173872a5798025372d94629b39876))
* **diagram:** 暗色主题改用内置 dark 主题修复文字可读性 ([cf6bc9a](https://github.com/VOD-Studio/violet/commit/cf6bc9afaf58c795ce1551484e98be000a570cb2))
* **diagram:** 灯箱遮盖层加深并为图垫背景色衬底 ([151af0b](https://github.com/VOD-Studio/violet/commit/151af0b02fdd8e705ff2ce291793ab96ad4b2bef))
* **domain:** username 测试用例对齐 ASCII-only 规则 ([860a8a0](https://github.com/VOD-Studio/violet/commit/860a8a0f4ce7a64c465440f62b15abbef4ade432))
* **editor:** 公式弹层卡死与专注模式 slash 菜单遮挡 ([#81](https://github.com/VOD-Studio/violet/issues/81)) ([94e4cbb](https://github.com/VOD-Studio/violet/commit/94e4cbb76eb8d709298d2dddf5c3bd399ee25084))
* **editor:** 源码模式滚动镜像撑开页面产生滚动条 ([6dcb797](https://github.com/VOD-Studio/violet/commit/6dcb7977fdb707c60b70a24d53b631a6a647989f))
* **editor:** 源码模式移动端滚动定位修正 ([86e68a3](https://github.com/VOD-Studio/violet/commit/86e68a30f7cb28dc91befddcb2ae4cdbcb6e40eb))
* **editor:** 编辑器源码模式滚动与移动端布局修复 ([a050496](https://github.com/VOD-Studio/violet/commit/a0504961fb78aef6315aca47fcfaac87c2b1b899))
* **eventbus:** 合并双 bus 实例 + Publish 死锁修复 ([f5704a0](https://github.com/VOD-Studio/violet/commit/f5704a0ac336370eec1cf20a0c7007dc47202d60))
* **feed:** 抓取超时从 15s 调大到 30s ([a41063b](https://github.com/VOD-Studio/violet/commit/a41063b395eb6f35f557f43d2587f63d8f8d81a4))
* **friend-links:** 修正 ApplyDialog 行首多余空格 ([a9928b9](https://github.com/VOD-Studio/violet/commit/a9928b9a46fddc99198866e1f1303aef5ee64d3a))
* **header:** nav 激活态改用显式 pathname 判定 ([dc76adf](https://github.com/VOD-Studio/violet/commit/dc76adf7305b2dba0d9d426040724951e443e1c1))
* **header:** nav 绝对定位消除左右抖动 ([c9941c6](https://github.com/VOD-Studio/violet/commit/c9941c6c3fe9e6c9286d89f06524737b18cc967a))
* **header:** 优化下拉菜单视觉与 root 用户冗余信息 ([33f181b](https://github.com/VOD-Studio/violet/commit/33f181bbe6a1f798db08b3cb3ce4425759fdf216))
* **header:** 修复刷新瞬间 nav 全部高亮 ([586ac68](https://github.com/VOD-Studio/violet/commit/586ac682aaa6912c1c29ed3103cefd8187f0d2ab))
* **header:** 刷新时不闪过登录按钮再切换登录态 ([44a4078](https://github.com/VOD-Studio/violet/commit/44a40789ea6e7645837eb4d591c4976a16a639f7))
* **header:** 用户菜单触发器去掉用户名并统一为圆形头像槽位 ([2bb4196](https://github.com/VOD-Studio/violet/commit/2bb4196f7f008959d550bb18bf46efc79b3690b8))
* **header:** 登出按钮去掉 destructive variant 视觉提示 ([eac07fb](https://github.com/VOD-Studio/violet/commit/eac07fba7be383c26fba1c28be54d2584954a210))
* **header:** 背景常驻消除刷新非顶部位置背景丢失 ([bfaef66](https://github.com/VOD-Studio/violet/commit/bfaef666e675714746d4a8538dcc04a29e7fcebc))
* **header:** 锁定用户菜单 trigger 宽度避免登录跳动 ([09c697a](https://github.com/VOD-Studio/violet/commit/09c697a3e12bf993042291fe03efb4f89ba31bba))
* **job:** T8 review 修复（applyFeedError 强类型 + 常量 + 精简注释） ([ef8434e](https://github.com/VOD-Studio/violet/commit/ef8434ebbd5173a7c3c8c9d14b49793c0b29c679))
* **mcp:** list_subscriptions 描述 tag 触发 jsonschema WORD= 校验 panic ([98fc531](https://github.com/VOD-Studio/violet/commit/98fc531def0c45afa1c73224ee4abef943cf01ea))
* **mcp:** PATTable 操作列对齐全站表格排版惯例 ([e81b5e9](https://github.com/VOD-Studio/violet/commit/e81b5e98ae15748fa38747b8f457d303aa63fa0f))
* **mcp:** update_post canonical_url 描述对齐全量覆盖语义 ([c158cf7](https://github.com/VOD-Studio/violet/commit/c158cf771d41d5b6f85759390f69f5f4d813fcf1))
* **mcp:** update_subscription auto_publish 描述去掉等号修复启动 panic ([a3065eb](https://github.com/VOD-Studio/violet/commit/a3065eb50adfbe2472ab938d4644c1e4476a1792))
* **mcp:** update_subscription auto_publish 描述去掉等号修复启动 panic ([4e1564d](https://github.com/VOD-Studio/violet/commit/4e1564dfa9de514857ef12cb9c2624fc0724d53d))
* **mcp:** 抓取建文 content_html 缺失致编辑页/预览无数据 ([#80](https://github.com/VOD-Studio/violet/issues/80)) ([cdf592a](https://github.com/VOD-Studio/violet/commit/cdf592ac07747315e2397083afbdf21ea8d96d25))
* **media:** 补注册 admin 组批量删除路由修复 405 ([#3](https://github.com/VOD-Studio/violet/issues/3)) ([f5eff6f](https://github.com/VOD-Studio/violet/commit/f5eff6fa2413c87c8f8c67fd8a57f24e972e6ad1))
* **middleware:** GetClientIP 返回剥离端口的纯 IP ([7778082](https://github.com/VOD-Studio/violet/commit/777808262e283976d6afe59e1f1f5d68a8487496))
* **migrations:** 推文迁移重编号为 070-074 解决合并版本冲突 ([3a4bde7](https://github.com/VOD-Studio/violet/commit/3a4bde7f185af187dfaf56a73980b78006c43139))
* **migrations:** 迁移文件从仓库根移到 api/migrations/ ([def094c](https://github.com/VOD-Studio/violet/commit/def094c98aa8483231c2da3ab5283f0808febfbe))
* **model:** subscription_entries 唯一索引改为 (subscription_id, guid) 复合 ([068c729](https://github.com/VOD-Studio/violet/commit/068c7294798b6d4382f66e784956c6b675ec4836))
* **model:** subscription_entries 唯一索引改为 (subscription_id, guid) 复合 ([50bb744](https://github.com/VOD-Studio/violet/commit/50bb744bc528f085742d61ff5567924b84f84b5a))
* **nav-menu:** 父项默认折叠不再跟随路由自动展开 ([5b36fe8](https://github.com/VOD-Studio/violet/commit/5b36fe81d10ab8bbe50d9aa78a8ddaa2076bc0ee))
* PAT scope 校验与有效期选择器两处问题 ([#77](https://github.com/VOD-Studio/violet/issues/77)) ([f84d326](https://github.com/VOD-Studio/violet/commit/f84d326b7472f1217d85ce50c073bb67d9b3fb24))
* **permissions:** 权限分组默认折叠 ([5cebd98](https://github.com/VOD-Studio/violet/commit/5cebd98c09c5da834e528f640997af44ec77dcf0))
* **permission:** 接通角色权限变更事件即时清缓存 ([2864bca](https://github.com/VOD-Studio/violet/commit/2864bcacd9275be324d2d4b08e93ff8f332b183f))
* **post:** 空 slug 自动按标题生成 ([8955dc3](https://github.com/VOD-Studio/violet/commit/8955dc3f5a50f09cd8c262021bcd3c287ff45c00))
* **profile:** 个人中心 root 角色统一显示为 root ([877e483](https://github.com/VOD-Studio/violet/commit/877e48336d616e379092b342191e51288e0fc269))
* **profile:** 账户信息 Tab 补回图标 ([307a3ae](https://github.com/VOD-Studio/violet/commit/307a3aeb48cf756a787f7778382781d97e59e082))
* **profile:** 账户信息补回行首图标 ([7d523b6](https://github.com/VOD-Studio/violet/commit/7d523b6dd978586e246636fae2292f7524b8a466))
* **releases:** 更新日志条目去重 + 去掉 commit hash 引用 ([83899c5](https://github.com/VOD-Studio/violet/commit/83899c59a1e6d2bf8da22128a7d1248e5a5bc7a1))
* **role:** 修复权限断言顺序依赖（flaky 测试，CI 撞出） ([d4600f7](https://github.com/VOD-Studio/violet/commit/d4600f73ff5a2df50123e6075743a22b8a6fbcb7))
* **shared-ui:** OverlayScroll 困住 z-index 到组件内 ([#182](https://github.com/VOD-Studio/violet/issues/182)) ([07075b2](https://github.com/VOD-Studio/violet/commit/07075b2ecd92d0f6f0d84e1284990fa0b071db54))
* **shared-ui:** 修复 SpotlightCard 内容布局 ([f949150](https://github.com/VOD-Studio/violet/commit/f949150752a6f1d0426ca80b48fe3a87bedd270e))
* **shared-ui:** 无回复的评论不显示「查看回复」toggle ([533c979](https://github.com/VOD-Studio/violet/commit/533c979946f37a14474fc6b88aac33e3a4f78b63))
* **subscription:** T6 review 后端修复（意见 1/2/3/5） ([e55851d](https://github.com/VOD-Studio/violet/commit/e55851d1cebc0d8f7e39ddeabf3c2e771d395ad7))
* **subscription:** T7 review 修复（auto_publish 真实现 + 错误处理） ([7b20844](https://github.com/VOD-Studio/violet/commit/7b208441e4192ced10c8f880fb7c8243b440cf63))
* **subscription:** 抓取事件 success 语义改为整轮无失败 ([1f968e9](https://github.com/VOD-Studio/violet/commit/1f968e9e1627ea432b5eec0467baebac4c74cc35))
* **subscription:** 抓取时回填订阅源标题 ([704a52a](https://github.com/VOD-Studio/violet/commit/704a52abbe6b5c26aea032b8ae633593b738b44f))
* **subscription:** 抓取时回填订阅源标题 ([6ffbe7e](https://github.com/VOD-Studio/violet/commit/6ffbe7e089d852bee3a4ce99497c4992e9023351))
* **theme:** 修复多图块页面切换主题卡死 ([a394479](https://github.com/VOD-Studio/violet/commit/a394479a7e5bb0404d568da791e4c88fd939eb74))
* **toc:** 内容异步撑开后重算激活标题 ([b8bbcbf](https://github.com/VOD-Studio/violet/commit/b8bbcbf0bbf3bed3224b9b90a268c6a4f5b76a2c))
* **toc:** 将 "Contents" 文本翻译为 "目录" ([43817f7](https://github.com/VOD-Studio/violet/commit/43817f7d63500e9417bcce3fe5995addb34c17a8))
* **tweets:** 修复用户主页无限滚动 loader 缓存结构不匹配报错 ([9ba76bf](https://github.com/VOD-Studio/violet/commit/9ba76bf9876e1518ee0027cbbdcb0a4b31b39c00))
* **tweet:** 修复 review 发现的 404 路由、回滚撤销与 DOM 嵌套问题 ([9897f66](https://github.com/VOD-Studio/violet/commit/9897f66b07397fa3de3b4b084dba060bbef5185b))
* **tweet:** 发布框超图提示与失败缩略图修复 ([3853df0](https://github.com/VOD-Studio/violet/commit/3853df02ec13a8f7f90ce676813a01a68c497fb1))
* **web:** a11y lint 收尾——配置级 off useKeyWithClickEvents 与失效 ignore 清理 ([a5abd27](https://github.com/VOD-Studio/violet/commit/a5abd270c345b95e59f76e3fea268f0944c0f38a))
* **web:** LandingHero 按钮 transition 防暗黑刷新闪烁 ([9b9a323](https://github.com/VOD-Studio/violet/commit/9b9a323f0938e9c063b7c1c98d4cf5c5aadbd44d))
* **web:** SSR cookie 读取主题根治暗黑刷新闪烁 ([32f67a9](https://github.com/VOD-Studio/violet/commit/32f67a9b6db6265d51987fc3fc0b2d69fed4c9ee))
* **web:** useCallback 包裹 toggleZen 修复 useExhaustiveDependencies ([fc9c323](https://github.com/VOD-Studio/violet/commit/fc9c32392e0b7639f18f9b80df5f6af0310e73a4))
* **web:** 主题切换器补全跟随系统模式 ([816126e](https://github.com/VOD-Studio/violet/commit/816126eda506fae1990bc10501a106fad451985b))
* **web:** 修复 biome lint 检查暴露的 a11y 与代码质量问题 ([39ac083](https://github.com/VOD-Studio/violet/commit/39ac083a804ad0427ebfdac68048b08d7d06367d))
* **web:** 修复图块空白回归（加载态容器 ref 时序） ([c0788a0](https://github.com/VOD-Studio/violet/commit/c0788a040f195a06f44394cea284a2750171d9fb))
* **web:** 后台导航禁用 View Transition 消除菜单闪烁 ([52edfd8](https://github.com/VOD-Studio/violet/commit/52edfd8436e4fc3c47e08ccaa07e234be5258844))
* **web:** 图块加载期空白占位与复制按钮图标反馈 ([4e32c06](https://github.com/VOD-Studio/violet/commit/4e32c06521b629b827c1e3d3f1c14150becc412c))
* **web:** 图块滚轮缩放不再带动页面滚动，容器撑满正文栏 ([1a1ef63](https://github.com/VOD-Studio/violet/commit/1a1ef631e1d42436f687529e70d2ef69a5858cc7))
* **web:** 忽略 pnpm 本地缓存目录 .pnpm-store ([edc9f04](https://github.com/VOD-Studio/violet/commit/edc9f04dab35102022cabdf192f077e1d15253cc))
* **web:** 操作日志操作人列省略号截断与悬停 tooltip ([9e337c4](https://github.com/VOD-Studio/violet/commit/9e337c45e4971f6d75c7563bdcfbadd2e60bc92d))
* **web:** 更新日志独立页、重复条目修复、加载态 ([60495f9](https://github.com/VOD-Studio/violet/commit/60495f9c0e28d1788a362c0a8bb013f67a72320a))
* **web:** 缩短主题切换 VT 对页面加载的阻塞 ([2959c42](https://github.com/VOD-Studio/violet/commit/2959c423acbfa913fab17b38feb25ee7bdb5ea66))
* **web:** 转载来源标记显示域名而非完整 URL ([4c3eb65](https://github.com/VOD-Studio/violet/commit/4c3eb65b1c62d5e0031b79c569b46d0be984dc3b))
* **web:** 长耗时请求单独加 5 分钟超时 ([db6d385](https://github.com/VOD-Studio/violet/commit/db6d3852fcf4125963d32ddab348a08e48c233a8))
* 处理 PR [#85](https://github.com/VOD-Studio/violet/issues/85) 评审意见（SSRF/PAT/订阅/SEO） ([96b247c](https://github.com/VOD-Studio/violet/commit/96b247cc82eef8c4f9c2b5cb851451cd248c6285))
* 操作日志省略修复与部署构建迁移 GitHub ([6d84193](https://github.com/VOD-Studio/violet/commit/6d841937a744843cefe998441a41aa51e464e1aa))
* 消除前端 Biome 基线 lint 残留 ([#166](https://github.com/VOD-Studio/violet/issues/166)) ([c951377](https://github.com/VOD-Studio/violet/commit/c951377b0124be466308f1739e6088bd76dc213f))
* 认证守卫加固与 release/2.0 多项改进整合 ([#128](https://github.com/VOD-Studio/violet/issues/128)) ([c3fa938](https://github.com/VOD-Studio/violet/commit/c3fa93887def241002c0acf3dec82daec6d2c2a7))


### 性能优化

* **data-table:** 无展开行时容器 resize 不再触发表格重渲染 ([1febc31](https://github.com/VOD-Studio/violet/commit/1febc318c29b7ea7023ed1e4f1eafbae4d279ca0))
* **overlay-scroll:** 消除滚动时 React 重渲染 ([c39b597](https://github.com/VOD-Studio/violet/commit/c39b597ca384ab19ee2023684d2fe6e7d91fc144))
* **sidebar:** 侧边栏切换改 FLIP 滑动消除大表格页掉帧 ([ace2d51](https://github.com/VOD-Studio/violet/commit/ace2d51bd6fbbff40589a2f2370f96fdec2d92c2))


### 重构

* **admin-users:** 请求类型收敛到 model 层 ([7b6ba98](https://github.com/VOD-Studio/violet/commit/7b6ba98694a22a141e4003406ae3943a0207f9fe))
* **api_token:** PAT expiry 改 ISO 日期（不兼容旧 90d/365d 枚举） ([97bd2b5](https://github.com/VOD-Studio/violet/commit/97bd2b5e11c1a20b60ff40bab9e1da0dd323db93))
* **api:** 配置体系收敛为 env &gt; .env &gt; config.yaml &gt; 默认值单链 ([#78](https://github.com/VOD-Studio/violet/issues/78)) ([c578ff3](https://github.com/VOD-Studio/violet/commit/c578ff330fadf8d209a64bd9fe21872c677a649a))
* **application:** 运行时权限检查器移入 permission 聚合 ([3022f8c](https://github.com/VOD-Studio/violet/commit/3022f8cceb564f9a65b40ce808f2835df4ae321a))
* **audit:** 删除旧 audit 服务/存储/handler 装配（前置 [#49](https://github.com/VOD-Studio/violet/issues/49)/[#11](https://github.com/VOD-Studio/violet/issues/11)） ([c365b68](https://github.com/VOD-Studio/violet/commit/c365b68f9127d76b934df1394b6d08de064aa5e1))
* **audit:** 清理 review 发现的注释违规与读路径 panic ([6a81488](https://github.com/VOD-Studio/violet/commit/6a81488e52af084e0f63a80a862826dd2f1aa960))
* **auth:** 登录内联品牌图标替换为共享图标组件 ([269c3f0](https://github.com/VOD-Studio/violet/commit/269c3f0f4d5dc6647d9d5fff170d00d3dffb61aa))
* **domain:** TagRepository 接口从 entity.go 拆到 repository.go ([#32](https://github.com/VOD-Studio/violet/issues/32)) ([72edfec](https://github.com/VOD-Studio/violet/commit/72edfec9a40bbae84de84542aed43269b551159e)), closes [#31](https://github.com/VOD-Studio/violet/issues/31)
* **header:** 重设计用户菜单 Dropdown ([e3ffb11](https://github.com/VOD-Studio/violet/commit/e3ffb114cc5dc5f029dbdda6966de9590063008d))
* **mcp:** server 拆分为文章与抓取两个独立端点（ADR-0007） ([e44e553](https://github.com/VOD-Studio/violet/commit/e44e55377dd5ff806e5f3f45792ba8c98bb6551f))
* **mcp:** 抽取 MCP 页组件到 feature ui 层 ([68d24db](https://github.com/VOD-Studio/violet/commit/68d24dbfaf98509d4cbfccfb30f15508b6194cfe))
* **mcp:** 接入面板命令与配置片段改用共享 FencedCodeBlock ([d20f047](https://github.com/VOD-Studio/violet/commit/d20f04703e128da6b9a2f706da92fce02dfb2dee))
* **mcp:** 检索结果分页元数据与 tool 公共骨架抽复用 ([cb68f6c](https://github.com/VOD-Studio/violet/commit/cb68f6cb7c164e75dffbbb72bc79437b417ce131))
* **post:** 抽 meta_extract 通用节点遍历器消除重复 walk ([dd7c578](https://github.com/VOD-Studio/violet/commit/dd7c578c04770b8c54aa5e48e6ec6340a802cec5))
* **profile:** 统一个人中心卡片样式与字号 ([51df7f7](https://github.com/VOD-Studio/violet/commit/51df7f7ddcd871a5e2f828fb2d381fdadd78fcce))
* **profile:** 重设计个人中心页 ([7106788](https://github.com/VOD-Studio/violet/commit/7106788d05e514411a66f5b3eb62a47c3cbde346))
* **service:** 移除已迁移的旧 PermissionService ([cffca56](https://github.com/VOD-Studio/violet/commit/cffca566de6562a816a2f2b33705dd791c94d6f0))
* **settings:** 前端同步去除重复字段与 footer_text 归组 ([5e0c9d7](https://github.com/VOD-Studio/violet/commit/5e0c9d7d1b1bb9a0fd0ebc2e68e441dd07ab8012))
* **settings:** 去除基础信息与关于博主的重复字段 ([3a98225](https://github.com/VOD-Studio/violet/commit/3a98225980f51790226261383c696a3d18dac1a5))
* **shared-ui:** 将 ConfirmDialog 提到 shared/ui ([db2e0e4](https://github.com/VOD-Studio/violet/commit/db2e0e419f57392bb8f8ce95c74a2bc4e9d2285a))
* **shared-ui:** 新增 GitHub 与 Google 图标组件 ([5d15b67](https://github.com/VOD-Studio/violet/commit/5d15b67bd73145438d420a156ffe96d97baca77f))
* **shared-ui:** 评论区展示层抽离为公共组件供文章与推文复用 ([1c3b769](https://github.com/VOD-Studio/violet/commit/1c3b769f0f8fc441dd448e98484872a565780bf2))
* **subscriptions:** 抽取 SubscriptionFormDialog 到 feature ui 层 ([f369fc8](https://github.com/VOD-Studio/violet/commit/f369fc80cec8e6dda3d4020c58fc5bfb13a4fbfc))
* **subscription:** 抓取状态机从 job 提到 service.FetchNow ([1dc7a9c](https://github.com/VOD-Studio/violet/commit/1dc7a9cce6b4671a84d571f7ba7a37582749acc8))
* **subscription:** 提取 feed 错误分类字符串为 domain 常量 ([97c9033](https://github.com/VOD-Studio/violet/commit/97c90338e2bc8a1455b682652c8e5facd1fe073d))
* **theme-toggle:** 默认变体改为 segmented ([655819f](https://github.com/VOD-Studio/violet/commit/655819fc651ec3aed8a9bbe15d976ba1fc7d5011))
* **web:** MCP 接入页改数据驱动 server 勾选 + PAT 过期用 Select ([da66ff1](https://github.com/VOD-Studio/violet/commit/da66ff14a9dadb43254507c21cb78a53a0644831))
* **web:** PAT 过期改 DateTimePicker 选具体日期 ([1e13e32](https://github.com/VOD-Studio/violet/commit/1e13e32de70abcef386e711de7a6ff11fb4e876a))
* **web:** 移除 #/* 路径别名统一用 FSD 别名 ([84c60af](https://github.com/VOD-Studio/violet/commit/84c60afeb2d769b4ab6f99e6b064d6a21ad092be))
* 重设计 Header 用户菜单与个人中心页 ([#124](https://github.com/VOD-Studio/violet/issues/124)) ([7b014da](https://github.com/VOD-Studio/violet/commit/7b014da5abc32ea18ce90c06cb9dc711735fbc84))


### 内部维护

* **release:** 强制本次发版为补丁版本 2.4.4 ([4e568a0](https://github.com/VOD-Studio/violet/commit/4e568a0eb59b36300879977c93541a676b0105d7))

## [2.8.5](https://github.com/VOD-Studio/violet/compare/v2.8.4...v2.8.5) (2026-08-13)


### 修复

* **shared-ui:** OverlayScroll 困住 z-index 到组件内 ([#182](https://github.com/VOD-Studio/violet/issues/182)) ([07075b2](https://github.com/VOD-Studio/violet/commit/07075b2ecd92d0f6f0d84e1284990fa0b071db54))

## [2.8.4](https://github.com/VOD-Studio/violet/compare/v2.8.3...v2.8.4) (2026-08-13)


### 新增

* **posts:** 文章管理批量操作搜索与标签筛选 ([cabb804](https://github.com/VOD-Studio/violet/commit/cabb80402a2f6d3504c2fc71e9fa13c50d1728a7))
* **post:** 文章批量操作接口与列表搜索 ([c44ca8d](https://github.com/VOD-Studio/violet/commit/c44ca8dd15eeeb7137ce9f660d3be5e6b614684a))


### 修复

* **admin-layout:** 恢复 DataTable 高度链修复表格内部滚动失效 ([663fd3b](https://github.com/VOD-Studio/violet/commit/663fd3bf446f2ee2660d7dca9c2d00ddcd581640))
* **admin:** 后台表格交互优化与文章管理增强 ([1f1b020](https://github.com/VOD-Studio/violet/commit/1f1b020a95060ead51aaf3d2ff3928067885a7c1))
* **data-table:** 移除工具栏重复的已选数量显示 ([75013ba](https://github.com/VOD-Studio/violet/commit/75013baeb5fe06042422f66b0f5751d173786cc3))

## [2.8.3](https://github.com/VOD-Studio/violet/compare/v2.8.2...v2.8.3) (2026-08-13)


### 新增

* **nav-menu:** 收起态分组图标支持飞出菜单并指示子路由激活 ([f8c47a7](https://github.com/VOD-Studio/violet/commit/f8c47a710cb324f768732eee4471e4d6271a845a))


### 修复

* **admin-layout:** FLIP 动画 finished promise 加 catch 防未处理拒绝 ([1614849](https://github.com/VOD-Studio/violet/commit/161484904e6387cdbd57460593f81f2087f98dfd))
* **admin-layout:** 非表格页内容溢出可滚动 ([e6af4e4](https://github.com/VOD-Studio/violet/commit/e6af4e4cafb613ecb494f8f97de4a3d5d6cfaa34))
* **admin:** 全部表格迁移到 pagination 属性 ([06eadcc](https://github.com/VOD-Studio/violet/commit/06eadcc155dc503633b29ac24750539db33381e6))
* **admin:** 恢复 subscriptions 与 users 每页条数选择器 ([4868ed5](https://github.com/VOD-Studio/violet/commit/4868ed5b3eb7a2fe3e60d66e97e5819d12b49bbe))
* **admin:** 权限分组默认折叠、侧边栏切换掉帧与分组导航交互 ([99bb67b](https://github.com/VOD-Studio/violet/commit/99bb67b30815e8ea782ea0818c7aa80a88cede31))
* **audit:** 订阅抓取摘要隐藏技术错误并兜底空标题 ([22c71a8](https://github.com/VOD-Studio/violet/commit/22c71a806b7a58e042ed6db3ad536fbe950e9944))
* **data-table:** 每页条数选择器默认显示并支持 opt-out ([df6019c](https://github.com/VOD-Studio/violet/commit/df6019cba9d77c22e8a6ed8361d162d1849b444a))
* **data-table:** 移除未实现的 stickyHeader prop ([96760f6](https://github.com/VOD-Studio/violet/commit/96760f6d1a70c9768783cc08be11f69d700c3668))
* **data-table:** 表格自适应剩余空间并内部滚动 ([4d1a6ec](https://github.com/VOD-Studio/violet/commit/4d1a6eceaa09c42a9298b60f09986c763312dd27))
* **nav-menu:** 父项默认折叠不再跟随路由自动展开 ([5b36fe8](https://github.com/VOD-Studio/violet/commit/5b36fe81d10ab8bbe50d9aa78a8ddaa2076bc0ee))
* **permissions:** 权限分组默认折叠 ([5cebd98](https://github.com/VOD-Studio/violet/commit/5cebd98c09c5da834e528f640997af44ec77dcf0))


### 性能优化

* **data-table:** 无展开行时容器 resize 不再触发表格重渲染 ([1febc31](https://github.com/VOD-Studio/violet/commit/1febc318c29b7ea7023ed1e4f1eafbae4d279ca0))
* **overlay-scroll:** 消除滚动时 React 重渲染 ([c39b597](https://github.com/VOD-Studio/violet/commit/c39b597ca384ab19ee2023684d2fe6e7d91fc144))
* **sidebar:** 侧边栏切换改 FLIP 滑动消除大表格页掉帧 ([ace2d51](https://github.com/VOD-Studio/violet/commit/ace2d51bd6fbbff40589a2f2370f96fdec2d92c2))


### 重构

* **subscription:** 提取 feed 错误分类字符串为 domain 常量 ([97c9033](https://github.com/VOD-Studio/violet/commit/97c90338e2bc8a1455b682652c8e5facd1fe073d))

## [2.8.2](https://github.com/VOD-Studio/violet/compare/v2.8.1...v2.8.2) (2026-08-12)


### 新增

* **admin:** 操作日志列表与详情页支持 summary 展现 ([2177cc5](https://github.com/VOD-Studio/violet/commit/2177cc561bf281964d01c556ac6226c9653b73d8)), closes [#175](https://github.com/VOD-Studio/violet/issues/175)
* **audit:** mapEvent 升级为业务 Action 与人话摘要 ([b2a847b](https://github.com/VOD-Studio/violet/commit/b2a847b837197dd8fd9b75da1810d3d05664a856)), closes [#174](https://github.com/VOD-Studio/violet/issues/174)
* **audit:** 操作日志 Action 业务化与人话摘要重构 ([048912e](https://github.com/VOD-Studio/violet/commit/048912e0595f35da9ce8d8993c2339288224054d))
* **domain:** audit 新增 summary 字段与业务 Action 枚举 ([5c2ac25](https://github.com/VOD-Studio/violet/commit/5c2ac25bc71bb3b92f1ebbc35e8f475e8cc71981)), closes [#173](https://github.com/VOD-Studio/violet/issues/173)


### 修复

* **audit:** Summary 边界文案修复 ([c361976](https://github.com/VOD-Studio/violet/commit/c361976efb89a186aa33aad025b796ac877f107f))
* **audit:** 修复评审两处边界问题 ([9c638e8](https://github.com/VOD-Studio/violet/commit/9c638e833ddb0447d045ee4e08c3c2c7fef92012))

## [2.8.1](https://github.com/VOD-Studio/violet/compare/v2.8.0...v2.8.1) (2026-08-12)


### 修复

* 消除前端 Biome 基线 lint 残留 ([#166](https://github.com/VOD-Studio/violet/issues/166)) ([c951377](https://github.com/VOD-Studio/violet/commit/c951377b0124be466308f1739e6088bd76dc213f))

## [2.8.0](https://github.com/VOD-Studio/violet/compare/v2.7.0...v2.8.0) (2026-08-12)


### 新增

* **admin-friend-links:** 友链后台审核管理页 ([d81308e](https://github.com/VOD-Studio/violet/commit/d81308e0c04a8019ccb3ffb9774c8e0371317fb8))
* **friend-links:** 前台友链页与申请弹窗 ([d56411b](https://github.com/VOD-Studio/violet/commit/d56411bc88c3662169e7723b6155148f145e884c))
* **friendlink:** 友链后端与审核流落地 ([10a695b](https://github.com/VOD-Studio/violet/commit/10a695b38a680d0934b36749c75dd3219e00183e))
* **friendlink:** 友链模块（申请制全栈） ([7c1a2e5](https://github.com/VOD-Studio/violet/commit/7c1a2e5edf3c0b7e45b536b7b435048b56117fd7))
* **friends-lab:** 友链页视觉原型实验室 ([3df6a6d](https://github.com/VOD-Studio/violet/commit/3df6a6df1815b11444c0b183b6c934c2dedac20e))


### 修复

* **friend-links:** 修正 ApplyDialog 行首多余空格 ([a9928b9](https://github.com/VOD-Studio/violet/commit/a9928b9a46fddc99198866e1f1303aef5ee64d3a))
* **middleware:** GetClientIP 返回剥离端口的纯 IP ([7778082](https://github.com/VOD-Studio/violet/commit/777808262e283976d6afe59e1f1f5d68a8487496))

## [2.7.0](https://github.com/VOD-Studio/violet/compare/v2.6.1...v2.7.0) (2026-08-11)


### 新增

* **tweets:** 推文功能完整实现 ([1dcfc1b](https://github.com/VOD-Studio/violet/commit/1dcfc1b56faa43a39472c1fce259bb4e745db914))
* **tweets:** 推文评论输入与展示接入表情图片 ([b8ccb40](https://github.com/VOD-Studio/violet/commit/b8ccb40eea298dd489182a95fb89fa7b53ce1e0a))
* **tweets:** 评论展示接入 replies_count 驱动回复区显隐 ([688bd34](https://github.com/VOD-Studio/violet/commit/688bd3417b06b7285aec426c10eaaaef9b0dc4ea))
* **tweet:** 推文评论支持表情与图片 ([9b98b47](https://github.com/VOD-Studio/violet/commit/9b98b47ea2bad6a97dfd9d29982a6f7c018fbffe))
* **tweet:** 评论列表返回回复数 replies_count ([336bea1](https://github.com/VOD-Studio/violet/commit/336bea170d620cba8f7b207d7dc98b4558044d44))
* **tweet:** 评论支持纯图片发布 ([f258766](https://github.com/VOD-Studio/violet/commit/f258766f5abb105b196f9e9bfe545c0e9b514c2b))


### 修复

* **migrations:** 推文迁移重编号为 070-074 解决合并版本冲突 ([3a4bde7](https://github.com/VOD-Studio/violet/commit/3a4bde7f185af187dfaf56a73980b78006c43139))
* **shared-ui:** 无回复的评论不显示「查看回复」toggle ([533c979](https://github.com/VOD-Studio/violet/commit/533c979946f37a14474fc6b88aac33e3a4f78b63))


### 重构

* **shared-ui:** 评论区展示层抽离为公共组件供文章与推文复用 ([1c3b769](https://github.com/VOD-Studio/violet/commit/1c3b769f0f8fc441dd448e98484872a565780bf2))

## [2.6.1](https://github.com/VOD-Studio/violet/compare/v2.6.0...v2.6.1) (2026-08-10)


### 新增

* **command-palette:** 搜索结果增加加载骨架与空状态 ([cc15980](https://github.com/VOD-Studio/violet/commit/cc15980c51e1892f9cdfd3c95f43a77bb2fb8376))
* **domain:** 拆分用户名与显示名并收紧 username 规则 ([96e4efa](https://github.com/VOD-Studio/violet/commit/96e4efa9b65f862f823d711e35ab524ed48d56a9))
* **web:** 前端适配 display_name 拆分与 username 规则收紧 ([7108843](https://github.com/VOD-Studio/violet/commit/7108843eeeda6dd77a4e6003ad0a413b1be4ecd7))


### 修复

* **auth:** beforeLoad 不再基于 getAuthSession 清缓存 ([872061f](https://github.com/VOD-Studio/violet/commit/872061fdde6151c89b108032d8dce1a4fb541e26))
* **auth:** cookie 兜底改用 violet_csrf 并清除 debug 日志 ([8957cef](https://github.com/VOD-Studio/violet/commit/8957cefe6240fd7dbf21017df1fe621604bfcafa))
* **auth:** me 接口补全用户 ID 返回 ([5434a9d](https://github.com/VOD-Studio/violet/commit/5434a9d68c69cc95a3348f4fe0173e8e2539022d))
* **auth:** session 过期时同步清 useMe 缓存消除 Header 假登录 ([90d1701](https://github.com/VOD-Studio/violet/commit/90d17017a7d942e2dcf4f226e135efd58f73d955))
* **auth:** 守卫加 violet_csrf cookie 判定页面刷新后登录态 ([324e626](https://github.com/VOD-Studio/violet/commit/324e6269a404e7352f48bba326912e151b625f97))
* **auth:** 守卫追加 me 缓存兜底防止刷新误踢已登录用户 ([aaff231](https://github.com/VOD-Studio/violet/commit/aaff231a450b68676ed1f52b492d8745e9abc5a6))
* **auth:** 客户端 hydrate 用 cookie 兜底 RPC 探活假阴性 ([1898037](https://github.com/VOD-Studio/violet/commit/1898037c87eaf90d18efc2f18316da636738fda9))
* **command-palette:** 关闭面板时重置输入查询 ([b370a68](https://github.com/VOD-Studio/violet/commit/b370a68986972554693524d5fd8b704125e416cd))
* **dev:** dev-mixed 加 --build 确保新代码进入容器 ([12b9c0b](https://github.com/VOD-Studio/violet/commit/12b9c0b59d98e0c79d6cee66c03bd86d3dd53fbf))
* **domain:** username 测试用例对齐 ASCII-only 规则 ([860a8a0](https://github.com/VOD-Studio/violet/commit/860a8a0f4ce7a64c465440f62b15abbef4ade432))
* **header:** 用户菜单触发器去掉用户名并统一为圆形头像槽位 ([2bb4196](https://github.com/VOD-Studio/violet/commit/2bb4196f7f008959d550bb18bf46efc79b3690b8))
* **profile:** 个人中心 root 角色统一显示为 root ([877e483](https://github.com/VOD-Studio/violet/commit/877e48336d616e379092b342191e51288e0fc269))
* 认证守卫加固与 release/2.0 多项改进整合 ([#128](https://github.com/VOD-Studio/violet/issues/128)) ([c3fa938](https://github.com/VOD-Studio/violet/commit/c3fa93887def241002c0acf3dec82daec6d2c2a7))


### 重构

* **admin-users:** 请求类型收敛到 model 层 ([7b6ba98](https://github.com/VOD-Studio/violet/commit/7b6ba98694a22a141e4003406ae3943a0207f9fe))
* **settings:** 前端同步去除重复字段与 footer_text 归组 ([5e0c9d7](https://github.com/VOD-Studio/violet/commit/5e0c9d7d1b1bb9a0fd0ebc2e68e441dd07ab8012))
* **settings:** 去除基础信息与关于博主的重复字段 ([3a98225](https://github.com/VOD-Studio/violet/commit/3a98225980f51790226261383c696a3d18dac1a5))

## [2.6.0](https://github.com/VOD-Studio/violet/compare/v2.5.3...v2.6.0) (2026-08-10)


### 新增

* **auth:** 登录支持用户名或邮箱 ([7c293d8](https://github.com/VOD-Studio/violet/commit/7c293d8c5b0d10d85aea3efa82d285784229326d))
* **auth:** 登录表单改为账号输入 ([ef68428](https://github.com/VOD-Studio/violet/commit/ef68428d7144e6e3742a8d53a124f3a16c8ed489))
* **command-palette:** 命令面板整合文章搜索并去重触发入口 ([c7d3097](https://github.com/VOD-Studio/violet/commit/c7d3097d4f021cceca3c92b5e658ccedbe8d40b2))
* **post:** 新增前台公开搜索接口 ([3adb781](https://github.com/VOD-Studio/violet/commit/3adb7814066702fe20f1d019a9219b552e8607a6))
* 前台文章搜索与登录账号输入优化 ([de13f25](https://github.com/VOD-Studio/violet/commit/de13f2571a40c7b2d170a9380275eefa0affbf18))

## [2.5.3](https://github.com/VOD-Studio/violet/compare/v2.5.2...v2.5.3) (2026-08-09)


### 修复

* **header:** 优化下拉菜单视觉与 root 用户冗余信息 ([33f181b](https://github.com/VOD-Studio/violet/commit/33f181bbe6a1f798db08b3cb3ce4425759fdf216))
* **header:** 登出按钮去掉 destructive variant 视觉提示 ([eac07fb](https://github.com/VOD-Studio/violet/commit/eac07fba7be383c26fba1c28be54d2584954a210))
* **header:** 锁定用户菜单 trigger 宽度避免登录跳动 ([09c697a](https://github.com/VOD-Studio/violet/commit/09c697a3e12bf993042291fe03efb4f89ba31bba))
* **profile:** 账户信息 Tab 补回图标 ([307a3ae](https://github.com/VOD-Studio/violet/commit/307a3aeb48cf756a787f7778382781d97e59e082))
* **profile:** 账户信息补回行首图标 ([7d523b6](https://github.com/VOD-Studio/violet/commit/7d523b6dd978586e246636fae2292f7524b8a466))


### 重构

* **header:** 重设计用户菜单 Dropdown ([e3ffb11](https://github.com/VOD-Studio/violet/commit/e3ffb114cc5dc5f029dbdda6966de9590063008d))
* **profile:** 统一个人中心卡片样式与字号 ([51df7f7](https://github.com/VOD-Studio/violet/commit/51df7f7ddcd871a5e2f828fb2d381fdadd78fcce))
* **profile:** 重设计个人中心页 ([7106788](https://github.com/VOD-Studio/violet/commit/7106788d05e514411a66f5b3eb62a47c3cbde346))
* 重设计 Header 用户菜单与个人中心页 ([#124](https://github.com/VOD-Studio/violet/issues/124)) ([7b014da](https://github.com/VOD-Studio/violet/commit/7b014da5abc32ea18ce90c06cb9dc711735fbc84))

## [2.5.2](https://github.com/VOD-Studio/violet/compare/v2.5.1...v2.5.2) (2026-08-08)


### 修复

* **command:** 亮色模式命令面板发灰 ([e088c37](https://github.com/VOD-Studio/violet/commit/e088c372ae5ddaea21b6c7eb14b7747da4e6c8b8))
* **header:** 修复刷新瞬间 nav 全部高亮 ([586ac68](https://github.com/VOD-Studio/violet/commit/586ac682aaa6912c1c29ed3103cefd8187f0d2ab))
* **header:** 刷新时不闪过登录按钮再切换登录态 ([44a4078](https://github.com/VOD-Studio/violet/commit/44a40789ea6e7645837eb4d591c4976a16a639f7))
* **web:** LandingHero 按钮 transition 防暗黑刷新闪烁 ([9b9a323](https://github.com/VOD-Studio/violet/commit/9b9a323f0938e9c063b7c1c98d4cf5c5aadbd44d))
* **web:** SSR cookie 读取主题根治暗黑刷新闪烁 ([32f67a9](https://github.com/VOD-Studio/violet/commit/32f67a9b6db6265d51987fc3fc0b2d69fed4c9ee))
* **web:** 主题切换器补全跟随系统模式 ([816126e](https://github.com/VOD-Studio/violet/commit/816126eda506fae1990bc10501a106fad451985b))
* **web:** 缩短主题切换 VT 对页面加载的阻塞 ([2959c42](https://github.com/VOD-Studio/violet/commit/2959c423acbfa913fab17b38feb25ee7bdb5ea66))


### 重构

* **auth:** 登录内联品牌图标替换为共享图标组件 ([269c3f0](https://github.com/VOD-Studio/violet/commit/269c3f0f4d5dc6647d9d5fff170d00d3dffb61aa))
* **shared-ui:** 新增 GitHub 与 Google 图标组件 ([5d15b67](https://github.com/VOD-Studio/violet/commit/5d15b67bd73145438d420a156ffe96d97baca77f))
* **theme-toggle:** 默认变体改为 segmented ([655819f](https://github.com/VOD-Studio/violet/commit/655819fc651ec3aed8a9bbe15d976ba1fc7d5011))
* **web:** 移除 #/* 路径别名统一用 FSD 别名 ([84c60af](https://github.com/VOD-Studio/violet/commit/84c60afeb2d769b4ab6f99e6b064d6a21ad092be))

## [2.5.1](https://github.com/VOD-Studio/violet/compare/v2.5.0...v2.5.1) (2026-08-07)


### 修复

* **admin-subscriptions:** 操作列加宽恢复按钮组 padding ([35d3063](https://github.com/VOD-Studio/violet/commit/35d3063529b10c65c7aea030d2bd7a7abb3b28a1))
* **admin:** 标题行 min-h-9 统一有无 action 页面高度 ([5565fee](https://github.com/VOD-Studio/violet/commit/5565fee3d3b6cb8c935cb58d18bff53cb07ba568))
* **admin:** 筛选栏 Segmented 统一 h-9 高度消除切换抖动 ([ec7a221](https://github.com/VOD-Studio/violet/commit/ec7a2215e8e2936ba2fd051800fed58bdad5a121))
* **admin:** 统一各页面筛选项位置到表格工具栏 ([6bc6eba](https://github.com/VOD-Studio/violet/commit/6bc6eba495dc876954117c31d730d0f384d99641))
* **auth:** 已登录用户访问 /login 自动重定向 ([1f5c882](https://github.com/VOD-Studio/violet/commit/1f5c882c35c1782527c6bda2c34e663757e39e60))
* **feed:** 抓取超时从 15s 调大到 30s ([a41063b](https://github.com/VOD-Studio/violet/commit/a41063b395eb6f35f557f43d2587f63d8f8d81a4))
* **header:** nav 激活态改用显式 pathname 判定 ([dc76adf](https://github.com/VOD-Studio/violet/commit/dc76adf7305b2dba0d9d426040724951e443e1c1))
* **post:** 空 slug 自动按标题生成 ([8955dc3](https://github.com/VOD-Studio/violet/commit/8955dc3f5a50f09cd8c262021bcd3c287ff45c00))
* **subscription:** 抓取事件 success 语义改为整轮无失败 ([1f968e9](https://github.com/VOD-Studio/violet/commit/1f968e9e1627ea432b5eec0467baebac4c74cc35))

## [2.5.0](https://github.com/VOD-Studio/violet/compare/v2.4.8...v2.5.0) (2026-08-07)


### 新增

* **audit:** Actor 增加 actor_type 区分真人与系统操作 ([5da1379](https://github.com/VOD-Studio/violet/commit/5da1379e50b1b333dbe0e07572f7acaff116c218))
* **audit:** 订阅域全部操作补入操作日志 ([af4420f](https://github.com/VOD-Studio/violet/commit/af4420f1ba85e63f43e44c82f6b06e4612b608cb))
* MCP 标签工具与订阅立即拉取及操作日志 ([6929b3a](https://github.com/VOD-Studio/violet/commit/6929b3a86c914a6bfbc50bdfd50abbbc159a704e))
* **mcp:** 新增 create_tag 与 list_tags tool ([8f5307c](https://github.com/VOD-Studio/violet/commit/8f5307c1f42f05b9724e860bccceb11171d78f66))
* **subscription:** 新增立即拉取端点 ([be6dcd1](https://github.com/VOD-Studio/violet/commit/be6dcd1396c272c8b020f7bb0d87075490bfdf74))
* **web:** 操作日志展示系统操作标记 ([2cb779e](https://github.com/VOD-Studio/violet/commit/2cb779e369397cc71635084f09f526ad18637fc4))
* **web:** 订阅管理页新增立即抓取按钮 ([6c1004a](https://github.com/VOD-Studio/violet/commit/6c1004a16b649118671e88731e48429c6bb3ffa9))


### 修复

* **audit:** buildPO 补全 IPAddress 与 UserAgent 赋值 ([#100](https://github.com/VOD-Studio/violet/issues/100)) ([720cbab](https://github.com/VOD-Studio/violet/commit/720cbabf098d75a7fb3b0224b9e7ddcaf80ee28d))
* **web:** 长耗时请求单独加 5 分钟超时 ([db6d385](https://github.com/VOD-Studio/violet/commit/db6d3852fcf4125963d32ddab348a08e48c233a8))


### 重构

* **subscription:** 抓取状态机从 job 提到 service.FetchNow ([1dc7a9c](https://github.com/VOD-Studio/violet/commit/1dc7a9cce6b4671a84d571f7ba7a37582749acc8))

## [2.4.8](https://github.com/VOD-Studio/violet/compare/v2.4.7...v2.4.8) (2026-08-06)


### 修复

* **deploy:** deploy-web always() 与 release 锚点前置 ([#94](https://github.com/VOD-Studio/violet/issues/94)) ([e77c98b](https://github.com/VOD-Studio/violet/commit/e77c98ba457b3687693a9cd04dcec8c67e27741e))

## [2.4.7](https://github.com/VOD-Studio/violet/compare/v2.4.6...v2.4.7) (2026-08-06)


### 修复

* **deploy:** detect 恢复全量拉取修复锚点 tag 解析 ([#91](https://github.com/VOD-Studio/violet/issues/91)) ([8fb8b06](https://github.com/VOD-Studio/violet/commit/8fb8b06c398fab8f7cf64a33a4df56f5a842629b))

## [2.4.6](https://github.com/VOD-Studio/violet/compare/v2.4.5...v2.4.6) (2026-08-06)


### 修复

* **deploy:** npm registry 换国内镜像源 ([#89](https://github.com/VOD-Studio/violet/issues/89)) ([fa44bd3](https://github.com/VOD-Studio/violet/commit/fa44bd312db93495ba6ffc7e218f200b9f1b7624))

## [2.4.5](https://github.com/VOD-Studio/violet/compare/v2.4.4...v2.4.5) (2026-08-06)


### 修复

* **deploy:** 调大 pnpm 下载超时容忍慢链路 ([#87](https://github.com/VOD-Studio/violet/issues/87)) ([6fa555b](https://github.com/VOD-Studio/violet/commit/6fa555b8647d1ef924b55f1cfcaad96ec3246af3))

## [2.4.4](https://github.com/VOD-Studio/violet/compare/v2.4.3...v2.4.4) (2026-08-06)


### 新增

* **editor:** 源码模式改用 CodeMirror 6 替换滚动镜像 ([309e901](https://github.com/VOD-Studio/violet/commit/309e90111d65d72a8f9cd3c4b991c6bd93cf10fb))


### 修复

* **admin:** 文章编辑器移动端布局适配 ([9ccb88f](https://github.com/VOD-Studio/violet/commit/9ccb88fab3be5d0a7b2a2d99e9c4ade010cbcb61))
* **admin:** 文章设置移动端改侧滑抽屉与工具栏排版 ([cc7ec1f](https://github.com/VOD-Studio/violet/commit/cc7ec1f50d732f696029f8dd2fa78fdbf561acd4))
* **admin:** 移除桌面端冗余的文章设置按钮 ([7f14136](https://github.com/VOD-Studio/violet/commit/7f14136f9deaffa1174a5b20207db8593ccf007f))
* **diagram:** mermaid 渲染临时容器改为离屏挂载 ([ff13782](https://github.com/VOD-Studio/violet/commit/ff13782861beeae571158f29124616cc7c63d389))
* **editor:** 源码模式滚动镜像撑开页面产生滚动条 ([6dcb797](https://github.com/VOD-Studio/violet/commit/6dcb7977fdb707c60b70a24d53b631a6a647989f))
* **editor:** 源码模式移动端滚动定位修正 ([86e68a3](https://github.com/VOD-Studio/violet/commit/86e68a30f7cb28dc91befddcb2ae4cdbcb6e40eb))
* **editor:** 编辑器源码模式滚动与移动端布局修复 ([a050496](https://github.com/VOD-Studio/violet/commit/a0504961fb78aef6315aca47fcfaac87c2b1b899))


### 内部维护

* **release:** 强制本次发版为补丁版本 2.4.4 ([4e568a0](https://github.com/VOD-Studio/violet/commit/4e568a0eb59b36300879977c93541a676b0105d7))

## [2.4.3](https://github.com/VOD-Studio/violet/compare/v2.4.2...v2.4.3) (2026-08-06)


### 修复

* **admin:** 后台权限管理修复与 superadmin 语义化重构 ([#81](https://github.com/VOD-Studio/violet/issues/81)) ([591b079](https://github.com/VOD-Studio/violet/commit/591b0794b304316f0fcbedef4e32a0a9f0623665))

## [2.4.2](https://github.com/VOD-Studio/violet/compare/v2.4.1...v2.4.2) (2026-08-05)


### 修复

* **更新日志:** 页面重设计：版本目录导航与阅读位置高亮，移动端横向版本条 ([#77](https://github.com/VOD-Studio/violet/pull/77))
* **更新日志:** 条目清洗与按模块分组——裸链接、任务号不再显示，同模块变更聚合展示
* **更新日志:** 移动端时间线对齐与徽章样式统一

## [2.4.1](https://github.com/VOD-Studio/violet/compare/v2.4.0...v2.4.1) (2026-08-05)


### 修复

* **部署:** 删除 web Dockerfile 对已移除 .npmrc 的 COPY 引用 ([#74](https://github.com/VOD-Studio/violet/issues/74)) ([1022a44](https://github.com/VOD-Studio/violet/commit/1022a448df41aebb488f6dc72eabe17ba8879bba))

## [2.4.0](https://github.com/VOD-Studio/violet/compare/v2.3.0...v2.4.0) (2026-08-05)


### 新增

* **图块:** 全屏模态查看 ([#69](https://github.com/VOD-Studio/violet/issues/69))
* **图块:** 移动端双指捏合缩放 ([#68](https://github.com/VOD-Studio/violet/issues/68))
* **图块:** 阅读端导出 SVG / PNG ([#67](https://github.com/VOD-Studio/violet/issues/67))
* **图块:** 缩放平移与交互开关
* **图块:** 加载占位与失败降级重设计
* **图块:** 键盘可访问性与 aria-label 语义化 ([#71](https://github.com/VOD-Studio/violet/issues/71))


### 修复

* **页头:** 导航绝对定位消除左右抖动
* **页头:** 背景常驻修复刷新后非顶部位置背景丢失
* **主题:** 多图块页面切换主题时卡死
* **目录:** 异步内容撑开后重算激活标题
* **目录:** "Contents" 汉化为"目录"

## [2.3.0](https://github.com/VOD-Studio/violet/compare/v2.2.1...v2.3.0) (2026-08-03)


### 新增

* **网站:** 更新日志页 /changelog 与 about 页入口卡片（含骨架屏与错误重试）


### 修复

* **发版:** 更新日志条目去重，去掉 commit hash 引用

## [2.2.1](https://github.com/VOD-Studio/violet/compare/v2.2.0...v2.2.1) (2026-08-02)


### 修复

* **订阅:** 抓取时回填订阅源标题 ([704a52a](https://github.com/VOD-Studio/violet/commit/704a52abbe6b5c26aea032b8ae633593b738b44f))

## [2.2.0](https://github.com/VOD-Studio/violet/compare/v2.1.3...v2.2.0) (2026-08-02)


### 新增

* **announcement:** 公告创建/更新/删除事件（含 ID 回填） ([1f641dd](https://github.com/VOD-Studio/violet/commit/1f641dd307ac3b9b05ea01854bda6a3ba51d13b7))
* **api-token:** PAT 签发/吊销审计（凭据生命周期） ([378c437](https://github.com/VOD-Studio/violet/commit/378c437b044b41b9c7d8248b778807f2e848d4e7))
* **audit:** append-only AuditEventPO + EventStore GORM 实现 ([b623e6f](https://github.com/VOD-Studio/violet/commit/b623e6f27d4da20cf4d18d5e23272856a8803226))
* **audit:** AuditEvent JSON 序列化 + 查询筛选（ListFiltered + Query 用例） ([e707bd3](https://github.com/VOD-Studio/violet/commit/e707bd340ba4ffbb506356d901b2e1b572fba929))
* **audit:** HTTP handler + /admin/logs 路由 + OpenAPI 重建 ([e7310e4](https://github.com/VOD-Studio/violet/commit/e7310e4d9db71e5ecbecd08d4edaa4a07440fa44))
* **audit:** useradmin 操作发布领域事件（特权操作审计闭环） ([6bc1155](https://github.com/VOD-Studio/violet/commit/6bc1155ad59f4195c1eacc510711d9a349b4087e))
* **audit:** 审计订阅者消费领域事件写入 audit_events ([0887583](https://github.com/VOD-Studio/violet/commit/088758341ae0d032e6c5fb5414e2407fd7aea774))
* **audit:** 操作日志模块推倒重做——事件驱动审计基础设施 ([4e354c2](https://github.com/VOD-Studio/violet/commit/4e354c2c3a2a23b5469144b0727e008d98c75ffc))
* **audit:** 数据库迁移 064 drop audit_logs + 065 create audit_events ([240bc63](https://github.com/VOD-Studio/violet/commit/240bc63fb94cc2023865c5747fa276f59fc0afb6))
* **audit:** 结构化 AuditEvent + 受控 Action 枚举 ([5df5007](https://github.com/VOD-Studio/violet/commit/5df5007c2533781143976e0d4ed5cd67755f9aff))
* **audit:** 订阅者映射 auth 登录/登出/失败事件 ([53795f4](https://github.com/VOD-Studio/violet/commit/53795f48a060e19131476610d35c6fa23c97e88d))
* **audit:** 订阅者映射 comment/PAT/settings 事件 ([aade746](https://github.com/VOD-Studio/violet/commit/aade746848e5a6684d686c79b7f4d2248af15245))
* **audit:** 订阅者映射 post/role/announcement 事件 ([7ec661a](https://github.com/VOD-Studio/violet/commit/7ec661aafe6e90c1a6453780e0ae963858810df5))
* **audit:** 领域事件补全资源快照与 before/after（review [#58](https://github.com/VOD-Studio/violet/issues/58) 修复） ([4d60e4f](https://github.com/VOD-Studio/violet/commit/4d60e4f7c0f75bae5e03a1e0ce45dd4385419adc))
* **auth:** login/logout/verify 发布领域事件（审计接入） ([98298e7](https://github.com/VOD-Studio/violet/commit/98298e78109e9fb641b090646bae1ae915e92b08))
* **comment:** 评论审核审计（Approve/Spam/Delete + 批量） ([9c4579d](https://github.com/VOD-Studio/violet/commit/9c4579d196b203acd7b492ae574fea87708b5eed))
* **eventbus:** EventBus 加 Subscribe 机制，激活领域事件分发 ([268977f](https://github.com/VOD-Studio/violet/commit/268977ff39ab7ab8ee3d6d8a8fae178471e207cb))
* **post:** 文章状态变更事件（发布/归档/回退草稿） ([bfc1d2d](https://github.com/VOD-Studio/violet/commit/bfc1d2d39283251469c07eaf5db36246f9138393))
* **role:** 角色更新/删除事件（含创建事件 ID 修复） ([1968f0e](https://github.com/VOD-Studio/violet/commit/1968f0e653012b3c132c42e73ec99f479a9ea35a))
* **settings:** 站点配置变更审计（SettingsUpdated 事件） ([b002297](https://github.com/VOD-Studio/violet/commit/b0022970b1fd533942d0425d9a44cbac1c5a4815))
* **user:** 用户聚合根状态变更事件（角色/状态/用户名/删除/批量） ([8edfdc7](https://github.com/VOD-Studio/violet/commit/8edfdc775afc42227caf570a1ca8498980f2fe63))
* **web:** 操作日志页适配新 AuditEvent 读模型 ([467b28c](https://github.com/VOD-Studio/violet/commit/467b28c5892848aae55756d32ea8da2c0c5915ae))


### 修复

* **audit:** 空值写入 uuid/jsonb 列失败修复（e2e 发现） ([810d629](https://github.com/VOD-Studio/violet/commit/810d6292b5b3a3d2469133399c706703b9455e23))
* **audit:** 订阅者映射快照字段 + 登录/注册审计修复（review [#58](https://github.com/VOD-Studio/violet/issues/58)） ([e807700](https://github.com/VOD-Studio/violet/commit/e807700357c18221acac3a50d93364672e4d4234))
* **eventbus:** 合并双 bus 实例 + Publish 死锁修复 ([f5704a0](https://github.com/VOD-Studio/violet/commit/f5704a0ac336370eec1cf20a0c7007dc47202d60))
* **role:** 修复权限断言顺序依赖（flaky 测试，CI 撞出） ([d4600f7](https://github.com/VOD-Studio/violet/commit/d4600f73ff5a2df50123e6075743a22b8a6fbcb7))


### 重构

* **audit:** 删除旧 audit 服务/存储/handler 装配（前置 [#49](https://github.com/VOD-Studio/violet/issues/49)/[#11](https://github.com/VOD-Studio/violet/issues/11)） ([c365b68](https://github.com/VOD-Studio/violet/commit/c365b68f9127d76b934df1394b6d08de064aa5e1))
* **audit:** 清理 review 发现的注释违规与读路径 panic ([6a81488](https://github.com/VOD-Studio/violet/commit/6a81488e52af084e0f63a80a862826dd2f1aa960))


### 文档

* **prd:** 沉淀操作日志重构 PRD-0010 ([c0e4a7c](https://github.com/VOD-Studio/violet/commit/c0e4a7c2690b09bf08426a36986f35afa6cd277b))
* **prd:** 重写 PRD-0010 为事件驱动 audit 推倒重做方案 ([aaa1402](https://github.com/VOD-Studio/violet/commit/aaa1402266709d62bc6abbecab344441d9cf9a6c))

## [2.1.3](https://github.com/VOD-Studio/violet/compare/v2.1.2...v2.1.3) (2026-08-02)


### 文档

* **changelog:** 更新描述,移除已删除的 generate-release-notes 引用 ([#36](https://github.com/VOD-Studio/violet/issues/36)) ([215569c](https://github.com/VOD-Studio/violet/commit/215569c2dbd36d34f85b69ce370a382e5a7ee02f))

## [2.1.2](https://github.com/VOD-Studio/violet/compare/v2.1.1...v2.1.2) (2026-08-02)


### 修复

* **ci:** release-please changelog 从 github 原生改为 release-please 原生 ([#34](https://github.com/VOD-Studio/violet/issues/34)) ([e8ad47c](https://github.com/VOD-Studio/violet/commit/e8ad47ca9f49832d8a6b12af14f5d93561f412c1))

## 2.1.1 (2026-08-02)

<!-- Release notes generated using configuration in .github/release.yml at release/2.0 -->

## What's Changed
### 重构
* refactor(domain): TagRepository 接口从 entity.go 拆到 repository.go by @xunrua in https://github.com/VOD-Studio/violet/pull/32
### 其他
* [release] Release notes 切换为 GitHub 原生生成器 by @xunrua in https://github.com/VOD-Studio/violet/pull/24
* [app] main.go 装配层与路由架构治理 by @xunrua in https://github.com/VOD-Studio/violet/pull/23


**Full Changelog**: https://github.com/VOD-Studio/violet/compare/v2.1.0...v2.1.1

## [2.1.0](https://github.com/VOD-Studio/violet/compare/v2.0.4...v2.1.0) (2026-08-01)


### ✨ 新增

* **about:** About 页重设计 + 更新日志（PRD-0009） ([#7](https://github.com/VOD-Studio/violet/issues/7)) ([b718fbe](https://github.com/VOD-Studio/violet/commit/b718fbec809103cec0564a4f06307d9f176a73c6))


### 👷 CI

* **release-please:** 升级 action v4→v5(Node 24 运行时) ([#5](https://github.com/VOD-Studio/violet/issues/5)) ([fa5a5c6](https://github.com/VOD-Studio/violet/commit/fa5a5c6c53482421fa1a64f4144f28bd3b50607b))

## [2.0.4](https://github.com/VOD-Studio/violet/compare/v2.0.3...v2.0.4) (2026-07-30)


### 🐛 修复

* **media:** 补注册 admin 组批量删除路由修复 405 ([#3](https://github.com/VOD-Studio/violet/issues/3)) ([f5eff6f](https://github.com/VOD-Studio/violet/commit/f5eff6fa2413c87c8f8c67fd8a57f24e972e6ad1))

## [2.0.3](https://github.com/VOD-Studio/violet/compare/v2.0.2...v2.0.3) (2026-07-30)


### 📝 文档

* **changelog:** 重写 v2.0.0 段落 ([f378a4d](https://github.com/VOD-Studio/violet/commit/f378a4dfaeff0ea3ab8dec72decee2a204dac8b6))


### 👷 CI

* 升级 setup-node v4→v7 与 pnpm/action-setup v4→v6 消除 Node 20 警告 ([54540df](https://github.com/VOD-Studio/violet/commit/54540dfbafe9c9d025fffa45d10b31222cdf5559))
* 清理旧发版系统残留 + 修复 CHANGELOG 配置 + nginx reload ([96e0099](https://github.com/VOD-Studio/violet/commit/96e00991fd8f984ed90b34f31629074185629568))

## [Unreleased]

> 未发版的改动。push 发版型 commit（feat/fix 等）到 `release/2.0` 后，release-please 自动开 release PR，合并即发版。

## [2.0.2](https://github.com/VOD-Studio/violet/compare/v2.0.1...v2.0.2) - 2026-07-30

### 🐛 修复

- **ci:** release-please 改用 manifest 配置文件(v4 不再支持内联参数) ([e8218cf](https://github.com/VOD-Studio/violet/commit/e8218cf6075d557f870219850f4d0ea41a75b69a))
- **ci:** release-please 用 PAT 绕过组织 GITHUB_TOKEN 创建 PR 限制 ([2ce1386](https://github.com/VOD-Studio/violet/commit/2ce1386843c7122320651562226c43116837f6f4))

## [2.0.1] - 2026-07-30

CI/CD 基础设施修复版本。rebrand（mimo-blog → violet）后遗留的部署链路不一致问题集中修复，并正式接入 release-please 自动发版与 self-hosted runner 自动部署。

### 🐛 修复

- **CI 镜像名统一**：deploy.yml 与 docker-compose.ci.yml 的镜像名从 `blog-api` 统一为 `violet-api`，与 docker-compose.prod.yml 对齐（rebrand 时漏改 CI 路径导致手动/CI 部署镜像名不一致）
- **网络名规范化**：`blog_network` → `violet_network`（mimo-blog 迁移残留），同步 patch-nginx-api.sh 与部署文档
- **CORS 启动门禁**：docker-compose.prod.yml 新增 `CORS_ALLOWED_ORIGINS` 强制检查（compose `:?` 语法）与 `COOKIE_SECURE=true` 生产安全基线

### ♻️ 重构

- **配置架构收敛**：配置链收敛为 `env > .env > config.yaml > 默认值` 单链，部署目录收敛到根 `.env` 单一来源（api/.env 废弃），config.yaml 入库随镜像分发
- **环境变量架构**：根 `.env.example` 成为唯一模板，启动时 tabwriter 对齐打印 50 项配置来源

### 👷 CI

- **release-please 自动发版**：push release/2.0 自动开 release PR（含 CHANGELOG 段落），合并即打 tag 触发部署；PAT 绕过组织 GITHUB_TOKEN 创建 PR 限制
- **deploy.yml 扩展**：支持 api+web 原子部署，新增 web 镜像构建 + sync-client 静态资源同步 + web 健康检查；`component` 输入支持单组件回滚（api/web/both）
- **self-hosted runner**：接入 GitHub Actions self-hosted runner（标签 `rua`，root 身份），本地 podman-docker 兼容层让 CI 用标准 docker 命令
- **actions/checkout v4 → v7**：消除 Node 20 弃用警告
- 废弃本地 `scripts/release.sh` + `make release*` + commit-and-tag-version 依赖，发版统一走 release-please

## [2.0.0] - 2026-07-30

violet（原 mimo-blog）仓库迁移到 VOD-Studio 后的首个正式 release，沉淀了从项目脚手架到完整博客平台的全部开发成果（2093 个 commit）。这是一个全栈博客平台的成型版本。

### ✨ 新增 — 核心平台

- **文章系统**: 基于 Tiptap 的富文本编辑器（bubble menu、代码块高亮、封面图、Markdown 导入导出）、文章 CRUD、回收站、草稿与发布流程
- **评论双轨制**: 底部匿名留言板 + 文内批注，双轨认证与匿名配额（黑洞 + 验证码）
- **用户与权限**: 角色 + 权限树管理、超级管理员、OAuth 登录（Google / GitHub）、PAT 个人访问令牌
- **素材管理**: 媒体库（分片上传、视频封面截取、PDF/音频/图片预览）、素材选择器

### ✨ 新增 — 后台管理

- **管理控制台**: DataTable 全家桶（分页、批量操作、CSV 导出）、服务器监控面板、操作日志（audit）、站点设置、公告、标签、项目管理
- **侧边栏导航**: 品牌区、菜单分组、激活指示条、收起模式

### ✨ 新增 — 高级功能

- **MCP 集成**: 文章/评论检索 tool、匿名公开只读 server（violet-reader）、客户端接入面板与配置生成
- **RSS 订阅**: 订阅源管理、定时抓取调度器、Feed 解析与去重
- **图块与流程图**: Mermaid 流程图渲染、可运行代码块沙箱执行（python/node/go/rust/bun）
- **SEO 与发现**: sitemap、canonical URL、OpenGraph meta、转载来源标记

### ♻️ 重构 — 架构演进

- **认证架构**: opaque session（Redis 后端）+ CSRF double-submit，公开页 SSR 直出
- **路由**: 迁移到 `@tanstack/react-router`，类型安全路由树 + `beforeLoad` 守卫
- **后端 DDD**: 按领域划分四层（domain/application/infrastructure/interfaces），wire 依赖注入
- **SSR**: TanStack Start + Vite，`server.mjs` 桥接 node:http，nginx 直接服务静态资源

### 👷 部署

- 生产 docker-compose（postgres + redis + api + web SSR），nginx-proxy 反代 + Let's Encrypt
- self-hosted runner 本地构建，podman-docker 兼容层

## [1.0.1] - 2026-06-16

> 此 tag 在仓库迁移时丢失，内容为迁移前的早期版本。详见迁移前的历史仓库。

### 修复
- **web**: 修复 `$RefreshSig$ is not defined` (pnpm hoist 导致 React Fast Refresh
  preamble 注入失败) — [9dc66ae](https://example/9dc66ae)
- **web**: 降级 `@vitejs/plugin-react` v6→v5，适配 Fast Refresh preamble — [0753132](https://example/0753132)
- **web**: 降级 Vite v8→v7（v8 为前沿版本，plugin-react 未完全适配），
  彻底解决 `$RefreshSig$ is not defined` 问题 — [c751227](https://example/c751227)

> 补丁版本，不含功能变更。

## [1.0.0] - 2026-06-16

### 重构 — DDD 架构迁移（P0-P3）

#### P0 致命修复与安全加固
- **安全**: 移除 docker-compose 与 .env.example 中的硬编码数据库凭据 `super@123`，
  改为 `${VAR:?msg}` 必填校验
- **基础设施**: 修复 Makefile 死引用 `load-config.sh`；新增 `cmd/migrate` 迁移 CLI；
  数据库连接池配置（MaxOpenConns/MaxIdleConns/ConnMaxLifetime）
- **可观测性**: 新增 RequestID 中间件，日志带 `request_id` 字段打通链路追踪
- **前端**: 开启 TypeScript strict 模式；修复 `adminLoader` 重定向失效；
  修正 Redux→Zustand 文档失真

#### P1 DDD 架构奠基
- **领域层**: `internal/domain/` 四层骨架（shared 基类 + user/role/permission 聚合），
  AggregateRoot/DomainEvent/DomainError/ID/Timestamps 完整基础设施
- **应用层**: `internal/application/` CQRS command/query 用例 + EventBus/UnitOfWork 端口
- **基础设施层**: `internal/infrastructure/` GORM repository + 进程内事件总线
- **接口层**: `internal/interfaces/` HTTP handler + 统一错误翻译中间件
- **依赖注入**: 引入 google/wire 编译期代码生成
- **前端**: 路由 React.lazy 懒加载 + ErrorBoundary + env 集中化
- **工程化**: .editorconfig + .golangci.yml + LICENSE(MIT) + README + CONTRIBUTING +
  纯 shell Git 钩子（pre-commit gofmt）
- **包管理**: 迁移到 pnpm，修复 npm workspace 探测 bug

#### P2 全业务模块 DDD 迁移
- **9 个模块**全部迁移到 DDD 四层架构:
  - user/auth: JWT(ES256) + Redis(refresh token/验证码) + 9 CQRS 用例
  - role/permission: RBAC 权限系统 + 33 预定义权限常量
  - post: 文章状态机(draft/published/archived) + slug 唯一性 + 标签关联
  - comment: 物化路径嵌套(depth≤4) + JSONB 图片 + emoji 反应
  - announcement/project: 简化 DDD(CRUD 合一)
  - emoji/music/upload: 完整 domain + GORM repository
- **全 GORM AutoMigrate**: model struct 即 schema，废弃 sqlc 手写 SQL
- **测试**: 26 domain 单测 + 20 集成测 + 16 application mock 测 + 16 前端单测
- **影子路由**: DDD 路由通过 `/ddd/` 前缀与旧路由并存运行
