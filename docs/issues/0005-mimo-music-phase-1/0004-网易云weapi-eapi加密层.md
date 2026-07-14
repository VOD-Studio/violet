# Issue-0004：网易云 weapi/eapi 加密层

## Parent

PRD：`../../prd/0005-mimo-music-phase-1.md`
架构：`../../adr/mimo-music-architecture.md`（第 5 节技术选型）

## What to build

用 Go 标准库（crypto/aes + crypto/rsa）自实现网易云音乐的 weapi 和 eapi 加密算法。不依赖任何第三方音乐库。

weapi 流程：生成 16 位随机 secretKey → 用预设 nonce 对数据做两轮 AES-CBC-128 加密得 `params` → 对 secretKey 反转后用预设 RSA pubKey/modulus 加密得 `encSecKey`。

eapi 流程：用固定 key 做 AES 加密，对整体做 MD5 摘要。

这是纯函数层，无网络调用，可完全单元测试。加密结果必须与网易云网页端实际请求格式一致（用已知输入 + 已知输出对照验证）。

## Acceptance criteria

- [ ] `mimo-music/provider/netease/crypto.go`：weapi 加密实现
  - 生成 16 位随机 secretKey
  - 两轮 AES-CBC-128 加密生成 params
  - RSA 加密生成 encSecKey
- [ ] `mimo-music/provider/netease/crypto.go`：eapi 加密实现（固定 key AES + MD5 digest）
- [ ] 预设常量（nonce / pubKey / modulus）集中定义，有注释说明来源
- [ ] `mimo-music/provider/netease/crypto_test.go`：单元测试
  - 给定固定 secretKey + 固定输入，验证 params 和 encSecKey 输出与已知值一致
  - 验证随机 secretKey 每次不同但解密后数据一致
  - 验证 eapi 加密输出格式正确
- [ ] 只用 Go 标准库（crypto/aes, crypto/rsa, crypto/cipher, crypto/md5, encoding/hex），不引入第三方加密库
- [ ] 所有导出函数和常量有 godoc 注释
- [ ] `go test ./provider/netease/` 全绿

## Blocked by

- Issue-0001（项目骨架）

## 实现指引

weapi 加密的公开原理参考资料（算法是公开成熟的）：
- 两轮 AES-CBC-128，预设 nonce 为 `0CoVUmhQ0d8IhkALTgKtw5WxXGjzr1kzKx7l1sXr2w==`（base64）
- RSA pubKey 和 modulus 是网易云固定的公开值
- secretKey 反转后再做 RSA 加密

测试时用固定 secretKey（而非随机）来验证输出确定性，再单独验证随机模式下解密一致性。
