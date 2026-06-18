// Package email 提供邮件发送的基础设施适配器。
//
// 实现 domain/application 的 EmailSender 端口，封装 Resend SDK。
package email

import (
	"context"
	"fmt"

	resend "github.com/resend/resend-go/v2"
	"github.com/rs/zerolog/log"
)

// Sender 邮件发送适配器（Resend 实现）
type Sender struct {
	client    *resend.Client
	fromEmail string
}

// NewSender 创建邮件发送适配器
func NewSender(apiKey, fromEmail string) *Sender {
	return &Sender{client: resend.NewClient(apiKey), fromEmail: fromEmail}
}

// SendVerificationCode 发送邮箱验证码
func (s *Sender) SendVerificationCode(ctx context.Context, email, code string) error {
	return s.send(ctx, email, "验证您的邮箱地址", buildVerificationEmail(code))
}

// SendPasswordResetCode 发送密码重置验证码
func (s *Sender) SendPasswordResetCode(ctx context.Context, email, code string) error {
	return s.send(ctx, email, "重置您的密码", buildPasswordResetEmail(code))
}

func (s *Sender) send(ctx context.Context, to, subject, html string) error {
	log.Info().Str("email", to).Str("subject", subject).Msg("发送邮件")
	_, err := s.client.Emails.SendWithContext(ctx, &resend.SendEmailRequest{
		From: s.fromEmail, To: []string{to}, Subject: subject, Html: html,
	})
	if err != nil {
		log.Error().Err(err).Str("email", to).Msg("发送邮件失败")
		return fmt.Errorf("发送邮件失败: %w", err)
	}
	log.Info().Str("email", to).Msg("邮件发送成功")
	return nil
}
