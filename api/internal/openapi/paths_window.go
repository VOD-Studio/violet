package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerWindowPaths 注册「窗」的公开读取、敲窗与后台配置接口。
func registerWindowPaths(t *openapi3.T) {
	temperature := optFloat("气温（摄氏度）；天气暂不可用时为 null")
	temperature.Value.Nullable = true
	registerSchema(t, "WindowState", openapi3.Schemas{
		"enabled":       optBool("站长是否已配置城市；false 时只画默认的窗，不显示天气与时间"),
		"city":          optStr("城市名；未配置时为空串"),
		"timezone":      optStr("IANA 时区名，前端据此显示站长那边此刻的时间；未配置时为空串"),
		"condition":     optStr("clear | cloudy | fog | rain | snow | storm；空串表示天气暂不可用"),
		"is_day":        optBool("当地此刻是否白天；天气不可用时按时区本地 6–18 点粗算"),
		"temperature_c": temperature,
		"observed_at":   optStr("天气观测时间（RFC3339）；空串表示天气暂不可用"),
		"photo_slot":    optStr("此刻应显示的照片槽位：clear | cloudy | rain | snow | night"),
		"photo":         optStr("该槽位的自定义照片 URL；空串表示用内置默认图"),
	}, "enabled", "city", "timezone", "condition", "is_day", "temperature_c", "observed_at", "photo_slot", "photo")
	registerSchema(t, "WindowCity", openapi3.Schemas{
		"name":      reqStr("城市名"),
		"region":    optStr("一级行政区，可为空"),
		"country":   optStr("国家，可为空"),
		"latitude":  optFloat("纬度，-90 到 90"),
		"longitude": optFloat("经度，-180 到 180"),
		"timezone":  reqStr("IANA 时区名"),
	}, "name", "latitude", "longitude", "timezone")
	registerSchema(t, "WindowPhotos", openapi3.Schemas{
		"clear":  optStr("晴天窗外照片 URL，空串用默认图"),
		"cloudy": optStr("阴天与雾天窗外照片 URL"),
		"rain":   optStr("雨天与雷雨窗外照片 URL"),
		"snow":   optStr("雪天窗外照片 URL"),
		"night":  optStr("夜里窗外照片 URL（不分天气）"),
	})
	city := optRef("站长所在城市；null 表示未配置", "WindowCity")
	city.Value.Nullable = true
	registerSchema(t, "WindowConfig", openapi3.Schemas{
		"city":   city,
		"photos": optRef("五个槽位齐全的照片 URL", "WindowPhotos"),
	}, "city", "photos")
	registerSchema(t, "WindowConfigUpdate", openapi3.Schemas{
		"city":   city,
		"photos": optRef("各槽位照片 URL：空串、站内 / 开头路径或 http(s) 地址；未出现的槽位清空为默认图", "WindowPhotos"),
	})
	registerSchema(t, "WindowKnock", openapi3.Schemas{"page": optStr("访客所在页面路径；服务端只保留路径部分")})

	get(t, "/window", &openapi3.Operation{
		Tags: []string{"窗"}, Summary: "读取窗状态",
		Description: "全站背景用，匿名读取。天气按城市坐标缓存 15 分钟，上游失败时退回 6 小时内的旧数据，再失败则 condition 为空串。",
		Responses:   responses(200, dataResponse("WindowState", "窗状态", 200)),
	})
	post(t, "/window/knock", &openapi3.Operation{
		Tags: []string{"窗"}, Summary: "敲窗",
		Description: "访客连点两下窗的空白处时调用，给站长发一条站内通知。每位访客（摘要后的 IP）每小时一次。",
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("WindowKnock", true, "敲窗参数"),
		Responses: responses(
			204, noContentResponse("已通知站长"),
			400, errorResponse("请求体格式错误"),
			403, errorResponse("CSRF Token 缺失或无效"),
			429, errorResponse("这一小时已经敲过了"),
		),
	})
	get(t, "/admin/window", &openapi3.Operation{
		Tags: []string{"窗"}, Summary: "读取窗配置", Description: "需 admin:access 与 settings:view 权限。",
		Security:  securityAdmin(),
		Responses: responses(200, dataResponse("WindowConfig", "窗配置", 200)),
	})
	put(t, "/admin/window", &openapi3.Operation{
		Tags: []string{"窗"}, Summary: "更新窗配置", Description: "整体替换城市与照片。需 admin:access 与 settings:update 权限及 CSRF。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("WindowConfigUpdate", true, "新配置"),
		Responses: responses(
			200, dataResponse("WindowConfig", "更新后的窗配置", 200),
			400, errorResponse("请求体格式错误、城市信息不完整或照片地址不合法"),
		),
	})
	get(t, "/admin/window/cities", &openapi3.Operation{
		Tags: []string{"窗"}, Summary: "搜索城市", Description: "代理 Open-Meteo 地理编码，中文结果，最多 8 个。需 admin:access 与 settings:view 权限。",
		Security:   securityAdmin(),
		Parameters: openapi3.Parameters{queryStrParam("q", "城市名，1–40 字")},
		Responses: responses(
			200, dataArrayResponse("WindowCity", "候选城市，数组永不为 null", 200, false),
			400, errorResponse("搜索词为空或过长"),
			500, errorResponse("地理编码服务暂不可用"),
		),
	})
}
