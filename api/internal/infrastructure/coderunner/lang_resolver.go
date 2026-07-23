package coderunner

import (
	domaincoderunner "blog-api/internal/domain/coderunner"
)

// defaultLangResolver LangResolver 的默认实现，包装 Languages 注册表的包级函数。
//
// 让 application service 通过 LangResolver 端口依赖，而非直接 import infrastructure。
type defaultLangResolver struct{}

// NewLangResolver 创建默认语言解析器。
func NewLangResolver() defaultLangResolver { return defaultLangResolver{} }

func (defaultLangResolver) Normalize(lang string) string { return NormalizeLang(lang) }

func (defaultLangResolver) Resolve(langKey string) (image, cmd, ext string, defaultLimits domaincoderunner.ResourceLimits, allowNetwork bool, ok bool) {
	def, exists := Languages[langKey]
	if !exists {
		return "", "", "", domaincoderunner.ResourceLimits{}, false, false
	}
	return def.Image, def.RunCmd, def.Extension, def.DefaultLimits, def.AllowNetwork, true
}
