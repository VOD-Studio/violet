package repositoryactivity

// GrowthWeek 汇总默认分支在一个上海日历周内的提交。
type GrowthWeek struct {
	// Start 为该周星期一的日历日期（YYYY-MM-DD）。
	Start string `json:"start"`
	// CommitCount 只计同一仓库内去重后的提交。
	CommitCount int `json:"commit_count"`
}

// GrowthHistory 是同一公开仓库快照上的关于页读模型。
type GrowthHistory struct {
	// HistoryComplete 表明两类事件都至少完成过一次历史回填。
	HistoryComplete bool `json:"history_complete"`
	// FirstCommit 在历史尚不完整或仓库无提交时为 nil。
	FirstCommit *Commit `json:"first_commit"`
	// Weeks 只包含有提交的周，按日期升序；初次回填完成前为空。
	Weeks []GrowthWeek `json:"weeks"`
	// Releases 按实际发布时刻倒序；回填中可以先展示已同步的公开版本。
	Releases []Release `json:"releases"`
}
