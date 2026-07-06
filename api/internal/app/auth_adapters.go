// Package app 提供 DDD 装配。本文件定义基础设施类型到应用层端口的编译期断言，
// 确保基础设施实现满足应用层端口契约。
package app

import (
	appshared "blog-api/internal/application/shared"
	infraauth "blog-api/internal/infrastructure/auth"
)

// RedisCodeStore 的方法签名已与 appshared.CodeStore 端口一致，通过断言直接满足。
var _ appshared.CodeStore = (*infraauth.RedisCodeStore)(nil)
