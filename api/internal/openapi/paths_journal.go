package openapi

import "github.com/getkin/kin-openapi/openapi3"

func registerJournalPaths(t *openapi3.T) {
	registerSchema(t, "JournalProject", openapi3.Schemas{
		"id": reqStr("公开项目 UUID"), "title": reqStr("项目名称"), "slug": reqStr("项目公开路由标识"),
	}, "id", "title", "slug")
	registerSchema(t, "JournalCommit", openapi3.Schemas{
		"sha": reqStr("提交 SHA"), "title": reqStr("提交消息首行"), "url": reqStr("GitHub 提交地址"),
		"occurred_at": reqStr("提交者时间，RFC3339"),
	}, "sha", "title", "url", "occurred_at")
	registerSchema(t, "JournalRelease", openapi3.Schemas{
		"tag": reqStr("版本标签"), "title": reqStr("发布名称、首条变更或标签"), "url": reqStr("GitHub 版本地址"),
		"occurred_at": reqStr("实际发布时刻，RFC3339"),
	}, "tag", "title", "url", "occurred_at")
	registerSchema(t, "JournalProgressDay", openapi3.Schemas{
		"day":      reqStr("上海日历日，YYYY-MM-DD"),
		"project":  optRef("关联公开项目", "JournalProject"),
		"first_at": reqStr("当天首条活动的时刻，RFC3339"), "last_at": reqStr("当天末条活动的时刻，RFC3339"),
		"commit_count": optInt("当天提交总数"), "release_count": optInt("当天公开发布总数"),
		"summary":  reqStr("从真实版本标题或提交主题提取的摘要"),
		"commits":  refArray("时间线最多六条；日卡详情返回该日完整提交", "JournalCommit"),
		"releases": refArray("当天所有公开版本", "JournalRelease"),
	}, "day", "project", "first_at", "last_at", "commit_count", "release_count", "summary", "commits", "releases")
	registerSchema(t, "JournalNoteEntry", openapi3.Schemas{
		"kind": strEnum("手写条目", "note"), "note": optRef("已发布手记", "PublicNoteDTO"),
	}, "kind", "note")
	registerSchema(t, "JournalProgressEntry", openapi3.Schemas{
		"kind": strEnum("自动进展条目", "progress"), "progress": optRef("项目日卡", "JournalProgressDay"),
	}, "kind", "progress")
	registerSchema(t, "JournalProgressHealth", openapi3.Schemas{
		"state":          strEnum("仓库同步状态", "unconfigured", "syncing", "ready", "stale", "limited", "failed"),
		"reason":         nullableStr("limited 或 failed；无异常时为 null"),
		"last_synced_at": nullableStr("最近一次成功刷新时刻，RFC3339；尚未成功时为 null"),
	}, "state", "reason", "last_synced_at")
	registerSchema(t, "GardenGrowthWeek", openapi3.Schemas{
		"start": reqStr("上海日历周的星期一，YYYY-MM-DD"), "commit_count": optInt("该周去重后的提交数"),
	}, "start", "commit_count")
	elapsedDays := optInt("首次提交到今天的上海日历日差；尚未知或无提交时为 null")
	elapsedDays.Value.Nullable = true
	registerSchema(t, "GardenGrowth", openapi3.Schemas{
		"today":            reqStr("当前上海日期，YYYY-MM-DD"),
		"elapsed_days":     elapsedDays,
		"history_complete": optBool("提交与发布均至少完成过一次全量回填"),
		"first_commit": {Value: &openapi3.Schema{
			Type: &openapi3.Types{openapi3.TypeObject}, Nullable: true,
			AllOf: openapi3.SchemaRefs{optRef("首次提交；历史不完整或无提交时为 null", "JournalCommit")},
		}},
		"weeks":    refArray("仅有提交的周，按日期升序；未完成回填时为空", "GardenGrowthWeek"),
		"releases": refArray("已同步的公开版本，按实际发布时间倒序", "JournalRelease"),
		"health":   optRef("后台同步状态", "JournalProgressHealth"),
	}, "today", "elapsed_days", "history_complete", "first_commit", "weeks", "releases", "health")
	registerSchema(t, "JournalPage", openapi3.Schemas{
		"entries": {Value: &openapi3.Schema{
			Type: &openapi3.Types{openapi3.TypeArray},
			Items: &openapi3.SchemaRef{Value: &openapi3.Schema{OneOf: openapi3.SchemaRefs{
				optRef("手写手记", "JournalNoteEntry"), optRef("仓库进展", "JournalProgressEntry"),
			}}},
		}},
		"next_cursor": nullableStr("下页不透明游标；末页为 null"),
		"progress": {Value: &openapi3.Schema{
			Type: &openapi3.Types{openapi3.TypeObject}, Nullable: true,
			AllOf: openapi3.SchemaRefs{optRef("后台同步状态；只筛手写记录时为 null", "JournalProgressHealth")},
		}},
	}, "entries", "next_cursor", "progress")
	get(t, "/journal", &openapi3.Operation{
		Tags: []string{"手记"}, Summary: "公开手记时间线",
		Description: "合并已发布手记和公开项目仓库进展，按上海日历日倒序，同日进展先于手写手记。标签仅筛手写手记。进展使用后台同步快照，不在读取时访问 GitHub。",
		Parameters: openapi3.Parameters{
			queryStrParam("type", "progress、pitfall、idea、excerpt 或 unclassified；缺省为全部"),
			queryStrParam("project_id", "公开项目 UUID"), queryStrParam("tag", "手写手记的标签 slug"),
			queryStrParam("cursor", "下页不透明游标"), limitParam(50),
		},
		Responses: responses(200, dataResponse("JournalPage", "时间线及仓库同步状态", 200), 400, errorResponse("分页游标或筛选条件非法")),
	})
	get(t, "/journal/growth", &openapi3.Operation{
		Tags: []string{"手记"}, Summary: "公开花园生长历史",
		Description: "从手记进展的同一快照读取站点发布仓库的公开活动。仓库必须绑定到公开项目；请求不访问 GitHub。没有完整回填时不报告首次提交或周统计。",
		Responses:   responses(200, dataResponse("GardenGrowth", "生长历史与同步状态", 200), 500, errorResponse("无法读取仓库快照")),
	})
	get(t, "/journal/progress/{projectId}/{day}", &openapi3.Operation{
		Tags: []string{"手记"}, Summary: "读取项目指定日的完整进展",
		Parameters: openapi3.Parameters{pathStrParam("projectId", "公开项目 UUID"), pathStrParam("day", "上海日历日，YYYY-MM-DD")},
		Responses:  responses(200, dataResponse("JournalProgressDay", "项目日卡及完整提交", 200), 400, errorResponse("项目或日期参数非法"), 404, errorResponse("当天无公开仓库进展")),
	})
}
