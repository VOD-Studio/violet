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
	// devMode 非生产环境为 true：把验证码明文打到日志，方便开发期联调
	// （生产环境只走 Resend，不会泄露验证码到日志）。
	devMode bool
}

// NewSender 创建邮件发送适配器
//
// devMode 为 true 时（非生产环境），发送验证码会同步打印明文到日志，
// 开发期无需配置 Resend 即可从日志取码联调。
func NewSender(apiKey, fromEmail string, devMode bool) *Sender {
	return &Sender{client: resend.NewClient(apiKey), fromEmail: fromEmail, devMode: devMode}
}

// SendVerificationCode 发送邮箱验证码
func (s *Sender) SendVerificationCode(ctx context.Context, email, code string) error {
	s.logDevCode("邮箱验证码", email, code)
	return s.send(ctx, email, "验证您的邮箱地址", buildVerificationEmail(code))
}

// SendPasswordResetCode 发送密码重置验证码
func (s *Sender) SendPasswordResetCode(ctx context.Context, email, code string) error {
	s.logDevCode("密码重置码", email, code)
	return s.send(ctx, email, "重置您的密码", buildPasswordResetEmail(code))
}

// logDevCode 开发模式打印验证码明文，方便联调（生产环境 no-op）
func (s *Sender) logDevCode(label, email, code string) {
	if !s.devMode {
		return
	}
	log.Info().Str("email", email).Str("code", code).Msgf("[DEV] %s", label)
}

func (s *Sender) send(ctx context.Context, to, subject, html string) error {
	log.Info().Str("email", to).Str("subject", subject).Msg("发送邮件")
	_, err := s.client.Emails.SendWithContext(ctx, &resend.SendEmailRequest{
		From: s.fromEmail, To: []string{to}, Subject: subject, Html: html,
	})
	if err != nil {
		// devMode 下 Resend 失败是预期的（未配置 key），已通过 logDevCode 打印验证码，
		// 此处降级为 warn 不阻塞业务流程。
		if s.devMode {
			log.Warn().Err(err).Str("email", to).Msg("发送邮件失败（开发模式，验证码已在上方日志打印）")
			return nil
		}
		log.Error().Err(err).Str("email", to).Msg("发送邮件失败")
		return fmt.Errorf("发送邮件失败: %w", err)
	}
	log.Info().Str("email", to).Msg("邮件发送成功")
	return nil
}
