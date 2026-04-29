package service

import (
	"context"
	"fmt"
	"log"
	"time"

	resend "github.com/resend/resend-go/v2"
)

// EmailService 邮件服务，封装 Resend SDK 发送各类邮件
type EmailService struct {
	// client Resend API 客户端
	client *resend.Client
	// fromEmail 发件人邮箱地址
	fromEmail string
}

// NewEmailService 创建邮件服务实例
func NewEmailService(apiKey, fromEmail string) *EmailService {
	return &EmailService{
		client:    resend.NewClient(apiKey),
		fromEmail: fromEmail,
	}
}

// SendVerificationCode 发送邮箱验证码邮件
// 向用户邮箱发送包含 6 位验证码的 HTML 邮件
func (s *EmailService) SendVerificationCode(ctx context.Context, email, code string) error {
	html := buildVerificationEmail(code)

	params := &resend.SendEmailRequest{
		From:    s.fromEmail,
		To:      []string{email},
		Subject: "验证您的邮箱地址",
		Html:    html,
	}

	_, err := s.client.Emails.SendWithContext(ctx, params)
	if err != nil {
		log.Printf("发送验证码邮件失败: %v", err)
		return fmt.Errorf("发送验证码邮件失败: %w", err)
	}

	log.Printf("验证码邮件已发送至 %s", email)
	return nil
}

// SendPasswordResetCode 发送密码重置验证码邮件
// 向用户邮箱发送包含 6 位重置码的 HTML 邮件
func (s *EmailService) SendPasswordResetCode(ctx context.Context, email, code string) error {
	html := buildPasswordResetEmail(code)

	params := &resend.SendEmailRequest{
		From:    s.fromEmail,
		To:      []string{email},
		Subject: "重置您的密码",
		Html:    html,
	}

	_, err := s.client.Emails.SendWithContext(ctx, params)
	if err != nil {
		log.Printf("发送密码重置邮件失败: %v", err)
		return fmt.Errorf("发送密码重置邮件失败: %w", err)
	}

	log.Printf("密码重置邮件已发送至 %s", email)
	return nil
}

// buildVerificationEmail 构建邮箱验证码 HTML 邮件内容
// 使用内联 CSS 样式，确保在各邮件客户端中正确显示
func buildVerificationEmail(code string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>邮箱验证码</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f7; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
    <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7; padding:40px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.08); overflow:hidden;">
                    <!-- 头部 -->
                    <tr>
                        <td style="background:linear-gradient(135deg,#667eea 0%%,#764ba2 100%%); padding:32px 40px; text-align:center;">
                            <h1 style="margin:0; color:#ffffff; font-size:24px; font-weight:600;">邮箱验证</h1>
                        </td>
                    </tr>
                    <!-- 内容 -->
                    <tr>
                        <td style="padding:40px;">
                            <p style="margin:0 0 20px; color:#333333; font-size:16px; line-height:1.6;">您好，</p>
                            <p style="margin:0 0 20px; color:#333333; font-size:16px; line-height:1.6;">感谢您注册我们的博客平台。请使用以下验证码完成邮箱验证：</p>
                            <!-- 验证码 -->
                            <div style="background-color:#f8f9fa; border:2px dashed #667eea; border-radius:8px; padding:24px; text-align:center; margin:24px 0;">
                                <p style="margin:0 0 8px; color:#666666; font-size:14px;">您的验证码</p>
                                <p style="margin:0; color:#333333; font-size:36px; font-weight:700; letter-spacing:8px; font-family:monospace;">%s</p>
                            </div>
                            <p style="margin:0 0 12px; color:#666666; font-size:14px;">验证码有效期为 <strong>10 分钟</strong>，请尽快完成验证。</p>
                            <p style="margin:0; color:#999999; font-size:13px;">如果这不是您的操作，请忽略此邮件。</p>
                        </td>
                    </tr>
                    <!-- 底部 -->
                    <tr>
                        <td style="background-color:#f8f9fa; padding:20px 40px; text-align:center; border-top:1px solid #eeeeee;">
                            <p style="margin:0; color:#999999; font-size:13px;">此邮件由系统自动发送，请勿直接回复。</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`, code)
}

// buildPasswordResetEmail 构建密码重置验证码 HTML 邮件内容
func buildPasswordResetEmail(code string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>密码重置</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f7; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
    <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7; padding:40px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.08); overflow:hidden;">
                    <!-- 头部 -->
                    <tr>
                        <td style="background:linear-gradient(135deg,#f093fb 0%%,#f5576c 100%%); padding:32px 40px; text-align:center;">
                            <h1 style="margin:0; color:#ffffff; font-size:24px; font-weight:600;">密码重置</h1>
                        </td>
                    </tr>
                    <!-- 内容 -->
                    <tr>
                        <td style="padding:40px;">
                            <p style="margin:0 0 20px; color:#333333; font-size:16px; line-height:1.6;">您好，</p>
                            <p style="margin:0 0 20px; color:#333333; font-size:16px; line-height:1.6;">我们收到了您的密码重置请求。请使用以下验证码重置您的密码：</p>
                            <!-- 验证码 -->
                            <div style="background-color:#f8f9fa; border:2px dashed #f5576c; border-radius:8px; padding:24px; text-align:center; margin:24px 0;">
                                <p style="margin:0 0 8px; color:#666666; font-size:14px;">您的重置码</p>
                                <p style="margin:0; color:#333333; font-size:36px; font-weight:700; letter-spacing:8px; font-family:monospace;">%s</p>
                            </div>
                            <p style="margin:0 0 12px; color:#666666; font-size:14px;">重置码有效期为 <strong>10 分钟</strong>，请尽快完成操作。</p>
                            <p style="margin:0; color:#999999; font-size:13px;">如果您没有请求重置密码，请忽略此邮件，您的密码不会被更改。</p>
                        </td>
                    </tr>
                    <!-- 底部 -->
                    <tr>
                        <td style="background-color:#f8f9fa; padding:20px 40px; text-align:center; border-top:1px solid #eeeeee;">
                            <p style="margin:0; color:#999999; font-size:13px;">此邮件由系统自动发送，请勿直接回复。</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`, code)
}

// formatDuration 格式化时间为中文描述
func formatDuration(d time.Duration) string {
	if d >= time.Hour {
		return fmt.Sprintf("%d小时", int(d.Hours()))
	}
	return fmt.Sprintf("%d分钟", int(d.Minutes()))
}
