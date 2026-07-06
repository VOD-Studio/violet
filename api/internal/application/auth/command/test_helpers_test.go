package command

import (
	"time"

	domainshared "blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
)

// testUserID 测试用固定 UUID（ParseID 要求合法 UUID 格式）
const testUserID = "00000000-0000-0000-0000-000000000001"

// testUser 构造一个最小可用的 *User，供 FindByID mock 返回。
func testUser() *domainuser.User {
	email, _ := domainuser.ParseEmail("u@example.com")
	username, _ := domainuser.ParseUsername("alice")
	pwd := domainuser.NewPasswordHash("hashed")
	uid, _ := domainshared.ParseID(testUserID)
	return domainuser.ReconstructUser(
		uid, email, username, pwd, "", "", domainuser.RoleUser,
		nil, nil, false, true, true, time.Time{}, time.Time{},
	)
}
