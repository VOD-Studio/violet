package openapi

import "github.com/getkin/kin-openapi/openapi3"

func registerSiteImpressionPaths(t *openapi3.T) {
	registerSchema(t, "SiteImpressionStateDTO", openapi3.Schemas{
		"count":     optInt64("主动留下印记的去重匿名设备数；不是浏览量或可信 UV"),
		"impressed": optBool("当前请求的 violet_impression Cookie 是否已登记"),
	}, "count", "impressed")

	get(t, "/site-impressions", &openapi3.Operation{
		Tags:        []string{"站点印记"},
		Summary:     "读取匿名设备印记状态",
		Description: "匿名读取去重设备总数和当前 Cookie 的登记状态。响应为 private, no-cache，并按 Cookie 区分。",
		Responses: responses(
			200, dataResponse("SiteImpressionStateDTO", "匿名设备印记状态", 200),
			500, errorResponse("印记状态读取失败"),
		),
	})
	post(t, "/site-impressions", &openapi3.Operation{
		Tags:        []string{"站点印记"},
		Summary:     "留下匿名设备印记",
		Description: "匿名幂等写入。首次成功时设置一年期 Secure、HttpOnly、SameSite=Lax 的 violet_impression Cookie；每个 IP 每分钟最多 10 次。",
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		Responses: responses(
			200, dataResponse("SiteImpressionStateDTO", "登记后的匿名设备印记状态", 200),
			403, errorResponse("CSRF Token 缺失或无效"),
			429, errorResponse("请求超过每分钟 10 次限额"),
			500, errorResponse("印记写入失败"),
		),
	})
}
