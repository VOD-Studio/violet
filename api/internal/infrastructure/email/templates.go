package email

import (
	"fmt"
	"html/template"
	"strings"
	"time"

	appshared "blog-api/internal/application/shared"
)

type codeEmailCopy struct {
	Title       string
	Instruction string
	Ignore      string
}

var verificationCopy = codeEmailCopy{
	Title:       "验证邮箱",
	Instruction: "回到刚才的页面，输入以下 6 位验证码继续。",
	Ignore:      "如果你没有请求这个验证码，忽略此邮件即可。",
}

var resetCopy = codeEmailCopy{
	Title:       "重置密码",
	Instruction: "回到找回密码页面，输入以下 6 位验证码，再设置新密码。",
	Ignore:      "如果你没有请求重置，忽略此邮件即可。你的密码不会更改。",
}

func renderCodeEmail(content codeEmailCopy, code string) (string, string, error) {
	validMinutes := int(appshared.VerificationCodeTTL / time.Minute)
	data := struct {
		codeEmailCopy
		Code         string
		ValidMinutes int
	}{content, code, validMinutes}
	var html strings.Builder
	if err := codeEmailTemplate.Execute(&html, data); err != nil {
		return "", "", fmt.Errorf("渲染验证码邮件: %w", err)
	}
	text := fmt.Sprintf("Violet · %s\n\n%s\n\n%s\n\n验证码在 %d 分钟内有效，请勿转发。\n%s\n", content.Title, content.Instruction, code, validMinutes, content.Ignore)
	return html.String(), text, nil
}

// 关键排版写内联样式；不支持媒体查询或禁用远程图片的客户端也能读到验证码。
var codeEmailTemplate = template.Must(template.New("code").Parse(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Violet · {{.Title}}</title>
  <style>
    :root { color-scheme: light dark; }
    @media (max-width: 400px) {
      .canvas-inset { padding: 20px 12px !important; }
      .letter-inset { padding-left: 20px !important; padding-right: 20px !important; }
    }
    @media (prefers-color-scheme: dark) {
      .canvas { background-color: #1c1820 !important; }
      .letter { background-color: #28222d !important; border-color: #413849 !important; }
      .ink { color: #f6edf9 !important; }
      .muted { color: #d8cbdc !important; }
      .rule { border-color: #4b3f53 !important; }
      .code-paper { background-color: #382d43 !important; }
      .accent { color: #e6c5f6 !important; }
    }
  </style>
</head>
<body class="canvas" style="margin:0;padding:0;background-color:#f5f1f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">{{.Instruction}} 验证码在 {{.ValidMinutes}} 分钟内有效。</div>
  <table role="presentation" class="canvas" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background-color:#f5f1f4;">
    <tr><td class="canvas-inset" align="center" style="padding:52px 16px;">
      <table role="presentation" class="letter" width="520" cellpadding="0" cellspacing="0" style="width:100%;max-width:520px;border:1px solid #e8e0e9;border-radius:14px;background-color:#fffdfd;">
        <tr><td class="letter-inset" style="padding:30px 36px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td class="rule" style="padding:0 0 16px;border-bottom:1px solid #e8e0e9;">
              <p class="accent" style="margin:0;color:#684779;font-family:Georgia,serif;font-size:23px;font-weight:700;line-height:1.2;">Violet</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td class="letter-inset" style="padding:28px 36px;">
          <h1 class="ink" style="margin:0;color:#271e2b;font-size:27px;font-weight:650;line-height:1.3;">{{.Title}}</h1>
          <p class="muted" style="margin:10px 0 22px;color:#63566b;font-size:15px;line-height:1.7;">{{.Instruction}}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td class="code-paper" style="padding:18px 20px;border-radius:8px;background-color:#f1eaf5;">
              <p class="accent" style="margin:0 0 4px;color:#684779;font-size:13px;font-weight:600;line-height:1.5;">一次性验证码</p>
              <p class="ink" style="margin:0;color:#271e2b;font-family:Consolas,'Courier New',monospace;font-size:34px;font-weight:700;letter-spacing:4px;line-height:1.25;white-space:nowrap;">{{.Code}}</p>
            </td></tr>
          </table>
          <p class="muted" style="margin:18px 0 0;color:#63566b;font-size:14px;line-height:1.65;">验证码在 <strong>{{.ValidMinutes}} 分钟</strong>内有效，请勿转发。</p>
        </td></tr>
        <tr><td class="letter-inset" style="padding:0 36px 26px;">
          <p class="muted rule" style="margin:0;padding:16px 0 0;border-top:1px solid #e8e0e9;color:#63566b;font-size:13px;line-height:1.7;">{{.Ignore}}<br>此邮件自动发送，请勿回复。</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`))
