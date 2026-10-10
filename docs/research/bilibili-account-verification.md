# B 站账号归属验证：官方授权与公开资料证明

调查日期：2026-10-10。范围为中国大陆 B 站开放平台的网页应用 OAuth 2.0、申请条件、授权身份与公开 UID 的关系，以及公开个人签名一次性挑战的读取条件。不实现产品代码，不创建应用，不修改外部状态。

**证据边界：已阅读官方完整文档，并实测匿名读取公共样例的 UID 与签名字段；没有进行真实 OAuth 授权、code 换 token、用户信息调用或回调验收，也没有修改外部签名或完成一次账号控制权挑战。** 下文“官方说明”不是授权实测；设计推论标为 `[INFERENCE]`，缺少说明的能力保留为未知。

## 结论与可供选择的方案

1. **官方网页 OAuth 确实存在，可验证用户控制某个 B 站账号。** 用户在 B 站授权页同意后，第三方服务器收到 `code`，以自己的 `client_id/client_secret` 换取 `access_token`，再用 `USER_INFO` 取得该账号在此开发者和应用下的稳定 `openid`。无需把 B 站用户名、密码交给 violet。[网页应用接入][web]、[账号授权][oauth]、[获取用户公开信息][userinfo]
2. **它目前不能被宣称为“验证填入的公开 UID 就属于授权用户”。** 官方用户信息响应仅列 `name/face/openid`，没有 `uid/mid`。官方还明确解释：`open_id` 替换 UID 外显是为了防止跨应用、跨房间追踪。`union_id` 只解决同一开发者下的多应用标识，而且需单独申请；不是公开 UID。[获取用户公开信息][userinfo]、[获取用户 union_id][union]
3. **个人站点有明确的申请障碍。** 当前官方入驻文档写明“暂未开通个人开发者的申请入驻”，要求资质认证材料；应用地址对应的 ICP 备案主体必须与入驻主体一致。不能承诺个人开发者注册后就能拿到 OAuth 凭据。[入驻][enrollment]
4. **“只验证身份，之后匿名同步公开清单”仍缺关键的一环。** 已有研究证明至少样例公开 UID 的清单能匿名读；但 OAuth 的 `openid` 与该 UID 之间没有已确认的映射。不能用昵称、头像相似、用户填写 UID 或另一个公共账号资料的存在来填补这一环。[获取用户公开信息][userinfo]、[已有公开清单实测](bilibili-bangumi-feasibility.md)
5. **公开签名读取条件已实测，但控制权挑战仍是候选方案。** 固定官方资料接口无 Cookie 返回 `200 / code=0`，返回 UID 与请求一致，签名字段为非空字符串；没有保存或展示该人的签名正文。用户临时写入本站一次性码再由本站读取的完整过程尚未实测，不等同 OAuth、实名验证或私密清单授权。[公开资料接口][publiccard]

| 用户可选择的路径 | 已确认能力 | 前置条件 / 当前缺口 |
|---|---|---|
| **官方授权优先，先咨询并申请** | 正式网页 OAuth；可证明应用维度的 B 站账号身份 | 合格入驻主体、同主体 ICP、应用审核、`USER_INFO` 权限；需先获得 B 站关于**授权用户到公开 UID 的官方关联能力或本人追番清单接口**的明确答复。文档未证明能获批这种额外能力。[入驻][enrollment]、[应用管理][apps]、[未列出功能][missing] |
| **只有公开文档中的 OAuth，不补身份关联** | 可以作为 B 站账号登录 / 稳定 `openid` 绑定 | **不满足当前“同步本人 UID 的追番清单”验收**；若用户仍要求该功能，不应以此直接开工。[获取用户公开信息][userinfo] |
| **公开签名一次性挑战** | 官方资料接口已匿名读取成功；UID 与签名可作为观察对象 | `[INFERENCE]` 由用户临时修改本人签名，本站仅观察绑定于当前用户、目标 UID 与用途的一次性码；不收集 Cookie。实际签名修改、传播延迟与完整验证仍需真实用户验收。[公开资料接口][publiccard] |

公开资料读取证据与挑战边界见第 8 节，不能把该证明包装成官方 OAuth。**本次没有找到可直接完成“OAuth 授权 → 官方公开 UID → 本人追番清单”的已证实官方闭环。** 这不等于断言 B 站内部绝无合作能力；官方明确允许咨询公开文档未列出的接口及数据需求。[未列出功能][missing]

## 取得正文的方法与来源可信度

静态入口原先只返回 SPA 页面壳。本次打开 [官方账号授权页][oauth] 的真实浏览器公开页面，成功读到正文；该页面实际加载第一方只读接口 [`/arcopen/user/open-doc/view?id=4`][docindex]，其 `data.online_doc` 给出当前发布的目录、文章 ID、`html_url` 和 `md_url`。后续只读取该**发布目录**列出的第一方 `i0.hdslb.com/bfs/station_gw/*.md` 与一张网页应用字段截图；没有把 `draft_doc` 作为已发布规范，也没有用搜索摘要补正文。[官方发布目录][docindex]

主引用保留稳定的官方文档页面 URL，页面需要 JavaScript 时可循发布目录定位其正文。此次没有以 Android / iOS SDK 文档代替网页接入说明。浏览器页面自身会发匿名账号状态查询及站点基础请求；没有点击登录、生成或轮询二维码、提供 Cookie、处理验证码或编辑 B 站资料。调查未请求 token、用户信息或沙盒业务接口，所有接口行为均来自官方文档而非真实授权结果。[网页应用接入][web]、[账号授权][oauth]

## 1. 网页 OAuth 的具体流程

### 授权入口与回调

当前 PC 入口为：

```text
https://account.bilibili.com/pc/account-pc/auth/oauth?client_id=${client_id}&gourl={gourl}&state={state}
```

- `client_id` 来自创建并获批的应用详情。
- `gourl` 为授权后跳转地址，拼接前需要 URL encode，并须与应用配置的授权 / 应用回调域匹配；官方明确不匹配会导致“不合法的授权请求”。
- `state` 是接入方随机字符串，认证服务器原样返回，用于防止 CSRF。[网页应用接入][web]

手机浏览器有 H5 网页 OAuth，不必假借原生 SDK：

```text
https://account.bilibili.com/h5/account-h5/auth/oauth?navhide={navhide}&callback={callback}&gourl={gourl}&client_id={client_id}&state={state}
```

官方列 `navhide=0/1`、`callback=skip/close/browser`；`skip` 是授权后跳转 `gourl`。本次未实际打开授权入口，未确认不同浏览器体验。[网页应用接入][web]

用户同意后，官方文档给出的重定向格式是 `${return_url}?code=${code}&state=${state}`。正文前面的配置参数叫 `gourl`，此处改称 `return_url`，不应自行创造另一个授权参数。文档要求防止 `code` 泄漏。`[INFERENCE]` violet 服务端应将 `state` 与当前本站登录用户、一次性绑定尝试关联并严格核对，不能让任意回调绑定到其他用户；这属于实现约束，不是本次已验证的代码行为。[网页应用接入][web]

官方注明授权页在 **2025 年 3 月更新**，旧 `passport.bilibili.com/register/pc_oauth2.html` 不再维护和迭代，新接入应使用上述 `account.bilibili.com` 地址。[网页应用接入][web]

### code 换 token

官方定义：

```text
POST https://api.bilibili.com/x/account-oauth2/v1/token
Content-Type: application/x-www-form-urlencoded
```

参数为 `client_id`、`client_secret`、`grant_type=authorization_code`、`code`。**当前文档把它们列在“url参数”，把“body参数”列为“无”，且没有请求样例**；不能仅凭常见 OAuth 习惯认定这里应全部放 form body。开发时需以 B 站确认及获批后的实际调用验收解决这一文档细节。[账号授权][oauth]

成功响应文档列 `access_token/refresh_token/expires_in/scopes`，没有 UID、mid、openid 或 ID token。`expires_in` 被注明为“过期时间（UTC时间）”，样例为 Unix 秒形态 `1630220614`，**不应直接当作从当前时刻起的 TTL 秒数**；真实返回仍需实测确认。文档没有承诺固定有效期。[账号授权][oauth]

### 最小权限与授权范围

**只做身份验证的已知最小 scope 是 `USER_INFO`**，用户信息接口明确标为“需要申请权限”“需要用户授权”。`GET /arcopen/fn/user/account/scopes` 同属 `USER_INFO`，可读已授权的 `scopes` 与 `openid`。不需要为此申请稿件、专栏、直播或用户数据权限。[获取用户公开信息][userinfo]、[已授权权限列表][scopes]

网页授权 URL 的当前示例**未列 `scope` 参数**。账号授权文档说授权页只显示申请通过的 scope；应用管理文档另有醒目说明，用户必须同意应用申请通过的所有权限才可授权。两篇在“勾选”表达上有差异，本次未实测授权页选择行为；因此最小权限应从应用申请阶段只申请所需权限，而不是臆造 `scope=USER_INFO` 参数来缩小已有的广泛授权。新增权限需要已有用户重新授权。[网页应用接入][web]、[账号授权][oauth]、[应用管理][apps]

## 2. 授权后身份与公开 UID 的关系

### 已知的正式用户信息接口

```text
GET https://member.bilibili.com/arcopen/fn/user/account/info
```

无 URL / body 业务参数。需要 OAuth `Access-Token` 和 **2.0 公共签名**：`X-Bili-Accesskeyid` 是申请所得 `client_id`，`Authorization` 是以 `app_secret` 对排序后的 `x-bili-*` 头构造 HMAC-SHA256 签名；另含请求体 MD5、秒时间戳、唯一 nonce、签名方法与版本，以及 JSON Accept / Content-Type。仅拿一个 `access_token` 不等于可绕过应用签名直接调用。[获取用户公开信息][userinfo]、[接口签名][signing]

返回字段：

| 字段 | 官方定义 | 对当前需求的意义 |
|---|---|---|
| `name` | 用户昵称 | 展示，不构成 UID 归属证明。 |
| `face` | 用户头像 | 展示；官方要求第三方自行缓存，不能直接调用返回的图片地址。 |
| `openid` | 用户 openid | 在同一开发者、同一应用不变时稳定的身份主键；**不是公开 UID**。 |

以上为完整已列出的用户信息响应字段，不包含 `uid/mid`。[获取用户公开信息][userinfo]

官方关于 `open_id` 的解释是：UID 全局统一；`open_id` 在开发者和应用维度唯一，由 UID、access key、应用 ID 和初次生成环境参数产生的**唯一随机值**，用于替换 UID 外显，避免跨应用、跨房间追踪。同一开发者和应用不变时该值不会变化。文档分别使用 `openid` 字段名和 `open_id` 说明名称；不能因此推导它可解码或逆算出 UID。[获取用户公开信息][userinfo]

### union_id 不能补这个缺口

```text
POST https://member.bilibili.com/arcopen/fn/user/account/union_id
```

同属 `USER_INFO`、需要用户授权和 2.0 签名，但官方强调**“需要根据业务需求单独申请开通”**。它只返回同一开发者下多应用通用的 `union_id`，开发者不变时稳定，仍不返回 UID。[获取用户 union_id][union]

授权 `authorize` / 解除授权 `deauthorize` 推送也只给 `openid/client_id/permits`，查询授权 scope 接口只给 `openid/scopes`。本次已阅读公开“用户管理”三个章节和这两类授权事件，均没有找到公开 UID 映射；此结论限定于这些公开文档，**不是对所有商务合作接口的穷尽性断言**。[授权事件][authorize]、[解除授权][deauthorize]、[已授权权限列表][scopes]、[未列出功能][missing]

## 3. 开发者与网页应用的申请前置条件

1. 开放平台登录 / 注册后提交**开发者资质认证**。当前文档明确暂未开放个人开发者入驻。材料说明包括营业执照、申请公函、单位盖章；公函注册人须手签 / 电子签，有效期一年内，企业名称、地址、经营范围须与执照一致，彩色扫描件规则见正文。[入驻][enrollment]
2. 在管理中心 → 应用管理创建应用，详细填写申请理由与使用场景；**应用地址对应 ICP 备案需与入驻主体一致**。[入驻][enrollment]
3. 选择网页应用并配置应用回调域。官方应用管理的[网页字段截图][webimage]注明最多填写三个域名，用英文分号分隔，示例含 `https://`。这是发布文档中的截图，不是本次打开真实申请表的结果。回调 `gourl` 匹配条件以网页接入正文为准；子域名、路径、端口、localhost、通配符、HTTP 是否允许、是否要求额外域名所有权校验，公开正文未给出完整规则，**未知，不能承诺**。[应用管理][apps]、[网页应用接入][web]
4. 平台审核应用材料；应用状态包括审核中 / 已开通 / 已驳回，审核通过后分配 `client id/app secret`。申请后的确切审核时限、收费、对非视频业务的接受条件，本次文档未确认。[应用管理][apps]
5. 在应用接口详情申请 `USER_INFO` 等所需接口，填写申请理由并等待通过。创建成功虽会给一些基础权限，但文档没有列其范围，不能把 `USER_INFO` 当成自动开通。[应用管理][apps]、[获取用户公开信息][userinfo]
6. 配置 Webhook 地址以处理撤销和注销事件。消息推送用 HTTPS POST，配置时会验证回调地址；业务回调需要按官方消息签名验证来源，返回 2xx，失败最多推送三次，接入方需去重。此 Webhook 地址与 OAuth 授权回调是不同职责，不能混为一个流程参数。[消息推送概述][webhooks]、[解除授权][deauthorize]

**仍需人工完成的事项**：主体认证、应用资料审核、接口权限申请审核；若希望正式接口返回 UID 或以 openid 同步本人追番清单，还需商务 / 官方能力咨询，不能假定已有权限可满足。官方公开联系方式为 `openplatform-feedback@bilibili.com`，未列出功能页面要求尽量提供合作内容、双方量化收益、公司和对接人信息。调查没有发邮件、发工单或提交任何申请。[未列出功能][missing]、[联系我们][contact]

## 4. 沙盒、白名单与正式授权的区别

- 沙盒返回的都是 **MOCK 数据**，不影响正式环境。文档要求使用用户授权取得的 `access_token`，且应用本身已经申请通过对应 scope；未获权限仍报权限错误。**它不是免入驻、免客户端凭据或免审批的公开测试 OAuth**，也不能用模拟用户证明真实账号归属。[沙盒][sandbox]
- 权限白名单是可选的账号限制配置，默认关闭；启用后该接口只对白名单 UID 生效。这里后台让开发者填写 UID，**不等于 OAuth 用户信息会返回 UID，也不构成 openid→UID 映射证据**。本次未找到强制测试账号数、正式切换门槛或独立测试 app 凭据规则，不自行套用其他平台流程。[接口权限白名单][whitelist]

## 5. 凭据保存、有效期与撤销

官方要求妥善保管 `access_token/refresh_token`，根据返回时间判断有效性，需要续期时在过期前刷新。刷新接口为 `POST /x/account-oauth2/v1/refresh_token`，参数为 `client_id/client_secret/grant_type=refresh_token/refresh_token`；每个 refresh token 只能用一次，返回新的两种 token 和有效期。文档说 access token 过期后如需新的 token，应让用户再次授权。本次未实测刷新、并发刷新、旧 token 失效时刻或固定时长。[账号授权][oauth]

`[INFERENCE]` 若后续实现，仅服务端持有 app secret、code 和 token；对存储及日志作秘密数据保护，不把它们写进前端、日志、文档或源码。需刷新时应原子替换新的 refresh token，避免重复使用一次性令牌。此处是据官方安全要求推导的实现约束，不是新增 B 站协议要求。[网页应用接入][web]、[账号授权][oauth]、[接口签名][signing]

账号授权文档要求接入方处理用户主动撤销或注销的消息，解除授权事件含 `openid/client_id/permits`。`[INFERENCE]` violet 应按实际撤销范围停止相应授权用途，失效凭据与基于该授权的绑定状态不能继续当作有效。**删除本站 token 不等于用户已经在 B 站撤销授权**；当前已读文档未给出第三方主动 revoke token / 撤销授权接口，不编造该接口。[账号授权][oauth]、[解除授权][deauthorize]

**仅作一次身份验证是否能不长期存 token？** `[INFERENCE]` 从调用依赖看，成功取得并确认稳定 openid 后，一次性验证可以减少长期保留 token 的必要性；匿名公开清单 GET 本身不使用开放平台 token。但这不能绕过 UID 关联缺口，也不能免除撤销 / 注销事件处理。官方文档说 token 过期期间基础授权仍存在、用户仍可手动取消授权，因此不能把“token 过期 / 本站删除 token”当作平台授权自动解除。[账号授权][oauth]、[获取用户公开信息][userinfo]、[已有清单实测](bilibili-bangumi-feasibility.md)

## 6. 为什么不能把扫码登录 / Cookie 登录直接叫第三方 OAuth

本次实际读取到的**官方第三方 OAuth**协议明确具有：注册获批的应用 ID / secret、配置的第三方回调、用户对应用权限的授权、code 交换、OAuth access token、应用签名，以及撤销通知。这些才是本文已确认的第三方委托授权机制；不能因为某种网页登录用了二维码或得到了 Cookie，就声称它具有同样的第三方授权边界。[网页应用接入][web]、[账号授权][oauth]、[获取用户公开信息][userinfo]

本次未生成、轮询或扫描 passport 登录码，未读取登录 Cookie，也没有取得可引用的 passport QR 官方协议正文；因此不对具体扫码响应字段、Cookie 权限、扫码后能否拿到 UID作实测结论。这里**不禁止用户在 B 站官方 OAuth 页面按其提供的方式登录**；区分的是“向已注册第三方应用授权”与“本站代持一个 B 站网页登录会话”，不能从扫码 UI 本身判定二者相同。[网页应用接入][web]

## 7. 如果选择官方 OAuth，需从 B 站获得的明确答复

为避免在错误的身份模型上实施，应先咨询：

- 当前开发者是否具备入驻资质，violet 域名的 ICP 主体是否满足申请条件。[入驻][enrollment]
- `USER_INFO` 之外，是否存在可获批、合规的**授权用户→公开 UID/mid**关联能力；若不外显 UID，能否通过 openid 正式读取**本人追番清单**，而非视频稿件或用户统计数据。公开文档未确认这两种能力，不能把问题写成“申请某个已存在的 scope”。[获取用户公开信息][userinfo]、[未列出功能][missing]
- “授权只用于本人归属确认，之后每天匿名读取此人的公开清单”的实际业务是否被接受；以及若用户撤销 / 注销，已有 UID 关联和同步应如何处理。匿名接口成功不等于获得平台兼容或使用许可承诺。[账号授权][oauth]、[解除授权][deauthorize]、[未列出功能][missing]
- 获批后验收网页回调匹配规则、state 回传、真实 code 换 token、`expires_in` 语义、USER_INFO 返回身份、所需 UID 关联以及撤销回调。当前没有这些真实授权证据。[网页应用接入][web]、[账号授权][oauth]

## 8. 公开个人签名一次性挑战（候选）

### 已实测的读取能力

于 `2026-10-10T02:58:25.081Z` 对 [固定官方接口][publiccard] 发起一次匿名 GET，使用 `User-Agent: Mozilla/5.0` 与 JSON Accept，不发送 Cookie，不跟随跳转。公共样例 UID 的出处见[既有清单研究](bilibili-bangumi-feasibility.md#调查方法与证据等级)。

- HTTP `200`，业务 `code=0`，`message=OK`。
- `data.card.mid` 为字符串 `"208259"`，与请求 UID 一致。
- `data.card.sign` 存在、为字符串且非空；只记录字段类型与匹配结果，不保存或展示签名正文。
- 响应 `Cache-Control: no-cache`，没有 `Age`；这不证明签名编辑后会立即可见。

第一方[账号中心][accountcenter]实际引用的[当前前端 bundle][accountbundle]也已读取并用 AST 分析，观察到 `/x/member/web/account` 和 `/x/member/web/update` 请求。没有由该 bundle 确认具体签名修改契约，也没有提交编辑请求；不能用这两个路径替代签名写入权限或即时传播的验收。

### 候选证明的强度与边界

`[INFERENCE]` 若用户能在目标 UID 的公开签名中写入本站新发的随机码，且本站随后从固定官方接口观察到同一 UID 与同一当前挑战，可证明当时对该账号公开资料的控制权。它不证明实名身份、唯一使用者、持续控制权，也不获得读取私密清单的权限。

`[INFERENCE]` 接入此候选协议至少需要保持以下约束：

- 码绑定当前本站登录用户、目标 UID、账号关联用途、有效期与一次性使用状态，不跨用户或跨次复用。
- 只由原发起用户提交验证，响应 UID 必须一致；他人复制公开码不能迁移绑定。
- 仅从固定官方 HTTPS 资料接口读取，不接受截图、昵称/头像相似、用户自报签名或任意远程 URL 作证明。
- 成功后允许用户自行恢复原签名，本站不代存真实原签名，也不保存 B 站 Cookie。
- 清楚提示码用于关联当前登录的本站账号，避免将他人发来的码当普通签名活动；码不含本站用户名、邮箱或内部用户 ID。
- 一对一关联出现冲突时不自动抢占已有关系。读取失败、字段异常、过期或未观察到码都不标记为验证成功。
- 不承诺即时生效，不高频轮询或绕过风控；签名允许字符、长度、审核与传播时延未由本次实测确认。

**完整验收尚缺用户侧步骤**：在用户授权且接受临时改签名后，实际发码、由本人写入 B 站、读取确认、恢复签名并确认关联保留。当前证据只证明匿名读取条件，不能把该候选写成“已经完成账号验证”。

本研究只更新本文档，未运行 build、lint、tests 或 formatter，未修改产品代码、配置、凭据或外部账号。

## 主来源

所有下面的文章正文均由本次读取的官方发布目录定位并成功取得；不是搜索结果摘要。[官方发布目录][docindex]

[docindex]: https://open.bilibili.com/arcopen/user/open-doc/view?id=4
[web]: https://open.bilibili.com/doc/4/aac73b2e-4ff2-b75c-4c96-35ced865797b
[oauth]: https://open.bilibili.com/doc/4/eaf0e2b5-bde9-b9a0-9be1-019bb455701c
[userinfo]: https://open.bilibili.com/doc/4/feb66f99-7d87-c206-00e7-d84164cd701c
[union]: https://open.bilibili.com/doc/4/22e9cc93-1559-f262-0375-bdcefe9257ee
[enrollment]: https://open.bilibili.com/doc/4/cbdcee3b-f57e-5c7b-cf27-83892fb811c4
[apps]: https://open.bilibili.com/doc/4/7702bf71-673f-8085-e93f-2014917e0da7
[webimage]: https://i0.hdslb.com/bfs/templar/open-static/0aea13d1b1f79421b064a14d7672c88583a79b39.png
[signing]: https://open.bilibili.com/doc/4/8673959e-f7bb-56e6-6e68-d225f971b81b
[scopes]: https://open.bilibili.com/doc/4/08f935c5-29f1-e646-85a3-0b11c2830558
[authorize]: https://open.bilibili.com/doc/4/5b70f2b6-a7d4-b4b1-6f4f-4170270e4f7a
[deauthorize]: https://open.bilibili.com/doc/4/a3f37dde-212b-b71b-5388-fbd3bfb41623
[webhooks]: https://open.bilibili.com/doc/4/b369a652-0e26-8ddb-74f0-20c74234fcd6
[sandbox]: https://open.bilibili.com/doc/4/c5fcba1e-58eb-2f84-c86b-88028b0656c0
[whitelist]: https://open.bilibili.com/doc/4/b2dc2f0e-c874-aed7-3d92-360929e79d3a
[missing]: https://open.bilibili.com/doc/4/c381daac-4b6d-9ed3-3604-19a78d358eec
[contact]: https://open.bilibili.com/doc/4/e9a4bc66-473c-3a32-2658-db94ae6513fe
[publiccard]: https://api.bilibili.com/x/web-interface/card?mid=208259
[accountcenter]: https://account.bilibili.com/account/home
[accountbundle]: https://s1.hdslb.com/bfs/static/2233-monorepo/account/static/js/index.12fc8c09.js
