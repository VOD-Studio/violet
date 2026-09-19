package system

import "testing"

func TestAnalyzeSQLKeepsQuotedSemicolonInSingleStatement(t *testing.T) {
	statements, err := analyzeSQL(`SELECT E'it\'s; still one statement'`, false, false)
	if err != nil {
		t.Fatalf("带转义引号和分号的字符串应被识别为单条查询: %v", err)
	}
	if len(statements) != 1 || !statements[0].readOnly {
		t.Fatalf("期望单条只读查询，得到 %#v", statements)
	}
}

func TestAnalyzeSQLRejectsWriteInsideCTEWithoutConfirmation(t *testing.T) {
	query := `WITH removed AS (DELETE FROM users WHERE id = 1 RETURNING *) SELECT * FROM removed`
	if _, err := analyzeSQL(query, false, false); err == nil {
		t.Fatal("写入 CTE 不得被误判为只读查询")
	}
	if _, err := analyzeReadOnlySQL(query); err == nil {
		t.Fatal("数据导出不得接受写入 CTE")
	}
}
func TestAnalyzeSQLRejectsWriteInsideCTEWithoutWhereAfterConfirmation(t *testing.T) {
	query := `WITH removed AS (DELETE FROM users RETURNING *),
		filtered AS (SELECT * FROM users WHERE id = 1)
		SELECT * FROM removed`
	if _, err := analyzeSQL(query, false, true); err == nil {
		t.Fatal("危险确认不能绕过写入 CTE 的全表保护")
	}
}

func TestAnalyzeSQLRequiresTopLevelWhereForUpdate(t *testing.T) {
	query := `UPDATE users SET email = (SELECT email FROM users WHERE id = 1)`
	if _, err := analyzeSQL(query, false, true); err == nil {
		t.Fatal("子查询中的 WHERE 不能满足 UPDATE 全表保护")
	}
}

func TestAnalyzeSQLRejectsServerFileAndDatabaseLifecycleOperations(t *testing.T) {
	queries := []string{
		`COPY users TO '/tmp/users.csv'`,
		`DROP/**/DATABASE violet`,
		`ALTER DATABASE violet SET statement_timeout = 0`,
	}
	for _, query := range queries {
		if _, err := analyzeSQL(query, false, true); err == nil {
			t.Fatalf("高风险语句应被硬拒绝: %s", query)
		}
	}
}
