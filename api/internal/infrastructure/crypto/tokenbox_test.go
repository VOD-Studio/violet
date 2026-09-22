package crypto_test

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"blog-api/internal/infrastructure/crypto"
)

func testBox(t *testing.T) *crypto.TokenBox {
	t.Helper()
	box, err := crypto.NewTokenBoxFromSecret("unit-test-key-0123456789abcdef")
	require.NoError(t, err)
	require.NotNil(t, box)
	return box
}

func TestTokenBoxRoundTrip(t *testing.T) {
	box := testBox(t)
	const plain = "violet_bot_weT0jg_08SOjpkMzR9li2QzAa0PDseFrMwAcNuc1psc"

	sealed, err := box.Seal(plain)
	require.NoError(t, err)
	require.NotEmpty(t, sealed)
	require.False(t, strings.Contains(sealed, plain), "密文里不得含明文片段")
	require.NotEmpty(t, sealed)

	opened, err := box.Open(sealed)
	require.NoError(t, err)
	require.Equal(t, plain, opened)
}

func TestTokenBoxSealIsNonDeterministic(t *testing.T) {
	// nonce 随机：同一明文两次密文必须不同，否则库里能看出「这两个 bot 共用凭据」。
	box := testBox(t)
	first, err := box.Seal("violet_bot_same")
	require.NoError(t, err)
	second, err := box.Seal("violet_bot_same")
	require.NoError(t, err)
	require.NotEqual(t, first, second)

	both, err := box.Open(second)
	require.NoError(t, err)
	require.Equal(t, "violet_bot_same", both, "任一密文都独立可解")
}

func TestTokenBoxEmptyPassesThrough(t *testing.T) {
	box := testBox(t)
	sealed, err := box.Seal("")
	require.NoError(t, err)
	require.Equal(t, "", sealed, "空明文不加密，与库里「没有凭据」同形")

	opened, err := box.Open("")
	require.NoError(t, err)
	require.Equal(t, "", opened)
}

func TestTokenBoxRejectsForeignAndTampered(t *testing.T) {
	box := testBox(t)
	sealed, err := box.Seal("violet_bot_secret")
	require.NoError(t, err)

	other, err := crypto.NewTokenBoxFromSecret("a-completely-different-key-98765")
	require.NoError(t, err)
	_, err = other.Open(sealed)
	require.ErrorIs(t, err, crypto.ErrOpenFailed, "换密钥不得解出明文")

	// 篡改一个字符（末位换个 base64 符号）应被 AEAD 完整性校验拒掉。
	last := sealed[len(sealed)-1]
	if last == 'A' {
		last = 'B'
	} else {
		last = 'A'
	}
	tampered := sealed[:len(sealed)-1] + string(last)
	_, err = box.Open(tampered)
	require.ErrorIs(t, err, crypto.ErrOpenFailed, "篡改密文必须解密失败")

	_, err = box.Open("not-base64!!")
	require.ErrorIs(t, err, crypto.ErrOpenFailed, "非法编码不是有效密文")
}

func TestNewTokenBoxFromSecretBlankMeansUnconfigured(t *testing.T) {
	// 未配置密钥是合法状态（存量部署没有这一项）：返回 (nil, nil) 让调用方降级，
	// 不能 panic，也不能悄悄用一把固定密钥把「没配」当成「配了」。
	box, err := crypto.NewTokenBoxFromSecret("")
	require.NoError(t, err)
	require.Nil(t, box)
}

func TestDeriveKeyNormalizesAnySecret(t *testing.T) {
	// 任意长度的配置值都归一为 32 字节 AES key，hex/base64/口令都能用。
	require.Equal(t, 32, len(crypto.DeriveKey("x")))
	require.Equal(t, crypto.DeriveKey("x"), crypto.DeriveKey("x"), "同值必须同 key，否则重启就解不开旧密文")
	require.NotEqual(t, crypto.DeriveKey("x"), crypto.DeriveKey("y"))

	_, err := crypto.NewTokenBox(crypto.DeriveKey("passphrase"))
	require.NoError(t, err)
	_, err = crypto.NewTokenBox([]byte("too-short"))
	require.Error(t, err, "非 16/24/32 字节的原始 key 必须被 AES 拒绝")
}
