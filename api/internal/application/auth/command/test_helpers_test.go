package command

import (
	"time"

	domainshared "blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
)

// testUserID 测试用固定 UUID（ParseID 要求合法 UUID 格式）
const testUserID = "00000000-0000-0000-0000-000000000001"

// zeroTime 占位的零值时间，供 ReconstructUser 的 createdAt/updatedAt 参数复用。
var zeroTime time.Time

// testUser 构造一个最小可用的 *User，供 FindByID mock 返回。
func testUser() *domainuser.User {
	uid, _ := domainshared.ParseID(testUserID)
	return domainuser.ReconstructUser(uid, mustEmail("u@example.com"), mustUsername("alice"), domainuser.DisplayName{}, domainuser.NewPasswordHash("hashed"), "", "", domainuser.RoleUser,
		nil, nil, false, true, true, zeroTime, zeroTime,)
}

// mustEmail 解析邮箱，解析失败 panic（测试固定值，不会失败）。
func mustEmail(s string) domainuser.Email {
	e, err := domainuser.ParseEmail(s)
	if err != nil {
		panic(err)
	}
	return e
}

// mustUsername 解析用户名，解析失败 panic（测试固定值，不会失败）。
func mustUsername(s string) domainuser.Username {
	u, err := domainuser.ParseUsername(s)
	if err != nil {
		panic(err)
	}
	return u
}

