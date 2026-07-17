// Package user 提供用户相关命令。
package user

import (
	"fmt"

	"github.com/spf13/cobra"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
	userendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/user"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
)

// NewCommand 创建 user 命令组。
func NewCommand(k *kit.Kit) *cobra.Command {
	c := &cobra.Command{
		Use:   "user",
		Short: "用户相关命令",
		Args:  cobra.NoArgs,
	}
	c.AddCommand(
		newAccount(k), newDetail(k), newDetailByName(k), newSubCount(k),
		newPlaylists(k), newFollows(k), newFolloweds(k), newFollowEachOther(k),
		newRecord(k), newEvents(k), newLevel(k), newSimilar(k),
	)
	return c
}

// withUID 注册 --uid 用户 ID 必填 flag。
func withUID(c *cobra.Command, uid *int64) {
	c.Flags().Int64Var(uid, "uid", 0, "用户 ID")
	_ = c.MarkFlagRequired("uid")
}

func newAccount(k *kit.Kit) *cobra.Command {
	return &cobra.Command{
		Use:   "account",
		Short: "当前账号信息(登录态)",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			if err := k.RequireLogin(); err != nil {
				return err
			}
			return kit.RenderExec(k, userendpoint.Account, &mmpb.AccountRequest{})
		},
	}
}

func newDetail(k *kit.Kit) *cobra.Command {
	var uid int64
	c := &cobra.Command{
		Use:   "detail",
		Short: "用户详情",
		Args:  cobra.NoArgs,
		// detail 需要 uid 拼进 path(/weapi/v1/user/detail/{uid}),走 RawDo。
		RunE: func(cmd *cobra.Command, _ []string) error {
			raw, _, err := k.RawDo(k.CookieCtx(), engine.Meta{
				Path: fmt.Sprintf("/weapi/v1/user/detail/%d", uid), Method: "POST",
				Crypto: engine.CryptoWeAPI, Auth: 0,
			}, map[string]any{})
			if err != nil {
				return err
			}
			kit.PrintRaw(raw)
			return nil
		},
	}
	withUID(c, &uid)
	return c
}

func newDetailByName(k *kit.Kit) *cobra.Command {
	var nickname string
	c := &cobra.Command{
		Use:   "detail-by-name",
		Short: "按昵称查用户 ID",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return kit.RenderExec(k, userendpoint.DetailByName, &mmpb.DetailByNameRequest{Nickname: nickname})
		},
	}
	c.Flags().StringVar(&nickname, "nickname", "", "用户昵称")
	_ = c.MarkFlagRequired("nickname")
	return c
}

func newSubCount(k *kit.Kit) *cobra.Command {
	return &cobra.Command{
		Use:   "sub-count",
		Short: "当前用户计数(登录态)",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			if err := k.RequireLogin(); err != nil {
				return err
			}
			return kit.RenderExec(k, userendpoint.SubCount, &mmpb.SubCountRequest{})
		},
	}
}

func newPlaylists(k *kit.Kit) *cobra.Command {
	var uid int64
	c := &cobra.Command{
		Use:   "playlists",
		Short: "用户歌单",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return kit.RenderExec(k, userendpoint.UserPlaylist, &mmpb.UserPlaylistRequest{UserId: uid})
		},
	}
	withUID(c, &uid)
	return c
}

func newFollows(k *kit.Kit) *cobra.Command {
	var uid int64
	var limit, offset int
	c := &cobra.Command{
		Use:   "follows",
		Short: "用户关注列表",
		Args:  cobra.NoArgs,
		// follows 需要 uid 拼进 path(/weapi/user/getfollows/{uid}),走 RawDo。
		RunE: func(cmd *cobra.Command, _ []string) error {
			raw, _, err := k.RawDo(k.CookieCtx(), engine.Meta{
				Path: fmt.Sprintf("/weapi/user/getfollows/%d", uid), Method: "POST",
				Crypto: engine.CryptoWeAPI, Auth: 0,
			}, map[string]any{"offset": int32(offset), "limit": int32(limit), "order": true})
			if err != nil {
				return err
			}
			kit.PrintRaw(raw)
			return nil
		},
	}
	withUID(c, &uid)
	c.Flags().IntVar(&limit, "limit", 20, "返回数量")
	c.Flags().IntVar(&offset, "offset", 0, "偏移量")
	return c
}

func newFolloweds(k *kit.Kit) *cobra.Command {
	var uid int64
	var limit, offset int
	c := &cobra.Command{
		Use:   "followeds",
		Short: "用户粉丝列表",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return kit.RenderExec(k, userendpoint.Followeds, &mmpb.FollowedsRequest{UserId: uid, Limit: int32(limit), Offset: int32(offset)})
		},
	}
	withUID(c, &uid)
	c.Flags().IntVar(&limit, "limit", 20, "返回数量")
	c.Flags().IntVar(&offset, "offset", 0, "偏移量")
	return c
}

func newFollowEachOther(k *kit.Kit) *cobra.Command {
	var uid, target int64
	c := &cobra.Command{
		Use:   "follow-each-other",
		Short: "是否互相关注",
		Args:  cobra.NoArgs,
		// 需要 target uid 拼进 path(/weapi/user/getfollows/{uid}),走 RawDo。
		RunE: func(cmd *cobra.Command, _ []string) error {
			req := &mmpb.FollowEachOtherRequest{UserId: uid, TargetUserId: target}
			raw, _, err := k.RawDo(k.CookieCtx(), userendpoint.FollowEachOtherMeta(target), userendpoint.FollowEachOtherRequest(req))
			if err != nil {
				return err
			}
			resp, err := userendpoint.ParseFollowEachOther(req, raw)
			if err != nil {
				return err
			}
			return k.Render(resp)
		},
	}
	withUID(c, &uid)
	c.Flags().Int64Var(&target, "target", 0, "对方用户 ID")
	_ = c.MarkFlagRequired("target")
	return c
}

func newRecord(k *kit.Kit) *cobra.Command {
	var uid int64
	var typ int
	c := &cobra.Command{
		Use:   "record",
		Short: "听歌排行",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return kit.RenderExec(k, userendpoint.Record, &mmpb.RecordRequest{UserId: uid, Type: int32(typ)})
		},
	}
	withUID(c, &uid)
	c.Flags().IntVar(&typ, "type", 0, "0=本周 1=全部")
	return c
}

func newEvents(k *kit.Kit) *cobra.Command {
	var uid, lastID int64
	var limit int
	c := &cobra.Command{
		Use:   "events",
		Short: "用户动态",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return kit.RenderExec(k, userendpoint.Events, &mmpb.EventsRequest{UserId: uid, Limit: int32(limit), LastEventId: lastID})
		},
	}
	withUID(c, &uid)
	c.Flags().IntVar(&limit, "limit", 30, "返回数量")
	c.Flags().Int64Var(&lastID, "last-event-id", 0, "偏移量(上一页最后一条动态 ID)")
	return c
}

func newLevel(k *kit.Kit) *cobra.Command {
	var uid int64
	c := &cobra.Command{
		Use:   "level",
		Short: "用户等级",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return kit.RenderExec(k, userendpoint.Level, &mmpb.LevelRequest{UserId: uid})
		},
	}
	withUID(c, &uid)
	return c
}

func newSimilar(k *kit.Kit) *cobra.Command {
	var id int64
	c := &cobra.Command{
		Use:   "similar",
		Short: "相似用户(按歌曲)",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return kit.RenderExec(k, userendpoint.SimilarUsers, &mmpb.SimilarUsersRequest{SongId: id})
		},
	}
	c.Flags().Int64Var(&id, "id", 0, "歌曲 ID")
	_ = c.MarkFlagRequired("id")
	return c
}
