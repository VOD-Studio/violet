// Package presence 定义 Nowbeam 实时状态接收端的领域模型：设备凭证、快照来源与协议时限。
//
// 站点作为 nowbeam.v1 接收端：设备凭证由站长签发并绑定设备身份，快照只存在内存，
// 过期、断开或服务重启即消失，不保留活动历史。
package presence

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	domainshared "blog-api/internal/domain/shared"
)

// DeviceTokenPrefix 设备凭证明文前缀，便于在客户端配置与日志脱敏时识别。
const DeviceTokenPrefix = "violet_nb_"

// MaxDisplayNameRunes 设备公开名称上限（Unicode 码点）。
const MaxDisplayNameRunes = 128

// Device 已授权上报的设备聚合根。
//
// 不变量：
//   - id 为随机 UUID v4，作为 welcome.deviceId 下发，只在本站内稳定，不取硬件或主机名
//   - tokenHash 创建后不变；明文凭证只在签发时返回一次
//   - displayName 由站长填写，不自动使用主机名
type Device struct {
	// id 设备 ID（随机 UUID v4）
	id domainshared.ID
	// displayName 公开展示名称（已修剪首尾空白，≤128 码点，不含控制与不可见格式字符）
	displayName string
	// tokenHash 设备凭证的 SHA-256 hex
	tokenHash string
	// createdAt 签发时间
	createdAt time.Time
}

// NewDevice 签发新设备凭证，返回设备与仅此一次可见的明文凭证。
func NewDevice(displayName string, now time.Time) (*Device, string, error) {
	name, err := NormalizeDisplayName(displayName)
	if err != nil {
		return nil, "", err
	}
	raw, err := generateToken()
	if err != nil {
		return nil, "", domainshared.Internal("生成设备凭证失败", err)
	}
	return &Device{id: domainshared.NewID(), displayName: name, tokenHash: HashToken(raw), createdAt: now}, raw, nil
}

// ReconstructDevice 从持久化数据重建设备。
func ReconstructDevice(id domainshared.ID, displayName, tokenHash string, createdAt time.Time) *Device {
	return &Device{id: id, displayName: displayName, tokenHash: tokenHash, createdAt: createdAt}
}

func (d *Device) ID() domainshared.ID  { return d.id }
func (d *Device) DisplayName() string  { return d.displayName }
func (d *Device) TokenHash() string    { return d.tokenHash }
func (d *Device) CreatedAt() time.Time { return d.createdAt }

// NormalizeDisplayName 校验并修剪设备公开名称。
func NormalizeDisplayName(raw string) (string, error) {
	name := strings.TrimSpace(raw)
	if name == "" {
		return "", domainshared.Validation("设备名称不能为空")
	}
	if utf8.RuneCountInString(name) > MaxDisplayNameRunes {
		return "", domainshared.Validation("设备名称不能超过 128 个字符")
	}
	for _, r := range name {
		if unicode.IsControl(r) || unicode.Is(unicode.Cf, r) {
			return "", domainshared.Validation("设备名称不能包含控制字符或不可见格式字符")
		}
	}
	return name, nil
}

// HashToken 对明文设备凭证取 SHA-256 hex；库中只存哈希。
func HashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func generateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return DeviceTokenPrefix + base64.RawURLEncoding.EncodeToString(b), nil
}
