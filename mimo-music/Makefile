.PHONY: proto proto-lint proto-deps clean

BUF := $(shell go env GOPATH)/bin/buf

## proto: 从 proto/ 生成 Go stub、gRPC service、gateway、OpenAPI 到 gen/
proto:
	cd proto && $(BUF) generate
	@echo "proto 代码生成完成"

## proto-lint: 检查 proto 文件规范
proto-lint:
	cd proto && $(BUF) lint
	@echo "proto lint 通过"

## proto-deps: 拉取 buf BSR 依赖（googleapis）
proto-deps:
	cd proto && $(BUF) dep update
	@echo "proto 依赖更新完成"

## clean: 清除生成产物
clean:
	rm -rf gen/
