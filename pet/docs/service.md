# 独立宠物服务

#525 的实现说明。`pet-service` 持有账号宠物的**唯一权威状态**，使用自己的凭据与存储，直接执行规则核心。它不读取 Violet 的任何表，不调用 Violet 的 API，也不依赖 SSR。

> **出生协议尚未经过独立安全评审（#518）**，评审通过前不要对外宣称“正式可验证发行”。下面的“已知限制”列出了这个增量刻意没做的部分。

## 运行

```sh
cargo build --release -p pet-service
PET_DB=./pet.db PET_WORLD=my-site PET_AUDIENCE=pet.example.com PET_ISSUER_NAME=pet.example.com PET_KID=p1 \
PET_SIGNING_SEED=<64 位十六进制> PET_TOKEN_SECRET=<64 位十六进制> PET_ELIGIBILITY_SECRET=<64 位十六进制> \
PET_TRUSTED_ISSUERS='[{"iss":"violet","keys":[{"kid":"v1","public_key":"<64 位十六进制>","not_before":"0"}]}]' \
./target/release/pet-service
```

缺少必需项时服务**直接退出并说明**，不使用不安全的默认值。三个 32 字节密钥用 `openssl rand -hex 32` 生成，彼此独立。

| 变量 | 含义 |
|---|---|
| `PET_DB` | SQLite 文件路径，或 Postgres 连接串（`postgres://…` 或含 `host=`） |
| `PET_DB_SCHEMA` | Postgres schema，默认 `pet`；启动时自动建表 |
| `PET_WORLD` | 本实例的世界。一个实例对应一个世界，不同世界互不可见 |
| `PET_AUDIENCE` | 身份断言必须面向的受众 |
| `PET_ISSUER_NAME`、`PET_KID` | 出生证书中的发行者名与签名密钥标识 |
| `PET_SIGNING_SEED` | 出生证书的 Ed25519 签名密钥种子 |
| `PET_TOKEN_SECRET` | 访问令牌的 HMAC 密钥 |
| `PET_ELIGIBILITY_SECRET` | 资格摘要的盐，使外部无法反推账号 |
| `PET_TRUSTED_ISSUERS` | 受信任的身份发行者及其公钥集（JSON，支持轮换窗口与撤销） |
| `PET_PUBLISHED_KEYS` | 可选。轮换后需继续公开的旧证书公钥（JSON 数组），当前钥自动加入 |
| `PET_LISTEN` | 监听地址，默认 `127.0.0.1:8787` |

服务不终止 TLS，应放在反向代理之后。

## 接口

| 方法与路径 | 认证 | 作用 |
|---|---|---|
| `GET /healthz` | 无 | 存活探测 |
| `GET /v1/capabilities` | 无 | 能力目录（与 `docs/capabilities.md` 同源） |
| `GET /v1/issuer-keys` | 无 | 出生证书公钥集，供任何人验证证书 |
| `POST /v1/auth/exchange` | 身份断言 | 用接入方签发的断言换取服务访问令牌 |
| `POST /v1/births` | 令牌 | 开始领取：返回承诺与承诺收据 |
| `GET /v1/births/{id}` | 令牌 | 查看领取状态（接受前只含承诺，绝不含 `server_seed`） |
| `POST /v1/births/{id}/accept` | 令牌 | 固定客户端随机材料并揭示，返回证书与宠物 |
| `GET /v1/pets/me` | 令牌 | 当前主宠的投影 |
| `POST /v1/pets/me/actions` | 令牌 | 执行动作，体为 `{action, request_id}` |
| `GET /v1/pets/me/evolution` | 令牌 | 进化分支与缺项说明 |

响应统一为 `{ok:true,value}` 或 `{ok:false,code,message}`。时间由服务端决定，客户端不能指定逻辑时间。

## 身份

接入方（如 Violet）用自己的 Ed25519 密钥签发**短期身份断言**：`v1.<payload>.<signature>`，载荷含 `iss`、`sub`、`aud`、`kid`、`jti`、`iat`、`exp`。服务校验发行者与密钥窗口（含轮换与撤销）、签名、受众、过期、存活时间不超过 300 秒，并拒绝重放同一 `jti`，随后签发自己的访问令牌（1 小时）。账号以 `(iss, sub)` 标识，不按邮箱或用户名合并。

## 已验证的保证

由 HTTP 层测试（20 项）和真实二进制端到端验收（SQLite 与 Postgres）覆盖，其中关键防护用变异检查确认测试会失败：

- 未认证请求先得到 401，畸形请求体不会泄露任何信息；断言的九类失败各有独立错误码；断言不可重放。
- 领取：服务重启不会重抽，揭示与重启前公布的承诺一致；同样的重试返回同一份证书；接受之后客户端随机材料不可更改；`server_seed` 在接受前不出现在任何响应里；并发的相同接受只产生一只宠物。
- 一个账号在一个世界里同时只有一只存活的主宠；已逝去的个体先归档为纪念，再被新个体替换，绝不复活。
- 证书可由独立的 WebAssembly 验证器核验。
- 动作：状态、库存与命令结果原子提交；重放返回原结果，且跨过一分钟边界的重试不会被误判为请求标识复用；12 个并发喂食请求恰好只花掉 5 份库存。
- 账号之间、世界之间互相不可见，猜测出生标识没有任何权限。

## 已知限制（这个增量刻意没做）

| 限制 | 影响与后续 |
|---|---|
| 访问令牌无状态，没有撤销与刷新令牌 | 令牌 1 小时后失效，只能靠重新换取；需要令牌存储才能撤销（CLI 授权见 #532） |
| 断言重放防护在进程内 | 多实例部署时同一断言可能在不同实例各用一次，需要换成共享存储 |
| `server_seed` 以明文存入数据库 | 应静态加密，加密密钥管理属于 #518 的评审内容 |
| 每个请求新开一个数据库连接 | 与契约测试一致但不是生产形态，需要连接池 |
| 没有速率限制与账号层面的反刷 | 属于运维与协议规范，见 #518 |
| 没有再领养冷却（草案为死亡后 24 小时） | 数值待评审，见 `parameters.md` |
| 奖励发放（`grant`）没有对外开放 | 资格、去重与上限属于活动结算（#527），不能让客户端指定收益 |
| 主宠位之外的“退役”“蛋”尚不存在 | 属于繁育（#539） |
| 没有指标与结构化日志 | 内部错误只写到标准错误 |

## 数据升级

数据表由服务在启动时 `CREATE TABLE IF NOT EXISTS` 创建。存档中新增字段用默认值兼容旧存档；规则版本不被支持时服务拒绝结算而不是猜测迁移（见 `versioning.md`）。尚没有破坏性的表结构变更，也就没有迁移工具；第一次需要时再引入。

## 镜像

`Dockerfile.service` 是多阶段构建（构建阶段编译，运行阶段为非 root 用户），数据放在 `/data` 卷。**本机因 Docker 磁盘已满没有验证过构建**，由 CI 构建并做一次冒烟检查。

```sh
docker build -f Dockerfile.service -t pet-service pet
docker run --rm -p 8787:8787 -v pet-data:/data -e PET_DB=/data/pet.db -e … pet-service
```
