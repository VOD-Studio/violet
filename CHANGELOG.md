# Changelog

本项目所有重要变更记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本管理遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

v2.0.0 之前手工维护；v2.0.1 起由 [release-please](https://github.com/googleapis/release-please) 自动维护。分类由 `release-please-config.json` 的 `changelog-sections` 按 Conventional Commit type 归类。

## [2.8.18](https://github.com/VOD-Studio/violet/compare/v2.8.17...v2.8.18) (2026-08-27)


### 新增

* **admin-emojis:** 用户自定义表情接入表情管理页 ([2fc9b3b](https://github.com/VOD-Studio/violet/commit/2fc9b3b8bfd89d6d2d872cb8e4783d06c341bffd))
* **admin-series:** 系列书管理端（T3） ([80ec7ed](https://github.com/VOD-Studio/violet/commit/80ec7ed2c53e3b70e856d0d3f6b952fdf7471575)), closes [#262](https://github.com/VOD-Studio/violet/issues/262)
* **apitoken:** PAT 支持 MCP 交互偏好 interactive ([be17b94](https://github.com/VOD-Studio/violet/commit/be17b94bb3d312b94161f4766f7d4114dbaa3d27))
* **chat:** 发出的图片消息按输入流图文环绕渲染 ([ea4010c](https://github.com/VOD-Studio/violet/commit/ea4010caf78801fd3646343aef8dbb745efc08e1))
* **chat:** 图片消息支持单条多图 ([8731404](https://github.com/VOD-Studio/violet/commit/87314042b2f512073030b7b34a5d9daae2084e39))
* **chat:** 完善聊天消息与表情交互 ([#274](https://github.com/VOD-Studio/violet/issues/274)) ([e0d3e1d](https://github.com/VOD-Studio/violet/commit/e0d3e1da4e7677bb9c91af408df54b97f6050920))
* **chat:** 引用预览剥离内联图片占位符 ([e559a5f](https://github.com/VOD-Studio/violet/commit/e559a5f7b282dc7884357ff325fe6dc399e42ae7))
* **chat:** 支持发送者重新编辑消息 ([b8d8a24](https://github.com/VOD-Studio/violet/commit/b8d8a241ff846d7eaf140d0e4a80636121198e81))
* **chat:** 新消息接入站内通知中心 ([74598b6](https://github.com/VOD-Studio/violet/commit/74598b6da77e6df428684f0d92a6d130e4182fb8))
* **chat:** 消息内联编辑与已编辑标识 ([6f28032](https://github.com/VOD-Studio/violet/commit/6f2803282313e5d53e0d627a793eaed256a10039))
* **chat:** 消息内自定义表情按大表情档渲染 ([78e87b7](https://github.com/VOD-Studio/violet/commit/78e87b78c2237a1462616857e3134906ad2f9f54))
* **chat:** 消息列表支持滚动加载历史记录 ([fc2e5a8](https://github.com/VOD-Studio/violet/commit/fc2e5a8abeab822d196fe2d9cf34b900c67aea46))
* **chat:** 消息界面按即时通讯排版重构 ([d2638ab](https://github.com/VOD-Studio/violet/commit/d2638ab519c14d610664e3d8596d62595ddd7aeb))
* **chat:** 聊天事件流挂载到站点头部 ([f8d646d](https://github.com/VOD-Studio/violet/commit/f8d646df8bb810308d960a46c8ea8e7c8612d7a1))
* **chat:** 输入框多图合并为单条消息发送 ([10b0440](https://github.com/VOD-Studio/violet/commit/10b0440a2417b26f6cceaad9751ad5b915d23c01))
* **comments:** RichCommentInput 支持预填已上传图片 ([045e01f](https://github.com/VOD-Studio/violet/commit/045e01fac41fdf22c3157b72d468e61e6c9f0503))
* **comments:** 扩展富文本输入组件支持 inline 药丸布局 ([7af2706](https://github.com/VOD-Studio/violet/commit/7af2706613f418cb5862adde44bf51e13f8514b4))
* **customemoji:** 后台自定义表情分页列表接口 ([396efbc](https://github.com/VOD-Studio/violet/commit/396efbc54abf71435f47b4aa21a9c47a8e84ddd0))
* **emojis:** 放大「我的表情」网格为 6 列 ([92b380c](https://github.com/VOD-Studio/violet/commit/92b380c1aa05af549c292bb00586b7f9c582b173))
* **emojis:** 表情选择器打开时默认选中「我的」 ([e972dd5](https://github.com/VOD-Studio/violet/commit/e972dd5e44ff59a109a5e58df082831f26d5381e))
* **llm:** 支持 OpenAI images 协议文生图 ([6ae15cd](https://github.com/VOD-Studio/violet/commit/6ae15cda01fa6a188ca334495c282a0eb6c8e412))
* **notifications:** 铃铛支持聊天消息通知 ([b623fd0](https://github.com/VOD-Studio/violet/commit/b623fd069bbab0b6bd7ca70eddfeb63f1927509c))
* **series:** AI 生图支持建书创建态 ([789342d](https://github.com/VOD-Studio/violet/commit/789342d0aeee47a87848e8867331571ab4c34a44))
* **series:** AI 生成书籍封面（T5） ([ebc1867](https://github.com/VOD-Studio/violet/commit/ebc1867c5bf9172b0462f81bdc2092f3346e1c01))
* **series:** MCP 接入 violet-posts 与 violet-reader（T6） ([11fd426](https://github.com/VOD-Studio/violet/commit/11fd426a940e9b95e15ce5856fbcffeaae26a6a6))
* **series:** 书籍聚合分卷与目录 API（T1） ([92848ff](https://github.com/VOD-Studio/violet/commit/92848ff595177725757b29fd2dda903006ba5b73)), closes [#260](https://github.com/VOD-Studio/violet/issues/260)
* **series:** 前台书架与阅读器导航（T2/T4） ([e20b1c3](https://github.com/VOD-Studio/violet/commit/e20b1c3494863c0c787c0b9c3074f0c91ca1027d))
* **series:** 接入 AI 封面生成前端并修正错误呈现 ([4c6f64a](https://github.com/VOD-Studio/violet/commit/4c6f64a29934841f2100189933673d41ad03f70f))
* **series:** 文章合订成书（PRD-0021 T1-T4） ([7a2a868](https://github.com/VOD-Studio/violet/commit/7a2a868938353406f07da66975a3262956115833))
* **series:** 重做在线书籍体验原型 ([97aad3d](https://github.com/VOD-Studio/violet/commit/97aad3d7458ee950074cc292bc8ee7385970fcbc))
* **shared-ui:** Segmented 支持胶囊圆角形态 ([085b488](https://github.com/VOD-Studio/violet/commit/085b4886c2fbfecc047c11aa4ac5aea938f1b0c0))
* **shared-ui:** 新增内容区统一错误状态组件 InlineError ([e912c2a](https://github.com/VOD-Studio/violet/commit/e912c2ab0a29c4dad5d8a6e2b530929f48988952))


### 修复

* **auth:** .env 新键追加顺序不稳定 ([994c6cd](https://github.com/VOD-Studio/violet/commit/994c6cdf7939569782a4ec9bcf6f0f72255c28f8))
* **auth:** 401 拦截器不再提前清除 sessionActive ([acd436f](https://github.com/VOD-Studio/violet/commit/acd436f1015dd13966556e4a480a419c295be2b5))
* **auth:** 修复 OAuth 配置写入顺序 ([c1f1c51](https://github.com/VOD-Studio/violet/commit/c1f1c519f2c3abc4bd09f57782b9b891984f4a20))
* **chat:** 修复服务 lint 检查失败 ([f81d3fd](https://github.com/VOD-Studio/violet/commit/f81d3fd3efd20f542c0b5fd34ec95d3c1fec42d7))
* **chat:** 内联图片占位符不再误判为自定义表情 token ([028c50b](https://github.com/VOD-Studio/violet/commit/028c50b7f1dde19bfd6daa5c718ca58c698e7cb6))
* **chat:** 前端事件类型补充 conversation.created ([366b2e8](https://github.com/VOD-Studio/violet/commit/366b2e8cb041fcdc9db5c495584021f5125e9d9b))
* **chat:** 回复预览与会话列表摘要剥离表情占位符 ([8f8be69](https://github.com/VOD-Studio/violet/commit/8f8be69642fc32ba1c98540c32c8193125dd565b))
* **chat:** 图片消息渲染说明文字 ([f0cf032](https://github.com/VOD-Studio/violet/commit/f0cf0324b6b866588126414dfc8b5d27598a0ca0))
* **chat:** 引用预览剥离表情占位符，避免裸吐 token 文本 ([fc642aa](https://github.com/VOD-Studio/violet/commit/fc642aa94c86f3cc544d406ddeac7840f310d875))
* **chat:** 私聊创建实时通知对端 ([6e7cb3c](https://github.com/VOD-Studio/violet/commit/6e7cb3c47b1dfc7ab2c9ad6cd66c15542550766a))
* **chat:** 窄气泡消息溢出导致横向滚动条 ([3a233f7](https://github.com/VOD-Studio/violet/commit/3a233f7b050b4f6d0a3c2cdaf6ca2209f01360e9))
* **chat:** 详情抽屉与聊天区开关动画同步 ([44c821b](https://github.com/VOD-Studio/violet/commit/44c821ba689d8949c5f995e768fb15cc548f9bd2))
* **comments:** 修复图片上传完成替换后光标跳到图片左侧 ([fa37f55](https://github.com/VOD-Studio/violet/commit/fa37f55387a6cab29feb16f4159ee15ea48b6580))
* **customemoji:** 表情名称禁用 markdown 语法字符 ([9e99697](https://github.com/VOD-Studio/violet/commit/9e99697f398b2fd579e5c361cfef1e5d49d9f300))
* **emojis:** 上传表情时拦截含 markdown 语法字符的名称 ([19f9a35](https://github.com/VOD-Studio/violet/commit/19f9a35e227b4ee1bfda744b5a134b5c93e5d6ea))
* **migrations:** 修复聊天迁移版本号 092 冲突 ([29112b7](https://github.com/VOD-Studio/violet/commit/29112b797054afa33c8e6717365fc02bd2a6aad2))
* **series:** 书籍详情补最近章节时间 ([d00750b](https://github.com/VOD-Studio/violet/commit/d00750baf57cf0a9a7e6e10cbb44f4289e9a8f8b))
* **series:** 优化无图书籍封面 ([a1583c5](https://github.com/VOD-Studio/violet/commit/a1583c561c723cd032bbbfebe646516a3a664d59))
* **series:** 优化无图书籍封面 ([c403aa9](https://github.com/VOD-Studio/violet/commit/c403aa93cd6ffd6b027975c0fbadae8a7454dc0d))
* **series:** 优化立体书籍样式 ([85c0917](https://github.com/VOD-Studio/violet/commit/85c0917956d04b8ed2dceffddebedf35f8344eda))
* **series:** 修复 PR [#271](https://github.com/VOD-Studio/violet/issues/271) 第三轮评审缺陷 ([18655df](https://github.com/VOD-Studio/violet/commit/18655df49277c17b1f671b051490a42380a97f05))
* **series:** 修复 PR [#271](https://github.com/VOD-Studio/violet/issues/271) 第二轮评审缺陷 ([2798d87](https://github.com/VOD-Studio/violet/commit/2798d872b61d7a2c24dd8b514e585f79f662274b))
* **series:** 修复 PR [#271](https://github.com/VOD-Studio/violet/issues/271) 评审指出的正确性问题 ([566df78](https://github.com/VOD-Studio/violet/commit/566df78c9443095767b8e9ba36d134f6cadde5c0))
* **series:** 增强书籍封面质感 ([75e6918](https://github.com/VOD-Studio/violet/commit/75e691843b690747f38edc68954c9bbe21801371))
* **series:** 封面校验放行站内相对路径 ([900d60a](https://github.com/VOD-Studio/violet/commit/900d60a56361b224d3fb412561f7dbdbfb1ae214))
* **series:** 收敛书籍封面底边 ([f30b3b7](https://github.com/VOD-Studio/violet/commit/f30b3b788736fddfdce0644faf80f43d656b8145))
* **series:** 统一原型主题配色 ([a7fd498](https://github.com/VOD-Studio/violet/commit/a7fd498bf1dd3e19e4c5daaa58c4baba4767a737))
* **series:** 重构实体书封视觉 ([9cf6061](https://github.com/VOD-Studio/violet/commit/9cf60610fb5d927bee6e1c32d2081a89c6cc3aae))


### 重构

* **chat:** ChatWorkspace 按职责拆分为独立组件文件 ([fcad1ce](https://github.com/VOD-Studio/violet/commit/fcad1cec98d7c91e3dd46b3c037767de60f0c347))
* **chat:** 聊天消息移出站内通知中心 ([f5baf5b](https://github.com/VOD-Studio/violet/commit/f5baf5b3a5237470f82719dea699bc9b685cb323))
* **notifications:** 铃铛移除聊天消息条目 ([598a6e6](https://github.com/VOD-Studio/violet/commit/598a6e6ffb30a84e96f9d7b903de4e0f259b6d4d))
* **series:** 书籍原型表面切换复用 Segmented ([71a8d55](https://github.com/VOD-Studio/violet/commit/71a8d55f7318eca50d3ffa8907b26bd288a54e8f))

## [2.8.17](https://github.com/VOD-Studio/violet/compare/v2.8.16...v2.8.17) (2026-08-24)


### 新增

* **mascot:** 聚光特效改为驱动舞台真实灯光 ([33fc1a7](https://github.com/VOD-Studio/violet/commit/33fc1a72deb39ad98a5bf3da347f38553cf07e3f))
* **mascot:** 重设实验室标题与无边框控件 ([ebf8fc1](https://github.com/VOD-Studio/violet/commit/ebf8fc1f097c03253411a5de34148c7647acf717))
* **mascot:** 重设计堇喵动作室 ([669ae67](https://github.com/VOD-Studio/violet/commit/669ae673d69696b01c57df709d99378d31ab13ef))
* **mascot:** 重设计实验室工作台界面 ([62297b6](https://github.com/VOD-Studio/violet/commit/62297b6229f36e9c64e07140fd48bb1e79ac1327))
* **mascot:** 重设计实验室工作台界面 ([6993c20](https://github.com/VOD-Studio/violet/commit/6993c2003a6323e203a06e47e3fc1035fe140dfb))
* **mascot:** 重设计舞台特效与导演台 ([479d6fe](https://github.com/VOD-Studio/violet/commit/479d6fe46a1cbd287b3bb0922d1a7e848329d424))
* **mascot:** 重设计舞台特效控制区 ([bc14a38](https://github.com/VOD-Studio/violet/commit/bc14a3897e0229eddb70a8f3a3c2dbb2ff995c0d))
* **mascot:** 重设计黑盒舞台 ([1562eb1](https://github.com/VOD-Studio/violet/commit/1562eb1238fdafdbbace5f381f31f567440b8190))


### 修复

* **lab:** 调整各实验室页面的内边距 ([4d5af52](https://github.com/VOD-Studio/violet/commit/4d5af520f9ce02e242f3a117e1f092ae53ca7bf3))
* **mascot:** 优化表情卡片选中反馈 ([10c8ce2](https://github.com/VOD-Studio/violet/commit/10c8ce2c9770b6c26d2b829d733a1f7ed4ff58a5))
* **mascot:** 保持尾巴位于身体后层 ([aeec463](https://github.com/VOD-Studio/violet/commit/aeec463f62bef98fa19e45d799ee733d77751302))
* **mascot:** 修复浅角度旋转耳朵淡出 ([595b1f1](https://github.com/VOD-Studio/violet/commit/595b1f172e707a7710cbbdb5a8b26850ce816ece))
* **mascot:** 修正侧视旋转层级 ([2d950f2](https://github.com/VOD-Studio/violet/commit/2d950f2a6ead0e2063bd52af95d5a293801d090b))
* **mascot:** 修正背面尾巴层级 ([f90a8b8](https://github.com/VOD-Studio/violet/commit/f90a8b86a8c2c8c5e2b6231067d1aa0771351649))
* **mascot:** 分离舞台与导演台 ([647ff16](https://github.com/VOD-Studio/violet/commit/647ff16716bfdb3eaba6bc47a295f948e5e216ca))
* **mascot:** 加强偏航静态帧的侧面可读性 ([46f7be3](https://github.com/VOD-Studio/violet/commit/46f7be33443457fae7ebe4c0f842440c63709bbc))
* **mascot:** 固定移动端工作台高度避免切换跳动 ([063bea6](https://github.com/VOD-Studio/violet/commit/063bea66392e6e7f2dae60060b903218e8c44a54))
* **mascot:** 对齐远程黑盒舞台质感 ([52fd683](https://github.com/VOD-Studio/violet/commit/52fd683b48c63ad2fef387dad7a2ce0a78550e89))
* **mascot:** 平滑路径加角点保持修复眼环畸形 ([b423aab](https://github.com/VOD-Studio/violet/commit/b423aabe9c87a456d6eb3e8a2c4325d959c145cf))
* **mascot:** 指针注视跟随从五官扩展到身体 ([c8b52d1](https://github.com/VOD-Studio/violet/commit/c8b52d16fc1c2cf039c5cca2215400e72e3f0c5d))
* **mascot:** 界面文案统一为中文 ([4e83adf](https://github.com/VOD-Studio/violet/commit/4e83adff596c37654d090d082008bfdb42d3b1a4))
* **mascot:** 视线跟随限定舞台区并在离开时回中 ([38a591f](https://github.com/VOD-Studio/violet/commit/38a591f0907911f26c778f16248b62ba9cf0d129))
* **mascot:** 移除 rigG 偏航压缩，消除转圈时各部件双重投影 ([ec22e65](https://github.com/VOD-Studio/violet/commit/ec22e65973d71bbe6ff6a261d29a799c976d6f2d))
* **mascot:** 统一转圈部件投影 ([014fda4](https://github.com/VOD-Studio/violet/commit/014fda4f911430442e60a7d5d1241dff5233d2aa))
* **mascot:** 统一返回入口并稳定图鉴计数宽度 ([bcaaa3d](https://github.com/VOD-Studio/violet/commit/bcaaa3d5f40a71f8cf9ed7bab6014fb29c057e3f))
* **mascot:** 腮红胡须改贴纸式跟随消除平面旋转感 ([3bc2dda](https://github.com/VOD-Studio/violet/commit/3bc2dda61da088b2325b6dfd87624d35c9edc1cb))
* **mascot:** 自旋补全旋转叙事并新增偏航调试滑条 ([c4bad43](https://github.com/VOD-Studio/violet/commit/c4bad4316c1200ce907799ce3ad26b433594baf0))
* **mascot:** 逐项调优眼环几何与高光渲染 ([00dc0d1](https://github.com/VOD-Studio/violet/commit/00dc0d11d88239a6916071c6ee9ad7b366d9ff4c))


### 重构

* **mascot:** 引擎按职责拆分为门面/姿态控制器/形象渲染器/特效 ([0202e98](https://github.com/VOD-Studio/violet/commit/0202e984e1fc756813554912204ec41d47f2b7cf))
* **mascot:** 拆分舞台特效模块 ([1bb5f35](https://github.com/VOD-Studio/violet/commit/1bb5f35844486bdb8dc52eeb9cc2d1ee2cf29c1f))
* **mascot:** 耳朵尾巴并入统一球面投影 ([47ccc7e](https://github.com/VOD-Studio/violet/commit/47ccc7e835c8bc720950baae138194049eae63c5))
* **mascot:** 面部部件统一球面投影 ([f5c0b30](https://github.com/VOD-Studio/violet/commit/f5c0b3015c76b3c3eb131428d4a91d78dea2e3b3))

## [2.8.16](https://github.com/VOD-Studio/violet/compare/v2.8.15...v2.8.16) (2026-08-20)


### 新增

* **admin-settings:** OAuth 卡片已配置折叠与回调地址展示 ([e670a9f](https://github.com/VOD-Studio/violet/commit/e670a9febf082de323b3c6a5c7e58aca65c77257))
* **admin:** OAuth 认证设置页交互优化与后台侧边栏动画治理 ([ea61952](https://github.com/VOD-Studio/violet/commit/ea61952eb96ce00d2cf17dc170cf7715517a11bd))
* **agent-status:** SSE 通道实现 transport SPI ([91c495f](https://github.com/VOD-Studio/violet/commit/91c495fedbc76f6f336ff30e3a7ff881dbc5c1ac))
* **agent-status:** 新建协议 v2 独立包与 TTL 状态机 ([7cbfec8](https://github.com/VOD-Studio/violet/commit/7cbfec88210d95845f24c172fa400393eea98363))
* **mascot:** 吉祥物「堇喵」形象实验室与展馆重构 ([1cf598e](https://github.com/VOD-Studio/violet/commit/1cf598e06b8a8f914869847cabe45cd4b81c29dc))
* **mascot:** 吉祥物形象实验室新增 Ciallo 专属动作表情 ([9771a14](https://github.com/VOD-Studio/violet/commit/9771a142e3bc7153c2096823a645e2ed40e68015))
* **mascot:** 堇喵 Codex 桌宠导出与一键安装工具链 ([249c31e](https://github.com/VOD-Studio/violet/commit/249c31e191c37c2716c7e1582bbae08fbe6c9a4f))
* **mascot:** 堇喵舞台接入 agent 状态流 ([e390bb7](https://github.com/VOD-Studio/violet/commit/e390bb7ef8beecec66774c48736ba26e7c33496d))
* **mascot:** 引擎与 React 宿主独立为 @violet/mascot 包 ([f42c404](https://github.com/VOD-Studio/violet/commit/f42c4045975e2fa6f41f0e2d99c8628c039cdef7))
* **mascot:** 新增吉祥物「堇喵」形象与交互实验室 ([3a2470c](https://github.com/VOD-Studio/violet/commit/3a2470cf215db99f73a920837157c88b00285225))
* **mascot:** 目录悬停不再切换舞台 ([99730ba](https://github.com/VOD-Studio/violet/commit/99730bae24d44dd5c835bc0247e35ee4cdb74ae6))
* **mascot:** 重做聚光舞台光影 ([6867202](https://github.com/VOD-Studio/violet/commit/68672025bcd2edbc6de61795cf6465917d531f74))
* **mascot:** 重构展馆排版与聚光舞台并落地 AI 协议 ([6659aaa](https://github.com/VOD-Studio/violet/commit/6659aaac30e3035cf1e612d3bd8a0faab2d879be))
* **mascot:** 重构舞台控制台与AI输入区并置顶Ciallo表情 ([ffd453d](https://github.com/VOD-Studio/violet/commit/ffd453daf2531aa77e000df1264a36facc528c1a))
* **nav-menu:** 二级菜单展开收起改高度过渡并自动滚入视野 ([3bdebb9](https://github.com/VOD-Studio/violet/commit/3bdebb9d6cd43c6505745f1deb19ab7fc45568a6))
* **tweets:** 推文发布框与正文支持表情选择与内联渲染 ([dbb4e26](https://github.com/VOD-Studio/violet/commit/dbb4e26666cddc1dc16f3fed158ce9f078bd47dc))
* **tweets:** 推文发布框与正文支持表情选择与内联渲染 ([0215ae3](https://github.com/VOD-Studio/violet/commit/0215ae370b0ded0a905c7d33ea95897066003a1b))
* **tweet:** 推文读模型补充 emote 表情富化 ([5cbad58](https://github.com/VOD-Studio/violet/commit/5cbad58ca0a5c59068a5216c2aa0aea4863e6fdd))
* **web:** dev 汇聚端中间件打通 agent 状态 SSE endpoint ([85065e6](https://github.com/VOD-Studio/violet/commit/85065e67c2c92d5e4a84910110799a5eb67f9730))


### 修复

* **admin-layout:** 侧边栏收展动画全链路消除硬切 ([b738d60](https://github.com/VOD-Studio/violet/commit/b738d60da7357c9546263e91fcaf49ea80e7c0ef))
* **admin-layout:** 品牌区收展过渡消除 logo 摇晃与文字溢出 ([eb9c800](https://github.com/VOD-Studio/violet/commit/eb9c800a5944a436dbee70b25fb8ce5cda47547e))
* **admin-settings:** OAuth 卡片显隐改用高度过渡消除布局抖动 ([5402505](https://github.com/VOD-Studio/violet/commit/54025059e1daabd94f4e950ee13b529248e4e546))
* **mascot:** SDK 协议区移出两列 grid 修复 sticky 舞台遮挡 ([5a1cddf](https://github.com/VOD-Studio/violet/commit/5a1cddf89103a29871e440b1422e42d76401923b))
* **mascot:** 优化动作文案字数并增加重播按钮 ([c652645](https://github.com/VOD-Studio/violet/commit/c6526452f987a1b0052fa4211b51554d5b1515e8))
* **mascot:** 重设舞台按钮交互状态为几何恒定 ([0833b81](https://github.com/VOD-Studio/violet/commit/0833b8187cc0815ca44b5917c4b1d77147019b57))
* **mascot:** 锁定几何高度与网格容器消除切换页面抖动 ([04592a5](https://github.com/VOD-Studio/violet/commit/04592a5c77a0666ee446fb44f353e9630327c095))


### 重构

* **agent-status:** 表情映射移交 mascot 包回归纯协议 ([38bbba0](https://github.com/VOD-Studio/violet/commit/38bbba09aed5bb00689b86cff90b549d1ee59922))
* **mascot:** SDK 示例接入公共 CodeCard ([1ea8926](https://github.com/VOD-Studio/violet/commit/1ea8926ee4b32a2418a50d03361ac0a341068daf))
* **mascot:** 引擎纯函数域拆分独立文件并补全 JSDoc ([cfb591f](https://github.com/VOD-Studio/violet/commit/cfb591f7a7a9cb28704ed2fe9fa89a17a4c4edfc))
* **mascot:** 消费方切换拆分后模块路径 ([367292d](https://github.com/VOD-Studio/violet/commit/367292dc85dbf7caa5ab2c34ea9ea3ad749caeff))
* **mascot:** 表情类型与数据按职责拆分独立文件 ([780af7d](https://github.com/VOD-Studio/violet/commit/780af7d94f6991b5ea47d8c2c9a016e7fcdde532))
* **mascot:** 通用数值工具归位 lib 目录对齐 web 结构惯例 ([5268c3d](https://github.com/VOD-Studio/violet/commit/5268c3d0d18770007b1ebc0b682273f2bc1c2d2d))
* **mascot:** 重构控制台信息架构分离播放控制与互动手势 ([8f7526e](https://github.com/VOD-Studio/violet/commit/8f7526e42c693798e83d264606c68c5b81b28149))
* **shared-ui:** 代码卡上提为 code-preview 公共 CodeCard ([5f8529e](https://github.com/VOD-Studio/violet/commit/5f8529e755b1539a92d847f51d72294d229e4a45))
* **shared-ui:** 删除 FencedCodeBlock 薄壳全量切换公共 CodeCard ([ce9ebc3](https://github.com/VOD-Studio/violet/commit/ce9ebc32a3a61c69112729b51c92dc23b1be0243))

## [2.8.15](https://github.com/VOD-Studio/violet/compare/v2.8.14...v2.8.15) (2026-08-19)


### 新增

* **admin-stats:** 概览待办三行动卡与最近活动流 ([526e764](https://github.com/VOD-Studio/violet/commit/526e764480c9be087860de57ad84b4901cc0cf9d))
* **admin-stats:** 概览驾驶舱 feature 与 bento tile 组件 ([7604b5c](https://github.com/VOD-Studio/violet/commit/7604b5cad552e367f95601512d2fe704a0c0dcae))
* **admin:** 实现后台概览驾驶舱（PRD-0016） ([f817344](https://github.com/VOD-Studio/violet/commit/f817344c2c1d49dc69adeeb3c0cb55104083a34e))
* **admin:** 概览页接线驾驶舱并清理占位内容 ([092adcf](https://github.com/VOD-Studio/violet/commit/092adcf15207270d429a23d766fa517e07a7421a))
* **stats:** 总览统计补待办聚合口径 ([e7bcc8d](https://github.com/VOD-Studio/violet/commit/e7bcc8d8d491ae5e5950020e4d66778357a23fb0))
* **stats:** 概览统计补对比口径并参数化趋势窗口 ([1b27bd7](https://github.com/VOD-Studio/violet/commit/1b27bd708348faa2e6d3d61563e2edf6ec3f63e3))


### 修复

* **admin-stats:** bento 同行等高与断点空洞修复 ([a2ff08a](https://github.com/VOD-Studio/violet/commit/a2ff08ad8f5c94d724cc840348575591abef9baf))
* **admin-stats:** 最近活动改为 GPU 驱动的自适应无缝循环滚动 ([d2e905f](https://github.com/VOD-Studio/violet/commit/d2e905ff65e3d927fe22568dbc951acfb87e6e2a))
* **admin-stats:** 概览首屏仪表带排版与信息层级重构 ([a36ca9d](https://github.com/VOD-Studio/violet/commit/a36ca9d066c925e40609abc42860bbbb265f6644))
* **admin-stats:** 热门与最近列表靠上对齐并补跳转交互 ([24236b9](https://github.com/VOD-Studio/violet/commit/24236b9f9096a99fef866abf46a4a8fdc16434d1))
* **admin-stats:** 趋势分段器换用 shared Segmented 组件 ([b615a64](https://github.com/VOD-Studio/violet/commit/b615a64eba99d8fc94f6c1faca285f353ceaca86))
* **admin-stats:** 趋势卡适配补零序列的空态与加载态 ([5c819a4](https://github.com/VOD-Studio/violet/commit/5c819a4fb5f9e0ddbc196f5baeb58b955eba0ff9))
* **stats:** 最近发布口径改为仅已发布文章 ([1f0e1b8](https://github.com/VOD-Studio/violet/commit/1f0e1b8ca89ab1a15eccc61fbeff439b34421308))
* **stats:** 浏览趋势按窗口补零输出完整时间序列 ([fc069e6](https://github.com/VOD-Studio/violet/commit/fc069e6c22b9a97373479e5fa74f97eacca484b6))


### 重构

* **admin-stats:** 概览重构为终端驾驶舱视觉 ([4cecef8](https://github.com/VOD-Studio/violet/commit/4cecef89bb9a5057431d43a1f62a86c1e225c1f4))
* **shared:** useCountUp 上提到 shared/hooks 并支持首屏入场动画 ([61b8f3e](https://github.com/VOD-Studio/violet/commit/61b8f3e05345f048fb9ad998bfd4972c5eadf3cc))


### 内部维护

* **release:** 锁定下个版本为 v2.8.15 ([#243](https://github.com/VOD-Studio/violet/issues/243)) ([080999b](https://github.com/VOD-Studio/violet/commit/080999bf9dcab27170c95ee0299ec6d75a9a8869))

## [2.8.14](https://github.com/VOD-Studio/violet/compare/v2.8.13...v2.8.14) (2026-08-19)


### 修复

* **comment-section:** SpotlightCard 聚光联动改命名组修复回复 hover 串扰 ([#228](https://github.com/VOD-Studio/violet/issues/228)) ([f369282](https://github.com/VOD-Studio/violet/commit/f369282b23f8a3837d617647c71dc66b2c9802a9))

## [2.8.13](https://github.com/VOD-Studio/violet/compare/v2.8.12...v2.8.13) (2026-08-19)


### 修复

* **image-cropper:** 容器测量改读布局尺寸防动画污染 ([#227](https://github.com/VOD-Studio/violet/issues/227)) ([b220b71](https://github.com/VOD-Studio/violet/commit/b220b7104eaacf112780347a7508a33e80951236))

## [2.8.12](https://github.com/VOD-Studio/violet/compare/v2.8.11...v2.8.12) (2026-08-18)


### 新增

* **admin-settings:** OAuth 凭据卡与登录开关同卡配置 ([7217ad6](https://github.com/VOD-Studio/violet/commit/7217ad6d0bb8e6c75b32d9a0b880285570c8b2f4))
* **auth:** OAuth 凭据后台配置与登录超时修复 ([5df38b1](https://github.com/VOD-Studio/violet/commit/5df38b1c8d9f7a4e8c6915ef9ec8b702274e66f2))
* **auth:** OAuth 凭据支持后台检测写入与有效性探测 ([fa3f747](https://github.com/VOD-Studio/violet/commit/fa3f747c377f084292de7be5d327de0ed9659807))


### 修复

* **deploy:** api 容器 OAuth 外呼走宿主机 v2ray 分流代理 ([df32693](https://github.com/VOD-Studio/violet/commit/df326932272a78cdc9cf08aedcb7ae4777b7d6ae))
* **image-cropper:** 修复选区比例劫持 absolute 容器高度致封面未铺满 ([fe8dcbd](https://github.com/VOD-Studio/violet/commit/fe8dcbd29525b316d479d219fd7ee3a11c4cc560))

## [2.8.11](https://github.com/VOD-Studio/violet/compare/v2.8.10...v2.8.11) (2026-08-18)


### 修复

* **github:** 修复仓库列表为 null 导致的运行时异常与空切片序列化 ([#222](https://github.com/VOD-Studio/violet/issues/222)) ([afcafc6](https://github.com/VOD-Studio/violet/commit/afcafc68d6fe859f175daf59a4b3759db689b0bf))

## [2.8.10](https://github.com/VOD-Studio/violet/compare/v2.8.9...v2.8.10) (2026-08-18)


### 新增

* **admin:** 素材管理网格视图接入触底无限滚动加载 ([a6da31d](https://github.com/VOD-Studio/violet/commit/a6da31d71122eafce74997c997c19ef0cba7e406))
* **admin:** 表格页统一接入服务端分页 ([a09bc39](https://github.com/VOD-Studio/violet/commit/a09bc3998eeb13aae3404e0b191633449dc89c29))
* **api:** 适配订阅与项目分页 query hooks ([5836599](https://github.com/VOD-Studio/violet/commit/5836599a9bd93d50041d614f995cd28308bf4c62))
* **data-table:** 所有表格显示分页器并默认每页 50 条 ([84f8287](https://github.com/VOD-Studio/violet/commit/84f828716abea0402567bf088f62e5bc577372e6))
* **domain:** 统一分页原语并补齐五实体服务端分页 ([a4395d6](https://github.com/VOD-Studio/violet/commit/a4395d6f7652002cf671947a4f944a7f00e3c233))
* **media:** 新增 useAdminInfiniteMedia 无限滚动 Hook ([03a7d08](https://github.com/VOD-Studio/violet/commit/03a7d086e2be7dd34e7ba8e80343ffa782db74b0))
* **media:** 替换素材管理加载态为网格与表格骨架屏 ([30d629f](https://github.com/VOD-Studio/violet/commit/30d629f0c61930fd9f84dde3283ad19c7cbb2e6d))
* **media:** 素材库用途与类型全量对齐后端并实现单向联动 ([dd1568f](https://github.com/VOD-Studio/violet/commit/dd1568fbe6231710870d46d64350f52eb912136e))
* **response:** 新增 ParseLimit 条数钳制原语 ([9d0ccb2](https://github.com/VOD-Studio/violet/commit/9d0ccb239ed1cff1872a7646385712e4b08e568b))


### 修复

* **admin-layout:** 恢复表格内部自适应滚动 ([f7a5946](https://github.com/VOD-Studio/violet/commit/f7a59463bda839f08843e57cf31bbfc6e680e387))
* **admin-subscriptions:** 清理适配层删除后的残留 import ([0ef926e](https://github.com/VOD-Studio/violet/commit/0ef926e2d3b635cb8f73819f5eff33c7debcb55c))
* **admin:** 恢复表格自适应滚动并统一全站分页架构 ([#211](https://github.com/VOD-Studio/violet/issues/211)) ([1890121](https://github.com/VOD-Studio/violet/commit/18901213af896402c120b1a3b2d0ee4deceaf609))
* **admin:** 补齐表格列表操作列按钮图标 ([f656665](https://github.com/VOD-Studio/violet/commit/f656665165af73832f665c0fda99e54b51efe3f5))
* **admin:** 评论与操作日志页显示完整分页器 ([c38d5e6](https://github.com/VOD-Studio/violet/commit/c38d5e6cc90cd70dde3e3f6c33d87951d97d7126))
* **domain:** 分页页码钳制上限防超大 OFFSET ([2587e57](https://github.com/VOD-Studio/violet/commit/2587e57ac776b3437c6e6043b526df165ed3b973))
* **emojis:** 空态内容区引导创建时隐藏右上角重复创建按钮 ([23d1b37](https://github.com/VOD-Studio/violet/commit/23d1b3763d24ba2f57468c811d871904884b5025))
* **media:** 表格模式使用 usePagedQuery 接入标准分页 ([c5860df](https://github.com/VOD-Studio/violet/commit/c5860dfe0f5d4ac35826439be3f5c9f3fc3b77f1))
* **role:** FindPage 权限回填查询补排序并短路空页 ([4c94db1](https://github.com/VOD-Studio/violet/commit/4c94db13174752306453623f5f15b97ac20e8dd0))


### 性能优化

* **role:** 角色列表用户数改为批量统计消除 N+1 ([92069de](https://github.com/VOD-Studio/violet/commit/92069ded8c3dda3d186ecc69b41a4f3f6db03b38))


### 重构

* **admin-subscriptions:** 删除订阅列表响应适配层 ([29fc249](https://github.com/VOD-Studio/violet/commit/29fc2496d09e6f4dab4976d0519edea15c11d2d7))
* **admin:** 表格页面统一接入 usePagedQuery ([658f3d8](https://github.com/VOD-Studio/violet/commit/658f3d8619884f2b813da34d66604684cdc0365b))
* **audit:** 审计日志分页迁移并收敛 ListResult ([5c1fc8a](https://github.com/VOD-Studio/violet/commit/5c1fc8ac398ab1fe5e66f40803848fb94f8a7a60)), closes [#218](https://github.com/VOD-Studio/violet/issues/218)
* **auth:** 迁移 useOAuthVisibility 至 hooks 目录并规范 TSDoc ([2eed358](https://github.com/VOD-Studio/violet/commit/2eed3583e3b7ab58a2ff51838d50bd6c47ed4133))
* **comments:** 迁移 useAnnotations 至 hooks 目录并规范 TSDoc ([eab5611](https://github.com/VOD-Studio/violet/commit/eab5611ecb1cd3fff669f158f8f8189a5ebd5ba4))
* **comment:** 评论分页迁移 FindPage 统一原语 ([bf99d38](https://github.com/VOD-Studio/violet/commit/bf99d3823e54271d53f14fc00133f3e284223707)), closes [#212](https://github.com/VOD-Studio/violet/issues/212)
* **data-table:** 统一 usePagedQuery 与 useClientPagination hooks ([6950289](https://github.com/VOD-Studio/violet/commit/6950289b9c789edc4d7fbc0054664a3ff7a3c067))
* **friendlink:** 友链分页迁移 FindPage 统一原语 ([b34c30e](https://github.com/VOD-Studio/violet/commit/b34c30efe94633ecd9062db4cd3f14241a325777)), closes [#216](https://github.com/VOD-Studio/violet/issues/216)
* **media:** 拆分媒体领域纯类型与运行时常量 ([69f277f](https://github.com/VOD-Studio/violet/commit/69f277f7f9bb46b8b58ae7fc002cd0ee8a4db201))
* **media:** 素材分页迁移并收敛 FileListResult ([7ddfbe2](https://github.com/VOD-Studio/violet/commit/7ddfbe255a2346f86e9bc9b93279342f42a9bf98)), closes [#214](https://github.com/VOD-Studio/violet/issues/214)
* **notification:** 通知列表分页迁移 FindPage 统一原语 ([5300f7f](https://github.com/VOD-Studio/violet/commit/5300f7f13a4323fed3a0fca14afaa452e452af73)), closes [#219](https://github.com/VOD-Studio/violet/issues/219)
* **post:** 文章分页迁移 FindPage 统一原语 ([7590151](https://github.com/VOD-Studio/violet/commit/759015113a52b6e5882e6ca716bd7030b8ae5775)), closes [#213](https://github.com/VOD-Studio/violet/issues/213)
* **repository:** 公告与项目 PO 转换函数去掉恒空 error ([3e6c140](https://github.com/VOD-Studio/violet/commit/3e6c1403d89e8470097e63f20fdb3f41f07fcbcb))
* **shared:** 规范 shared/hooks 目录结构与 TSDoc ([d680298](https://github.com/VOD-Studio/violet/commit/d680298a6bd500c55ad23504c73946fba4041f62))
* **subscription:** 分页链路迁移至 PageQuery 统一原语 ([a2ebd23](https://github.com/VOD-Studio/violet/commit/a2ebd23e0e073bedcdf9f45b446b611b1e189db6))
* **tweet:** 推文评论分页迁移 FindPage 统一原语 ([d168a12](https://github.com/VOD-Studio/violet/commit/d168a12c4c371d98d7704f4fcb05b150cd835292)), closes [#215](https://github.com/VOD-Studio/violet/issues/215)
* **useradmin:** 用户列表分页迁移并收敛 ListResult ([fd4b29a](https://github.com/VOD-Studio/violet/commit/fd4b29aa4262208a5ba0c006477a3b4c80984e1e)), closes [#217](https://github.com/VOD-Studio/violet/issues/217)
* **web:** 更新 shared/hooks 迁移后的业务层导入路径 ([f8fda41](https://github.com/VOD-Studio/violet/commit/f8fda41d45d630417462a618f617330b65d28f48))
* **web:** 查询类型统一继承 shared PageQuery ([ef8dc5e](https://github.com/VOD-Studio/violet/commit/ef8dc5eb2c0cd57a56e71a558e80dd938b10421a))

## [2.8.9](https://github.com/VOD-Studio/violet/compare/v2.8.8...v2.8.9) (2026-08-17)


### 新增

* **shared-ui:** CroppedImage 支持选区比例撑高与失败回调透传 ([e7d19be](https://github.com/VOD-Studio/violet/commit/e7d19be4249399a999f0bbbb58a41d5a035d97b9))
* **web:** 封面裁剪接入与长滚动浮动返回 ([#209](https://github.com/VOD-Studio/violet/issues/209)) ([a394443](https://github.com/VOD-Studio/violet/commit/a394443dbcf4037ce7e7a18210bf61eafce00351))
* **web:** 长滚动页面接入浮动返回钮 ([e01244d](https://github.com/VOD-Studio/violet/commit/e01244d893eee48ce704c4bb5b9eaf248c94b5d4))


### 修复

* **shared-ui:** 浮动返回出场动画尊重减少动态 ([27ab2f5](https://github.com/VOD-Studio/violet/commit/27ab2f5032af58fa339f6cdb135a6948af97e2d7))
* **tweets:** 页头随时间线同列对齐 ([03701f9](https://github.com/VOD-Studio/violet/commit/03701f99d6d6ef664992bdff3fbc9846e462553c))
* **web:** hero 封面设计比例不被选区比例顶掉 ([b6728e7](https://github.com/VOD-Studio/violet/commit/b6728e71a2ccf6db1084fc550275c6d478ba6204))
* **web:** 列表与首页封面接入选区裁剪复现 ([a86f564](https://github.com/VOD-Studio/violet/commit/a86f564697c8031f3ad7973bb1fb6cc894a87144))

## [2.8.8](https://github.com/VOD-Studio/violet/compare/v2.8.7...v2.8.8) (2026-08-16)


### 新增

* **auth:** 用户读模型暴露密码与 OAuth 绑定状态，OAuth 建号改存空哈希 ([751f693](https://github.com/VOD-Studio/violet/commit/751f69337742d476dc844c689481e0caea3a50b3))
* **blog-lab:** 博客排版原型实验室（七方向×三态） ([8b89c10](https://github.com/VOD-Studio/violet/commit/8b89c10202de2e571e1772d5e834e55369af17bb))
* **blog-lab:** 新增日刊分组方向并移除胶片条 ([597c0c1](https://github.com/VOD-Studio/violet/commit/597c0c12fed49ed159a7c6c23cfbbe799d3a1952))
* **blog-lab:** 新增特写列表方向并调整胶片定位 ([1b22722](https://github.com/VOD-Studio/violet/commit/1b22722ad8ada17836402c4c9268c22ab13c15bc))
* **blog-lab:** 日刊分组换为对开特写方向 ([b494cc0](https://github.com/VOD-Studio/violet/commit/b494cc0ca8464af829e5c3591ccfe818ae70b4bb))
* **comment:** 站点评论开关与免审核设置生效 ([ddcebdd](https://github.com/VOD-Studio/violet/commit/ddcebdd5c5ecca0e9f73b5680ea064940be5c883))
* **domain:** 通知新增五类 source_type 与迁移 081 ([9c66fe7](https://github.com/VOD-Studio/violet/commit/9c66fe76f84d9aa586a3600cf4ec36e37fe8522b))
* **lab:** 公告实验室扩五方向并补横幅三候选 ([ddc5f58](https://github.com/VOD-Studio/violet/commit/ddc5f58d41f4e5afabf1aa1a9be0103f62b0a99e))
* **lab:** 公告实验室按统一格式重做为三方向 ([e662c7f](https://github.com/VOD-Studio/violet/commit/e662c7f4bd14c88ca5bc23db45ea0e058a289930))
* **lab:** 建立 /lab 聚合路由收纳全部实验室 ([3e8970b](https://github.com/VOD-Studio/violet/commit/3e8970ba7d928564810fff556598660b001ac29b))
* **lab:** 新增子页统一页头 LabHeader ([35bb7e4](https://github.com/VOD-Studio/violet/commit/35bb7e46665291833d67d694dbee12a919f4f52b))
* **lab:** 新增返回导航实验室 ([b63a09b](https://github.com/VOD-Studio/violet/commit/b63a09b21b23bee73af03a846246c7758fd0ebf0))
* **lab:** 统一常态返回入口为页头胶囊 ([1e99eb1](https://github.com/VOD-Studio/violet/commit/1e99eb1e9861c8d4688417b0d2ce8de5e76c8c55))
* **notifications:** 前端补全九类来源类型与图标映射 ([85e6621](https://github.com/VOD-Studio/violet/commit/85e662125e2376200776c5128531c677efceeb58))
* **notifications:** 友链审核结果通知登录申请者 ([b64b6c0](https://github.com/VOD-Studio/violet/commit/b64b6c030ac0787f322a9ee3b29951078df03289))
* **notifications:** 文章新评论通知文章作者 ([aff724b](https://github.com/VOD-Studio/violet/commit/aff724bcdc84c05a39aa26c94355cabbb1d0baac))
* **notifications:** 新用户注册通知管理员 ([53545b8](https://github.com/VOD-Studio/violet/commit/53545b8bbc27a8c31161d75e3b45a15c4aef00d8))
* **notifications:** 评论提交待审通知管理员 ([8fcceb2](https://github.com/VOD-Studio/violet/commit/8fcceb2af64a9ce20b9be327f9728725ebce1fdf))
* **notifications:** 评论被拒通知评论作者 ([0414c44](https://github.com/VOD-Studio/violet/commit/0414c44ba11bd67488c7c553d48a404667739bdb))
* **notifications:** 账号安全通知（改密、token 增删、角色与状态变更） ([f1ce48a](https://github.com/VOD-Studio/violet/commit/f1ce48a26b322a1d55bb0618cf9d2665848262cc))
* **shared-ui:** CroppedImage 加载失败兜底占位 ([4013d24](https://github.com/VOD-Studio/violet/commit/4013d248f874871da2d422fd85cfc9fc8cc7b504))
* **shared-ui:** CroppedImage 加载失败兜底占位 ([e342b3a](https://github.com/VOD-Studio/violet/commit/e342b3adf706d700cc2118e62aab53c439dde070))
* **subscription:** 自动暂停信号进抓取事件并升级失败通知文案 ([bebb1b4](https://github.com/VOD-Studio/violet/commit/bebb1b461f5684cba958de881eaa5ac7cf70c907))
* **web:** 个人中心分段器滑动指示块与按钮高度统一 ([85015aa](https://github.com/VOD-Studio/violet/commit/85015aaa612ad846b4bd48d9cf084582a8496420))
* **web:** 个人中心排版细节与文案打磨 ([0f631ea](https://github.com/VOD-Studio/violet/commit/0f631ea373a9c9444585940e7bfdb5940254de97))
* **web:** 个人中心重组为两 Tab 并支持 OAuth 用户密码引导 ([14701b3](https://github.com/VOD-Studio/violet/commit/14701b37b582b95bd31344a4e7bcff3e71529a5e))
* **web:** 主轴瀑布精选视觉表达 ([fb76fc1](https://github.com/VOD-Studio/violet/commit/fb76fc1ad2d06701a6fa607334e77bbb318f7977))
* **web:** 公告详情页重做对齐文章页排版 ([db4c80f](https://github.com/VOD-Studio/violet/commit/db4c80fe61edc4d8f1924858cbe54fa50f86c036))
* **web:** 前台按站点设置控制评论显示与每页文章数 ([f5b9092](https://github.com/VOD-Studio/violet/commit/f5b90927552eba693c6fdd78abe2ac20732bb8a7))
* **web:** 博客列表页换装主轴瀑布方向 ([ca3bae9](https://github.com/VOD-Studio/violet/commit/ca3bae98df6f6b44fc5551688d77cc831090e7c1))
* **web:** 博客瀑布接入触底无限加载 ([68cabad](https://github.com/VOD-Studio/violet/commit/68cabad4fd34cdfdeddcdbb859d1036830f6c02e))
* **web:** 顶部公告横幅换装电传打字方向 ([91fa9da](https://github.com/VOD-Studio/violet/commit/91fa9da619223096ed93b32aed9c53a1f2b45e9f))
* **web:** 首页公告区换装告示板方向 ([fa11d74](https://github.com/VOD-Studio/violet/commit/fa11d749deb78feb42ee03adfd2bb958a6ecf5b1))
* **web:** 首页公告区换装编辑索引方向 ([ed4440b](https://github.com/VOD-Studio/violet/commit/ed4440bddaa7a6f375fa2a1a96466d9a63b5ab21))
* **web:** 首页公告区替换为事件日志方向 ([0f81499](https://github.com/VOD-Studio/violet/commit/0f81499a3a3c727cde9bfaea45460fb62557a483))
* **web:** 首页最新文章换装织纹 Bento 方向 ([f9e09a8](https://github.com/VOD-Studio/violet/commit/f9e09a8c583eee0864aa79a41e8acda6e24edeb7))
* 通知中心接入与公告展示全链路重做 ([#205](https://github.com/VOD-Studio/violet/issues/205)) ([ded47bd](https://github.com/VOD-Studio/violet/commit/ded47bdda176e57e4c76970ed726c05097f68463))


### 修复

* **admin-layout:** 后台顶栏挂通知铃铛保持 SSE 在线 ([b135ae3](https://github.com/VOD-Studio/violet/commit/b135ae3194a57d36bca4afee6e4953d04a1f8f1f))
* **admin/subscriptions:** 抓取进行态提升到 store，导航不丢 spin ([acce151](https://github.com/VOD-Studio/violet/commit/acce151d441cb96564352a6cca4cc96f8287346f))
* **admin:** 公告表单编辑回填与创建默认值修复 ([8369900](https://github.com/VOD-Studio/violet/commit/83699009e5064d0403e4fa6232f11cf22e118522))
* **blog-lab:** 容器与 friends-lab 对齐 ([4c4b3f5](https://github.com/VOD-Studio/violet/commit/4c4b3f55b9804f5976d6c1e4aec9a4b3ad97dad7))
* **blog-lab:** 报纸图文版按存活图数量自适应分版 ([5617db4](https://github.com/VOD-Studio/violet/commit/5617db472d2c05b8de9d44ef243d597b62fa29c6))
* **blog-lab:** 报纸图文版按封面运行时存活性分流 ([5c96f7f](https://github.com/VOD-Studio/violet/commit/5c96f7fbdfa7ec2e830ed6ddce64d1fdee1b3131))
* **blog-lab:** 文字简讯版改双栏中缝报纸摘要栏排版 ([a96e43b](https://github.com/VOD-Studio/violet/commit/a96e43b731fe7087366e5455c1ee3c57e682b498))
* **blog-lab:** 死图封面兜底与实验室细节修正 ([f398040](https://github.com/VOD-Studio/violet/commit/f39804008cf665d7b06a8418142000363f96b7bc))
* **blog-lab:** 短讯栏改 CSS columns 三栏流式均分 ([a4095e4](https://github.com/VOD-Studio/violet/commit/a4095e4d534c75a2c5735b5721bf55e4fcf019e1))
* **blog-lab:** 织纹与胶片的死图兜底视觉区分 ([ca53288](https://github.com/VOD-Studio/violet/commit/ca5328874d0df82838aa7c4cff7d31bd82962e38))
* **blog-lab:** 织纹跨度数学重排消除空洞 ([adb1ae4](https://github.com/VOD-Studio/violet/commit/adb1ae45058a5b857131d59051c3c6f7e0852b98))
* **blog-lab:** 编年轨道节点精确压线 ([80eb139](https://github.com/VOD-Studio/violet/commit/80eb1399cb23875a6ac718dc9ac2155f50f83d71))
* **comment:** 评论总开关拦截匿名验证码发送 ([dac4a28](https://github.com/VOD-Studio/violet/commit/dac4a2856471dee09a61c8057db5ab581df25fe7))
* **data-table:** 调整 Skeleton 组件最大宽度 ([1408047](https://github.com/VOD-Studio/violet/commit/14080472bc3c15b2bf9e4d3c317305ea491debd0))
* **lab:** 修正实验室页描述文案 ([01be531](https://github.com/VOD-Studio/violet/commit/01be531a05787231a01b8a56ec175bc27c39f3d0))
* **lab:** 吸顶返回条改浮层消除阈值抖动 ([a329b73](https://github.com/VOD-Studio/violet/commit/a329b7315484e2196fc19fb723d16cb355ed0595))
* **lab:** 实验室描述改为方案库定位 ([74a445b](https://github.com/VOD-Studio/violet/commit/74a445bab69cd634e88dff0db7ba9f09a87f8cd1))
* **lab:** 实验室描述文案改为功能型一句话 ([64cb3b5](https://github.com/VOD-Studio/violet/commit/64cb3b5d91be43c078f8dbabe790e4d54f8edd74))
* **lab:** 棱柱改累计角度消除循环边界的反向重置 ([a13d2f6](https://github.com/VOD-Studio/violet/commit/a13d2f6a55c04b7c1b964903bc8273e542ba6b62))
* **lab:** 横幅滚轮触控板穿透修复并恢复真 3D 棱柱 ([0ef9c8d](https://github.com/VOD-Studio/violet/commit/0ef9c8d6bcf3d5fa59ae0a2992f973a107858895))
* **lab:** 返回导航实验室对齐生产排版并修浮层锚点 ([2eecc38](https://github.com/VOD-Studio/violet/commit/2eecc38b94431993bcd1925140ceeb2e2b41a63f))
* **migrations:** 通知 source_type 约束补上 subscription_succeeded ([e7bd242](https://github.com/VOD-Studio/violet/commit/e7bd2420fd58b2a2bc6f03e0cae2e37d8fdcedc4))
* **migrations:** 通知表补齐 event_id 列与幂等唯一约束 ([e28c393](https://github.com/VOD-Studio/violet/commit/e28c393ffa67bcb4aba8f308d3c42fd234ddcf10))
* **notifications:** SSE 建连对账并新通知弹 toast ([dff4cac](https://github.com/VOD-Studio/violet/commit/dff4cac182cddfc96d8316646d905c278c49dac8))
* **notifications:** 免审自动通过不再通知评论者本人 ([2872812](https://github.com/VOD-Studio/violet/commit/28728124b350125147cc776c260776b8426097e8))
* **profile:** 修改密码表单前置忘记原密码入口 ([c77cfe6](https://github.com/VOD-Studio/violet/commit/c77cfe6297b888a9444ba7e159101ab996273a6f))
* **scene-button:** 修正背景渐变类名为线性背景 ([0b1e34a](https://github.com/VOD-Studio/violet/commit/0b1e34a98807ed11509e449628cd0e07953411c4))
* **web:** 个人中心两处细节修正 ([3b9fc0b](https://github.com/VOD-Studio/violet/commit/3b9fc0bc09e277552ccb760422cc48e5e979dbfd))
* **web:** 个人中心四项视觉问题修正 ([cf286aa](https://github.com/VOD-Studio/violet/commit/cf286aab48a8aa116e1265bf14217751fa468982))
* **web:** 主轴瀑布 hero 移动端宽高比适配 ([7dd4290](https://github.com/VOD-Studio/violet/commit/7dd4290c8dac892065227c78931956a651d1474f))
* **web:** 侧栏滑块遮挡文字修正 ([9dcc905](https://github.com/VOD-Studio/violet/commit/9dcc9050bf78b2015ee467f31770c1101895e573))
* **web:** 公告条钉出导航转场并消除刷新布局跳变 ([082cf5c](https://github.com/VOD-Studio/violet/commit/082cf5ca79d06274c35d71580cd0339388fb9855))
* **web:** 公告横幅 SSR 与 hydration 首帧不渲染 ([b11181f](https://github.com/VOD-Studio/violet/commit/b11181fa1c2dd0f8a339c51541ea02a392ed5d80))
* **web:** 公告横幅滚轮翻页接管页面滚动 ([a7687d8](https://github.com/VOD-Studio/violet/commit/a7687d8292a7d05e8dbb721fd4b42b98c7d7eddd))
* **web:** 公告详情页标题改静态渲染 ([e4dde41](https://github.com/VOD-Studio/violet/commit/e4dde415a5c6f48e1f34d168f2c672cf224edae7))
* **web:** 博客瀑布翻页改 JS 分列避免整墙重排 ([f2a3e1f](https://github.com/VOD-Studio/violet/commit/f2a3e1f8ffade6478ff8b33216a79ce4b8718007))
* **web:** 博客瀑布翻页统一容器并堵住未滚动级联拉页 ([ec1d36f](https://github.com/VOD-Studio/violet/commit/ec1d36f1a15a29f4a525b1b9872ab46554605089))
* **web:** 博客瀑布触底翻页改每页普通查询恢复 SSR ([9378531](https://github.com/VOD-Studio/violet/commit/93785311c204e87b33516272d5c65385a04076aa))
* **web:** 友链空态收敛申请入口 ([96ebe28](https://github.com/VOD-Studio/violet/commit/96ebe28209369c3d6450f05773442bdc258e0a71))
* **web:** 消除列表 hydration 首帧的双请求 ([0d91fd2](https://github.com/VOD-Studio/violet/commit/0d91fd261408b98c62c2a58ea6d625ee1512843e))
* **web:** 织纹 Bento 移动端窄格适配 ([162c024](https://github.com/VOD-Studio/violet/commit/162c024d3b85826fb6ba3bfeb5356630cf50d509))
* **web:** 首页最新文章上限 6 篇 ([a9fb2e3](https://github.com/VOD-Studio/violet/commit/a9fb2e3f9382e8002614ecceebea6aaa3d145ef8))


### 性能优化

* **web:** 主题切换扩散动画对齐 yggdrasil 基准 ([db4e4a3](https://github.com/VOD-Studio/violet/commit/db4e4a3b74e34d9f5cc335682175b5d496e0f002))
* **web:** 首屏光斑渐变化修复刷新进入掉帧 ([db17490](https://github.com/VOD-Studio/violet/commit/db174906e34437ef81937fa72c3dea64e1222438))


### 重构

* **blog-lab:** 头版报纸报头与简讯版按报纸解剖学重排 ([7bb181e](https://github.com/VOD-Studio/violet/commit/7bb181e92dbca05c69f17e2667666f1fb4d934de))
* **blog-lab:** 头版报纸按报纸解剖学重做 ([ac239f0](https://github.com/VOD-Studio/violet/commit/ac239f0d20f94c1182e8c572f68d64198d7d7f7d))
* **blog-lab:** 报纸简讯按版块分组消除异质混排 ([b806e67](https://github.com/VOD-Studio/violet/commit/b806e67181cfbb356d7f9b7be728a90d128943b4))
* **blog-lab:** 报纸简讯版改为三栏要闻索引 ([3526bac](https://github.com/VOD-Studio/violet/commit/3526bace871589c1fb4c842bbc9f8345fb300983))
* **blog-lab:** 报纸简讯统一结构预算与底线对齐 ([b6be714](https://github.com/VOD-Studio/violet/commit/b6be714d63f567306f43d98394dd220d66a3d2bc))
* **blog-lab:** 报纸要闻索引改为分类短讯栏 ([95c2124](https://github.com/VOD-Studio/violet/commit/95c21248c1ec76dc20b8247013c8d15f0ff5a4f9))
* **blog-lab:** 杂志目录改栏目分区与特写列表区分 ([549b6c2](https://github.com/VOD-Studio/violet/commit/549b6c21f574b2496093c1ab68ded43e756c1d95))
* **blog-lab:** 杂志目录改真目录语法 ([14d728a](https://github.com/VOD-Studio/violet/commit/14d728a32ade428dd3ec13d0ffcf5f40639c65f5))
* **blog-lab:** 瀑布 hero 入场按动效原则重做 ([6ea6fd9](https://github.com/VOD-Studio/violet/commit/6ea6fd9c12cf3febab376f687ef8156aa08cc80d))
* **blog-lab:** 织纹无图格改排版织块 ([f861b34](https://github.com/VOD-Studio/violet/commit/f861b34159231556feef5b37be75d13755489f71))
* **blog-lab:** 胶片条重做为暗色胶卷带 ([5f3254d](https://github.com/VOD-Studio/violet/commit/5f3254d59df9cb2c9ba8e787e99d026d6800a5ef))
* **lab:** lab 模块目录收拢至 features/lab 下 ([f98cfce](https://github.com/VOD-Studio/violet/commit/f98cfce9928faa2c772020eda3645438d366dd03))
* **lab:** 主题切换器归入 lab 并统一方向切换结构 ([3a02af8](https://github.com/VOD-Studio/violet/commit/3a02af8b88cc36a871e246ca3237203921bfebe8))
* **lab:** 主题实验室砍三方向并改尺寸陈列 ([5fc0125](https://github.com/VOD-Studio/violet/commit/5fc01258eb0f53fd69be4b77fad1b942f91c4180))
* **lab:** 横幅候选按返修意见重做并扩至四方向 ([7194aa8](https://github.com/VOD-Studio/violet/commit/7194aa8a1d852cc48b0ccf743b3a8c9777da9275))
* **web:** 瀑布卡片拆独立组件文件 ([9702333](https://github.com/VOD-Studio/violet/commit/9702333e0f5fc9fbb4f70ac7bbb8bb878a188ffb))

## [2.8.7](https://github.com/VOD-Studio/violet/compare/v2.8.6...v2.8.7) (2026-08-14)


### 修复

* **admin/media:** 筛选栏移入 PageShell sticky 区域 ([8a32a06](https://github.com/VOD-Studio/violet/commit/8a32a066f6a0efb666c425b73eb350824b229f68))
* **admin/subscriptions:** 抓取按钮改为按行 loading 并保持反馈 ([f7caefb](https://github.com/VOD-Studio/violet/commit/f7caefba3e8efa7fa10ff342759ca88a662d35b1))
* **admin/subscriptions:** 抓取轮询改为订阅详情并修复 timer 管理 ([8c0902a](https://github.com/VOD-Studio/violet/commit/8c0902ae5257487121d7279421359f237b486ec1))
* **admin/subscriptions:** 轮询检测到完成后调用 clearFetching 清除 spin ([2193f62](https://github.com/VOD-Studio/violet/commit/2193f6238bc4c1d7b4d7db77896f829c2959b27b))
* **admin:** 全部表格页筛选栏移入 PageShell sticky ([64173ea](https://github.com/VOD-Studio/violet/commit/64173ea7e8025d7a7349e6618b660dcce0548a94))
* **subscription:** 抓取事件 title 回填修复与 FeedReport 补全 ([cb6d92f](https://github.com/VOD-Studio/violet/commit/cb6d92f5cca4e0408fb95dee1615012e67a97b66))
* 后台筛选栏固定与订阅抓取体验修复 ([#199](https://github.com/VOD-Studio/violet/issues/199)) ([6431ebe](https://github.com/VOD-Studio/violet/commit/6431ebe499b1ed8071fc2ecdc68b5fda63643740))

## [2.8.6](https://github.com/VOD-Studio/violet/compare/v2.8.5...v2.8.6) (2026-08-14)


### 新增

* **application:** 通知 EventBus subscriber 与查询 API ([cc472ff](https://github.com/VOD-Studio/violet/commit/cc472ff8514764896700fcf191b4e190bc457123))
* **application:** 通知 SSE 实时推送通道 ([b0f8fdd](https://github.com/VOD-Studio/violet/commit/b0f8fdde9e4fda5240aff9adad8c86064f463df0))
* **domain:** 通知领域模型与迁移与仓储装配 ([d9fd6f1](https://github.com/VOD-Studio/violet/commit/d9fd6f1f5f0d5288268b25b459313f4eb52f044d))
* **handler:** 订阅抓取异步化与完成通知 ([d90c67a](https://github.com/VOD-Studio/violet/commit/d90c67a0fccbd2d73cd0c36c44a8ae0ceaa434a9))
* **web:** 通知铃铛与 SSE 实时推送前端 ([1b8aab5](https://github.com/VOD-Studio/violet/commit/1b8aab5ea304416c31ab13fe9b3ac9252c76c05b))
* 全站通知系统 ([5a735a3](https://github.com/VOD-Studio/violet/commit/5a735a3d65f223b0d18a9922632ae676dd0ebba9))


### 修复

* **application/notification:** 写入失败降级不阻断并补全日志 ([8088a82](https://github.com/VOD-Studio/violet/commit/8088a828752b5232bece4392f81dc30eec6f726f))
* **domain:** 通知幂等键与订阅成功来源类型 ([e836113](https://github.com/VOD-Studio/violet/commit/e8361136ea7820ce1c1645462e14ceb569c117ff))
* **feed:** feed 抓取支持代理（自动检测 + config 保底） ([f2dae7d](https://github.com/VOD-Studio/violet/commit/f2dae7d63e5aed2efc964defb34ae52946c4f78c))
* **handler:** 通知列表改用 RespondPaged 统一信封格式 ([7090f33](https://github.com/VOD-Studio/violet/commit/7090f3362b8d55df74d57def52ea747cc04c2c9a))
* **notifier:** cleanup 闭包用 sync.Once 防重复 close panic ([3894ca0](https://github.com/VOD-Studio/violet/commit/3894ca0cb0b4b4f23c40770b223a4302c61ce637))
* **notifier:** SSE 推送持锁消除连接清理竞态 ([0dd9a76](https://github.com/VOD-Studio/violet/commit/0dd9a76556accb7b7843a68d156d7c03024c3461))
* **web:** 通知乐观更新用 setQueryData 泛型推导类型替代 unknown as ([1e709b9](https://github.com/VOD-Studio/violet/commit/1e709b950da6eec9ef5b661db4981e604b2ac4e1))
* **web:** 通知乐观更新用项目 PagedResponse 类型与 setQueriesData 模式 ([4a23c56](https://github.com/VOD-Studio/violet/commit/4a23c56d986a51604f9fe0a64a4a7e7678a93da5))
* 通知 ID 零值导致主键冲突与前端异步抓取 report 解析错误 ([e9f40ff](https://github.com/VOD-Studio/violet/commit/e9f40ffc26faaa7b6b4635c0c09769c5d6f09a37))


### 重构

* **domain:** 新增 IDFromUUID 消除 uuid-string-id 绕路 ([2099354](https://github.com/VOD-Studio/violet/commit/2099354aaccef6bf0dfad6d8fd791c34994600af))

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
