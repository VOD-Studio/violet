# Issue-0003：配置模块化与 docker-compose 集成

## Parent

PRD：`../../prd/0005-mimo-music-phase-1.md`

## What to build

把配置拆成模块化文件（server / provider / redis / worker 各自独立），支持 yaml 文件 + 环境变量覆盖。把 mimo-music 服务接入根 docker-compose.yml，复用现有 redis 服务。根 Makefile 新增 mimo-music 相关 target。

## Acceptance criteria

- [ ] `mimo-music/config/server.go`：服务配置（端口、环境、超时），全字段注释
- [ ] `mimo-music/config/provider.go`：provider 配置（上游超时、重试次数），全字段注释
- [ ] `mimo-music/config/redis.go`：Redis 配置（地址、密码、DB），全字段注释
- [ ] `mimo-music/config/worker.go`：worker 配置（并发数、轮询间隔），全字段注释
- [ ] `mimo-music/config/config.go`：聚合所有子配置，加载 yaml + 环境变量覆盖
- [ ] `mimo-music/config.example.yaml`：示例配置
- [ ] 根 `docker-compose.yml` 新增 `mimo-music` 服务，复用现有 redis，depends_on redis
- [ ] 根 `Makefile` 新增 target：`music`（启动）、`music-build`、`music-test`、`music-lint`
- [ ] 根 `.env.example` 新增 `MIMO_MUSIC_*` 变量
- [ ] `make music` 能通过 docker-compose 启动服务，health 检查通过
- [ ] 所有配置字段有 godoc 注释

## Blocked by

- Issue-0001（项目骨架）
