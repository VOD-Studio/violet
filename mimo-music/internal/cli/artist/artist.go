// Package artist 提供歌手相关命令。
package artist

import (
	"fmt"

	"github.com/spf13/cobra"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
	artistendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/artist"
)

// NewCommand 创建 artist 命令组。
func NewCommand(k *kit.Kit) *cobra.Command {
	c := &cobra.Command{
		Use:   "artist",
		Short: "歌手相关命令",
		Args:  cobra.NoArgs,
	}
	c.AddCommand(
		newDetail(k), newSongs(k), newTopSongs(k), newAlbums(k),
		newDesc(k), newSimilar(k), newFans(k), newToplist(k),
		newSubscribe(k),
	)
	annotateArtistRpcs(c)
	return c
}

// annotateArtistRpcs 给 artist 组各子命令打 rpc 注解(PRD-0014 #B 命令树守护)。
// albums 走裸 RawDo(/weapi/artist/albums/{id}),不经 endpoint,但对应 grpc rpc Albums,
// 必须显式标注。toplist↔TopArtists、subscribe↔ArtistSubscribe 为命名偏移。
func annotateArtistRpcs(c *cobra.Command) {
	rpcs := map[string][]string{
		"detail":    {"ArtistService/GetArtist"},
		"songs":     {"ArtistService/AllSongs"},
		"top-songs": {"ArtistService/TopSongs"},
		"albums":    {"ArtistService/Albums"},
		"desc":      {"ArtistService/Desc"},
		"similar":   {"ArtistService/Similar"},
		"fans":      {"ArtistService/Fans"},
		"toplist":   {"ArtistService/TopArtists"},
		"subscribe": {"ArtistService/ArtistSubscribe"},
	}
	for _, sub := range c.Commands() {
		if v, ok := rpcs[sub.Name()]; ok {
			kit.AnnotateRpcs(sub, v...)
		}
	}
}

// withID 注册 --id 歌手 ID 必填 flag。
func withID(c *cobra.Command, id *int64) {
	c.Flags().Int64Var(id, "id", 0, "歌手 ID")
}

func newDetail(k *kit.Kit) *cobra.Command {
	var id int64
	c := &cobra.Command{
		Use:   "detail",
		Short: "歌手详情",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			rid, err := kit.ResolveID(id, args)
			if err != nil {
				return err
			}
			return kit.RenderExec(k, artistendpoint.GetArtist, &mmpb.GetArtistRequest{ArtistId: rid})
		},
	}
	withID(c, &id)
	return c
}

func newSongs(k *kit.Kit) *cobra.Command {
	var id int64
	var limit, offset int
	c := &cobra.Command{
		Use:   "songs",
		Short: "歌手全部歌曲",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			rid, err := kit.ResolveID(id, args)
			if err != nil {
				return err
			}
			return kit.RenderExec(k, artistendpoint.AllSongs, &mmpb.AllSongsRequest{ArtistId: rid, Limit: int32(limit), Offset: int32(offset)})
		},
	}
	withID(c, &id)
	c.Flags().IntVar(&limit, "limit", 20, "返回数量")
	c.Flags().IntVar(&offset, "offset", 0, "偏移量")
	return c
}

func newTopSongs(k *kit.Kit) *cobra.Command {
	var id int64
	c := &cobra.Command{
		Use:   "top-songs",
		Short: "歌手热门歌曲",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			rid, err := kit.ResolveID(id, args)
			if err != nil {
				return err
			}
			return kit.RenderExec(k, artistendpoint.TopSongs, &mmpb.TopSongsRequest{ArtistId: rid})
		},
	}
	withID(c, &id)
	return c
}

func newAlbums(k *kit.Kit) *cobra.Command {
	var id int64
	var limit, offset int
	c := &cobra.Command{
		Use:   "albums",
		Short: "歌手专辑列表",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			rid, err := kit.ResolveID(id, args)
			if err != nil {
				return err
			}
			return kit.RenderExec(k, artistendpoint.Albums, &mmpb.AlbumsRequest{ArtistId: rid, Limit: int32(limit), Offset: int32(offset)})
		},
	}
	withID(c, &id)
	c.Flags().IntVar(&limit, "limit", 10, "返回数量")
	c.Flags().IntVar(&offset, "offset", 0, "偏移量")
	return c
}

func newDesc(k *kit.Kit) *cobra.Command {
	var id int64
	c := &cobra.Command{
		Use:   "desc",
		Short: "歌手简介",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			rid, err := kit.ResolveID(id, args)
			if err != nil {
				return err
			}
			return kit.RenderExec(k, artistendpoint.Desc, &mmpb.DescRequest{ArtistId: rid})
		},
	}
	withID(c, &id)
	return c
}

func newSimilar(k *kit.Kit) *cobra.Command {
	var id int64
	c := &cobra.Command{
		Use:   "similar",
		Short: "相似歌手",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			rid, err := kit.ResolveID(id, args)
			if err != nil {
				return err
			}
			return kit.RenderExec(k, artistendpoint.Similar, &mmpb.SimilarRequest{ArtistId: rid})
		},
	}
	withID(c, &id)
	return c
}

func newFans(k *kit.Kit) *cobra.Command {
	var id int64
	c := &cobra.Command{
		Use:   "fans",
		Short: "歌手粉丝",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			rid, err := kit.ResolveID(id, args)
			if err != nil {
				return err
			}
			return kit.RenderExec(k, artistendpoint.Fans, &mmpb.FansRequest{ArtistId: rid})
		},
	}
	withID(c, &id)
	return c
}

func newToplist(k *kit.Kit) *cobra.Command {
	var limit, offset int
	c := &cobra.Command{
		Use:   "toplist",
		Short: "歌手榜",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return kit.RenderExec(k, artistendpoint.TopArtists, &mmpb.TopArtistsRequest{Limit: int32(limit), Offset: int32(offset)})
		},
	}
	c.Flags().IntVar(&limit, "limit", 10, "返回数量")
	c.Flags().IntVar(&offset, "offset", 0, "偏移量")
	return c
}

func newSubscribe(k *kit.Kit) *cobra.Command {
	var id int64
	c := &cobra.Command{
		Use:   "subscribe",
		Short: "收藏/取消收藏歌手(写操作,登录态)",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			rid, err := kit.ResolveID(id, args)
			if err != nil {
				return err
			}
			if err := k.RequireLogin(); err != nil {
				return err
			}
			if err := k.ConfirmFatal(fmt.Sprintf("收藏/取消收藏歌手 %d", rid)); err != nil {
				return err
			}
			raw, _, err := k.RawDo(k.CookieCtx(), artistendpoint.SubscribeMeta, artistendpoint.SubscribeRequest(&mmpb.ArtistSubscribeRequest{ArtistId: rid}))
			if err != nil {
				return err
			}
			return k.Render(artistendpoint.ParseSubscribeResponse(raw))
		},
	}
	withID(c, &id)
	return c
}
