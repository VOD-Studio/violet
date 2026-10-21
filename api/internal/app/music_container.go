package app

import (
	"blog-api/config"
	appmusic "blog-api/internal/application/music"
	"blog-api/internal/infrastructure/crypto"
	"blog-api/internal/infrastructure/kite"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	musichttp "blog-api/internal/interfaces/http/handler/music"

	"gorm.io/gorm"
)

type MusicContainer struct{ Handler *musichttp.Handler }

func NewMusicContainer(db *gorm.DB, cfg config.MusicConfig) *MusicContainer {
	var box appmusic.CredentialBox
	if len(cfg.CredentialKey) >= 32 {
		// DeriveKey 固定为合法 AES-256 密钥；缺失/弱密钥不允许凭据持久化。
		tokenBox, err := crypto.NewTokenBoxFromSecret(cfg.CredentialKey)
		if err == nil {
			box = tokenBox
		}
	}
	service := appmusic.NewService(gormrepo.NewMusicRepository(db), kite.NewClient(cfg.BaseURL, cfg.AuthToken), box)
	return &MusicContainer{Handler: musichttp.NewHandler(service)}
}
