package system

import (
	"fmt"
	"strings"
	"unicode"

	domainshared "blog-api/internal/domain/shared"
)

type sqlToken struct {
	value string
	depth int
	scope int
}

type sqlStatement struct {
	sql      string
	tokens   []sqlToken
	kind     string
	readOnly bool
}

func analyzeSQL(input string, allowMulti, confirmDangerous bool) ([]sqlStatement, error) {
	parts, err := splitSQLStatements(input)
	if err != nil {
		return nil, err
	}
	if len(parts) == 0 {
		return nil, domainshared.BadRequest("SQL 不能为空")
	}
	if len(parts) > 1 && !allowMulti {
		return nil, domainshared.BadRequest("默认只允许一条语句，请显式开启多语句模式")
	}

	statements := make([]sqlStatement, 0, len(parts))
	for _, part := range parts {
		tokens, tokenErr := tokenizeSQL(part)
		if tokenErr != nil {
			return nil, tokenErr
		}
		if len(tokens) == 0 {
			continue
		}
		if reason := forbiddenSQL(tokens); reason != "" {
			return nil, domainshared.BadRequest(reason)
		}
		if kind := dmlMissingWhere(tokens); kind != "" {
			return nil, domainshared.BadRequest(strings.ToUpper(kind) + " 缺少 WHERE 子句，将影响全表")
		}
		kind := topLevelKind(tokens)
		readOnly := isReadOnlyKind(kind, tokens)
		if !readOnly && !confirmDangerous {
			return nil, domainshared.BadRequest("写入或结构变更 SQL 需要显式确认风险")
		}
		statements = append(statements, sqlStatement{
			sql: strings.TrimSpace(part), tokens: tokens, kind: kind, readOnly: readOnly,
		})
	}
	if len(statements) == 0 {
		return nil, domainshared.BadRequest("SQL 不能为空")
	}
	return statements, nil
}

func analyzeReadOnlySQL(input string) (sqlStatement, error) {
	statements, err := analyzeSQL(input, false, false)
	if err != nil {
		return sqlStatement{}, err
	}
	if len(statements) != 1 || !statements[0].readOnly {
		return sqlStatement{}, domainshared.BadRequest("导出查询必须是单条只读 SQL")
	}
	return statements[0], nil
}

func splitSQLStatements(input string) ([]string, error) {
	var parts []string
	start := 0
	state := byte(0)
	blockDepth := 0
	dollarTag := ""

	for i := 0; i < len(input); i++ {
		ch := input[i]
		switch state {
		case '\'':
			if ch == '\\' && i+1 < len(input) {
				i++
				continue
			}
			if ch == '\'' {
				if i+1 < len(input) && input[i+1] == '\'' {
					i++
				} else {
					state = 0
				}
			}
		case '"':
			if ch == '"' {
				if i+1 < len(input) && input[i+1] == '"' {
					i++
				} else {
					state = 0
				}
			}
		case '-':
			if ch == '\n' {
				state = 0
			}
		case '/':
			if ch == '/' && i+1 < len(input) && input[i+1] == '*' {
				blockDepth++
				i++
			} else if ch == '*' && i+1 < len(input) && input[i+1] == '/' {
				blockDepth--
				i++
				if blockDepth == 0 {
					state = 0
				}
			}
		case '$':
			if strings.HasPrefix(input[i:], dollarTag) {
				i += len(dollarTag) - 1
				state = 0
			}
		default:
			switch {
			case ch == '\'':
				state = '\''
			case ch == '"':
				state = '"'
			case ch == '-' && i+1 < len(input) && input[i+1] == '-':
				state = '-'
				i++
			case ch == '/' && i+1 < len(input) && input[i+1] == '*':
				state = '/'
				blockDepth = 1
				i++
			case ch == '$':
				if tag, ok := readDollarTag(input[i:]); ok {
					state = '$'
					dollarTag = tag
					i += len(tag) - 1
				}
			case ch == ';':
				if part := strings.TrimSpace(input[start:i]); part != "" {
					parts = append(parts, part)
				}
				start = i + 1
			}
		}
	}
	if state != 0 {
		return nil, domainshared.BadRequest("SQL 包含未闭合的字符串、标识符或注释")
	}
	if part := strings.TrimSpace(input[start:]); part != "" {
		parts = append(parts, part)
	}
	return parts, nil
}

func tokenizeSQL(input string) ([]sqlToken, error) {
	var tokens []sqlToken
	depth := 0
	scopeStack := []int{0}
	nextScope := 0
	state := byte(0)
	blockDepth := 0
	dollarTag := ""

	for i := 0; i < len(input); {
		ch := input[i]
		switch state {
		case '\'':
			if ch == '\\' && i+1 < len(input) {
				i += 2
				continue
			}
			i++
			if ch == '\'' {
				if i < len(input) && input[i] == '\'' {
					i++
				} else {
					state = 0
				}
			}
		case '"':
			i++
			if ch == '"' {
				if i < len(input) && input[i] == '"' {
					i++
				} else {
					state = 0
				}
			}
		case '-':
			i++
			if ch == '\n' {
				state = 0
			}
		case '/':
			if ch == '/' && i+1 < len(input) && input[i+1] == '*' {
				blockDepth++
				i += 2
			} else if ch == '*' && i+1 < len(input) && input[i+1] == '/' {
				blockDepth--
				i += 2
				if blockDepth == 0 {
					state = 0
				}
			} else {
				i++
			}
		case '$':
			if strings.HasPrefix(input[i:], dollarTag) {
				i += len(dollarTag)
				state = 0
			} else {
				i++
			}
		default:
			switch {
			case unicode.IsSpace(rune(ch)):
				i++
			case ch == '\'':
				state = '\''
				i++
			case ch == '"':
				state = '"'
				i++
			case ch == '-' && i+1 < len(input) && input[i+1] == '-':
				state = '-'
				i += 2
			case ch == '/' && i+1 < len(input) && input[i+1] == '*':
				state = '/'
				blockDepth = 1
				i += 2
			case ch == '$':
				if tag, ok := readDollarTag(input[i:]); ok {
					state = '$'
					dollarTag = tag
					i += len(tag)
				} else {
					i++
				}
			case ch == '(':
				depth++
				nextScope++
				scopeStack = append(scopeStack, nextScope)
				i++
			case ch == ')':
				if depth > 0 {
					depth--
					scopeStack = scopeStack[:len(scopeStack)-1]
				}
				i++
			case isWordByte(ch):
				start := i
				for i < len(input) && isWordByte(input[i]) {
					i++
				}
				tokens = append(tokens, sqlToken{
					value: strings.ToLower(input[start:i]),
					depth: depth,
					scope: scopeStack[len(scopeStack)-1],
				})
			default:
				i++
			}
		}
	}
	if state != 0 {
		return nil, domainshared.BadRequest("SQL 包含未闭合的字符串、标识符或注释")
	}
	return tokens, nil
}

func readDollarTag(input string) (string, bool) {
	if len(input) < 2 || input[0] != '$' {
		return "", false
	}
	for i := 1; i < len(input); i++ {
		switch ch := input[i]; {
		case ch == '$':
			return input[:i+1], true
		case ch == '_' || ch >= 'a' && ch <= 'z' || ch >= 'A' && ch <= 'Z' || i > 1 && ch >= '0' && ch <= '9':
			continue
		default:
			return "", false
		}
	}
	return "", false
}

func isWordByte(ch byte) bool {
	return ch == '_' || ch == '$' || ch >= 'a' && ch <= 'z' || ch >= 'A' && ch <= 'Z' || ch >= '0' && ch <= '9'
}

func topLevelKind(tokens []sqlToken) string {
	if len(tokens) == 0 {
		return "other"
	}
	first := tokens[0].value
	if first != "with" && first != "explain" {
		return first
	}
	for _, token := range tokens[1:] {
		if token.depth != 0 {
			continue
		}
		switch token.value {
		case "select", "insert", "update", "delete", "merge", "values", "table":
			if first == "explain" {
				return "explain:" + token.value
			}
			return token.value
		}
	}
	return first
}

func isReadOnlyKind(kind string, tokens []sqlToken) bool {
	if containsAnyToken(
		tokens,
		"insert", "update", "delete", "merge", "call", "copy", "do",
		"create", "alter", "drop", "truncate", "refresh",
	) {
		return false
	}
	switch kind {
	case "select", "show", "values", "table", "explain:select", "explain:values", "explain:table":
		return true
	case "explain":
		return true
	default:
		return false
	}
}

func forbiddenSQL(tokens []sqlToken) string {
	checks := []struct {
		sequence []string
		message  string
	}{
		{[]string{"create", "database"}, "禁止 CREATE DATABASE"},
		{[]string{"drop", "database"}, "禁止 DROP DATABASE"},
		{[]string{"create", "schema"}, "禁止 CREATE SCHEMA"},
		{[]string{"drop", "schema"}, "禁止 DROP SCHEMA"},
		{[]string{"alter", "system"}, "禁止 ALTER SYSTEM"},
		{[]string{"alter", "database"}, "禁止 ALTER DATABASE"},
		{[]string{"alter", "schema"}, "禁止 ALTER SCHEMA"},
		{[]string{"create", "tablespace"}, "禁止管理 TABLESPACE"},
		{[]string{"alter", "tablespace"}, "禁止管理 TABLESPACE"},
		{[]string{"drop", "tablespace"}, "禁止管理 TABLESPACE"},
		{[]string{"create", "temp"}, "禁止创建会话级临时对象"},
		{[]string{"create", "temporary"}, "禁止创建会话级临时对象"},
		{[]string{"drop", "owned"}, "禁止批量删除数据库对象"},
		{[]string{"reassign", "owned"}, "禁止批量转移数据库对象"},
		{[]string{"copy", "program"}, "禁止 COPY PROGRAM"},
		{[]string{"create", "extension"}, "禁止 CREATE EXTENSION"},
		{[]string{"create", "role"}, "禁止管理数据库角色"},
		{[]string{"create", "user"}, "禁止管理数据库用户"},
		{[]string{"alter", "role"}, "禁止管理数据库角色"},
		{[]string{"alter", "user"}, "禁止管理数据库用户"},
		{[]string{"drop", "role"}, "禁止管理数据库角色"},
		{[]string{"drop", "user"}, "禁止管理数据库用户"},
		{[]string{"set", "role"}, "禁止切换数据库角色"},
		{[]string{"set", "session", "authorization"}, "禁止切换数据库身份"},
	}
	for _, check := range checks {
		if hasTokenSequence(tokens, check.sequence) {
			return check.message
		}
	}
	if len(tokens) > 0 {
		switch tokens[0].value {
		case "begin", "commit", "rollback", "savepoint", "release", "vacuum", "cluster":
			return fmt.Sprintf("禁止在控制台执行 %s", strings.ToUpper(tokens[0].value))
		case "set", "reset":
			return "禁止修改数据库会话设置"
		case "grant", "revoke":
			return "禁止修改数据库权限"
		case "copy":
			return "禁止通过 COPY 访问服务器文件或程序"
		case "prepare", "execute", "deallocate", "discard", "listen", "unlisten":
			return "禁止修改数据库连接会话状态"
		case "start":
			if len(tokens) > 1 && tokens[1].value == "transaction" {
				return "禁止在控制台控制事务"
			}
		}
	}
	return ""
}

func hasTokenSequence(tokens []sqlToken, sequence []string) bool {
	if len(sequence) == 0 || len(tokens) < len(sequence) {
		return false
	}
	for i := range len(tokens) - len(sequence) + 1 {
		matched := true
		for j, expected := range sequence {
			if tokens[i+j].value != expected {
				matched = false
				break
			}
		}
		if matched {
			return true
		}
	}
	return false
}

func hasTopLevelToken(tokens []sqlToken, value string) bool {
	for _, token := range tokens {
		if token.depth == 0 && token.value == value {
			return true
		}
	}
	return false
}

func dmlMissingWhere(tokens []sqlToken) string {
	for i, token := range tokens {
		if token.value != "update" && token.value != "delete" {
			continue
		}
		hasWhere := false
		for _, candidate := range tokens[i+1:] {
			if candidate.scope == token.scope && candidate.value == "where" {
				hasWhere = true
				break
			}
		}
		if !hasWhere {
			return token.value
		}
	}
	return ""
}

func containsAnyToken(tokens []sqlToken, values ...string) bool {
	for _, token := range tokens {
		for _, value := range values {
			if token.value == value {
				return true
			}
		}
	}
	return false
}
