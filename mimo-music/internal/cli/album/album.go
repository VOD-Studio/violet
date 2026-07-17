// Package album 提供专辑相关命令。
package album

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
	albumendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/album"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
)

// NewCommand 创建 album 命令组。
func NewCommand(k *kit.Kit) *cobra.Command {
	c := &cobra.Command{
		Use:   "album",
		Short: "专辑相关命令",
		Args:  cobra.NoArgs,
	}
	c.AddCommand(
		newShelf(k), newNewest(k), newAll(k),
		newDetail(k), newDynamic(k), newSongQuality(k),
		newSubscribe(k), newUnsubscribe(k), newSubscribed(k),
	)
	return c
}

// strToArea 地区字符串转 enum。
func strToArea(s string) mmpb.AlbumArea {
	switch strings.ToUpper(s) {
	case "ZH":
		return mmpb.AlbumArea_ALBUM_AREA_ZH
	case "EA":
		return mmpb.AlbumArea_ALBUM_AREA_EA
	case "KR":
		return mmpb.AlbumArea_ALBUM_AREA_KR
	case "JP":
		return mmpb.AlbumArea_ALBUM_AREA_JP
	default:
		return mmpb.AlbumArea_ALBUM_AREA_ALL
	}
}

// withID 注册 --id 专辑 ID 必填 flag。
func withID(c *cobra.Command, id *int64) {
	c.Flags().Int64Var(id, "id", 0, "专辑 ID")
	_ = c.MarkFlagRequired("id")
}

func newShelf(k *kit.Kit) *cobra.Command {
	var area string
	var limit int
	c := &cobra.Command{
		Use:   "shelf",
		Short: "新碟上架",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return kit.RenderExec(k, albumendpoint.NewAlbumShelf, &mmpb.NewAlbumShelfRequest{Area: strToArea(area), Limit: int32(limit)})
		},
	}
	c.Flags().StringVar(&area, "area", "ALL", "地区: ALL/ZH/EA/KR/JP")
	c.Flags().IntVar(&limit, "limit", 10, "返回数量")
	return c
}

func newNewest(k *kit.Kit) *cobra.Command {
	return &cobra.Command{
		Use:   "newest",
		Short: "最新专辑",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return kit.RenderExec(k, albumendpoint.NewestAlbums, &mmpb.NewestAlbumsRequest{})
		},
	}
}

func newAll(k *kit.Kit) *cobra.Command {
	var area string
	var limit, offset int
	c := &cobra.Command{
		Use:   "all",
		Short: "全部新碟",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return kit.RenderExec(k, albumendpoint.AllNewAlbums, &mmpb.AllNewAlbumsRequest{Area: strToArea(area), Limit: int32(limit), Offset: int32(offset)})
		},
	}
	c.Flags().StringVar(&area, "area", "ALL", "地区: ALL/ZH/EA/KR/JP")
	c.Flags().IntVar(&limit, "limit", 10, "返回数量")
	c.Flags().IntVar(&offset, "offset", 0, "偏移量")
	return c
}

func newDetail(k *kit.Kit) *cobra.Command {
	var id int64
	c := &cobra.Command{
		Use:   "detail",
		Short: "专辑详情",
		Args:  cobra.NoArgs,
		// detail 需要 id 拼进 path(/weapi/v1/album/{id}),走 RawDo。
		RunE: func(cmd *cobra.Command, _ []string) error {
			raw, _, err := k.RawDo(k.CookieCtx(), engine.Meta{
				Path: fmt.Sprintf("/weapi/v1/album/%d", id), Method: "POST",
				Crypto: engine.CryptoWeAPI, Auth: 0,
			}, map[string]any{})
			if err != nil {
				return err
			}
			kit.PrintRaw(raw)
			return nil
		},
	}
	withID(c, &id)
	return c
}

func newDynamic(k *kit.Kit) *cobra.Command {
	var id int64
	c := &cobra.Command{
		Use:   "dynamic",
		Short: "专辑动态信息(收藏数等)",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return kit.RenderExec(k, albumendpoint.AlbumDynamic, &mmpb.AlbumDynamicRequest{AlbumId: id})
		},
	}
	withID(c, &id)
	return c
}

func newSongQuality(k *kit.Kit) *cobra.Command {
	var id int64
	c := &cobra.Command{
		Use:   "song-quality",
		Short: "专辑歌曲音质",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return kit.RenderExec(k, albumendpoint.AlbumSongQuality, &mmpb.AlbumSongQualityRequest{AlbumId: id})
		},
	}
	withID(c, &id)
	return c
}

func newSubscribe(k *kit.Kit) *cobra.Command {
	var id int64
	c := &cobra.Command{
		Use:   "subscribe",
		Short: "收藏专辑(写操作,登录态)",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			if err := k.RequireLogin(); err != nil {
				return err
			}
			if err := k.ConfirmFatal(fmt.Sprintf("收藏专辑 %d", id)); err != nil {
				return err
			}
			return kit.RenderExec(k, albumendpoint.Subscribe, &mmpb.SubscribeAlbumRequest{AlbumId: id})
		},
	}
	withID(c, &id)
	return c
}

func newUnsubscribe(k *kit.Kit) *cobra.Command {
	var id int64
	c := &cobra.Command{
		Use:   "unsubscribe",
		Short: "取消收藏专辑(写操作,登录态)",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			if err := k.RequireLogin(); err != nil {
				return err
			}
			if err := k.ConfirmFatal(fmt.Sprintf("取消收藏专辑 %d", id)); err != nil {
				return err
			}
			return kit.RenderExec(k, albumendpoint.Unsubscribe, &mmpb.UnsubscribeAlbumRequest{AlbumId: id})
		},
	}
	withID(c, &id)
	return c
}

func newSubscribed(k *kit.Kit) *cobra.Command {
	var limit int
	c := &cobra.Command{
		Use:   "subscribed",
		Short: "已收藏专辑列表(登录态)",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			if err := k.RequireLogin(); err != nil {
				return err
			}
			return kit.RenderExec(k, albumendpoint.SubscribedAlbums, &mmpb.SubscribedAlbumsRequest{Limit: int32(limit)})
		},
	}
	c.Flags().IntVar(&limit, "limit", 25, "返回数量")
	return c
}
