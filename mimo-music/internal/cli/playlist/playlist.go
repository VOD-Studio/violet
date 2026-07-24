// Package playlist 提供歌单相关命令。
package playlist

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/spf13/cobra"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
	playlistendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/playlist"
)

// NewCommand 创建 playlist 命令组。
func NewCommand(k *kit.Kit) *cobra.Command {
	c := &cobra.Command{
		Use:   "playlist",
		Short: "歌单相关命令",
		Args:  cobra.NoArgs,
	}
	c.AddCommand(
		newDetail(k), newTracks(k), newSubscribers(k),
		newHighQuality(k), newHighQualityTags(k), newCatList(k), newHot(k),
		newSimilar(k), newRelated(k),
		newSubscribe(k), newCreate(k), newDelete(k),
		newUpdateName(k), newUpdateDesc(k), newUpdateTags(k), newUpdateTracks(k),
		newDownload(k),
	)
	return c
}

// withID 注册 --id 歌单 ID flag(非必填,由位置参数补,#38)。
func withID(c *cobra.Command, id *int64) {
	c.Flags().Int64Var(id, "id", 0, "歌单 ID")
}

// parseIDs 把 "1,2,3" 解析成 int64 切片,空串或含非数字时报错。
func parseIDs(s string) ([]int64, error) {
	if strings.TrimSpace(s) == "" {
		return nil, fmt.Errorf("--tracks 不能为空")
	}
	parts := strings.Split(s, ",")
	ids := make([]int64, 0, len(parts))
	for _, p := range parts {
		id, err := strconv.ParseInt(strings.TrimSpace(p), 10, 64)
		if err != nil {
			return nil, fmt.Errorf("无效的歌曲 ID %q", strings.TrimSpace(p))
		}
		ids = append(ids, id)
	}
	return ids, nil
}

func newDetail(k *kit.Kit) *cobra.Command {
	var id int64
	c := &cobra.Command{
		Use:   "detail",
		Short: "歌单详情",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			rid, err := kit.ResolveID(id, args)
			if err != nil {
				return err
			}
			return kit.RenderExec(k, playlistendpoint.GetPlaylist, &mmpb.GetPlaylistRequest{PlaylistId: rid})
		},
	}
	withID(c, &id)
	return c
}

func newTracks(k *kit.Kit) *cobra.Command {
	var id int64
	c := &cobra.Command{
		Use:   "tracks",
		Short: "歌单全部歌曲",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			rid, err := kit.ResolveID(id, args)
			if err != nil {
				return err
			}
			return kit.RenderExec(k, playlistendpoint.AllTracks, &mmpb.AllTracksRequest{PlaylistId: rid})
		},
	}
	withID(c, &id)
	return c
}

func newSubscribers(k *kit.Kit) *cobra.Command {
	var id int64
	c := &cobra.Command{
		Use:   "subscribers",
		Short: "歌单收藏者",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			rid, err := kit.ResolveID(id, args)
			if err != nil {
				return err
			}
			return kit.RenderExec(k, playlistendpoint.Subscribers, &mmpb.SubscribersRequest{PlaylistId: rid})
		},
	}
	withID(c, &id)
	return c
}

func newHighQuality(k *kit.Kit) *cobra.Command {
	var cat string
	var limit int
	c := &cobra.Command{
		Use:   "highquality",
		Short: "精品歌单",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return kit.RenderExec(k, playlistendpoint.HighQuality, &mmpb.HighQualityRequest{Cat: cat, Limit: int32(limit)})
		},
	}
	c.Flags().StringVar(&cat, "cat", "全部", "分类")
	c.Flags().IntVar(&limit, "limit", 10, "返回数量")
	return c
}

func newHighQualityTags(k *kit.Kit) *cobra.Command {
	return &cobra.Command{
		Use:   "highquality-tags",
		Short: "精品歌单标签",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return kit.RenderExec(k, playlistendpoint.HighQualityTags, &mmpb.HighQualityTagsRequest{})
		},
	}
}

func newCatList(k *kit.Kit) *cobra.Command {
	return &cobra.Command{
		Use:   "catlist",
		Short: "歌单分类列表",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return kit.RenderExec(k, playlistendpoint.CatList, &mmpb.CatListRequest{})
		},
	}
}

func newHot(k *kit.Kit) *cobra.Command {
	return &cobra.Command{
		Use:   "hot",
		Short: "热门歌单",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return kit.RenderExec(k, playlistendpoint.BrowseHot, &mmpb.BrowseHotRequest{})
		},
	}
}

func newSimilar(k *kit.Kit) *cobra.Command {
	var id int64
	c := &cobra.Command{
		Use:   "similar",
		Short: "相似歌单(按歌曲)",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			rid, err := kit.ResolveID(id, args)
			if err != nil {
				return err
			}
			return kit.RenderExec(k, playlistendpoint.SimilarPlaylists, &mmpb.SimilarPlaylistsRequest{SongId: rid})
		},
	}
	c.Flags().Int64Var(&id, "id", 0, "歌曲 ID")
	return c
}

func newRelated(k *kit.Kit) *cobra.Command {
	var id int64
	c := &cobra.Command{
		Use:   "related",
		Short: "相关歌单推荐",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			rid, err := kit.ResolveID(id, args)
			if err != nil {
				return err
			}
			return kit.RenderExec(k, playlistendpoint.RelatedPlaylistRecommend, &mmpb.RelatedPlaylistRecommendRequest{PlaylistId: rid})
		},
	}
	withID(c, &id)
	return c
}

func newSubscribe(k *kit.Kit) *cobra.Command {
	var id int64
	c := &cobra.Command{
		Use:   "subscribe",
		Short: "收藏/取消收藏歌单(写操作,登录态)",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			rid, err := kit.ResolveID(id, args)
			if err != nil {
				return err
			}
			if err := k.RequireLogin(); err != nil {
				return err
			}
			if err := k.ConfirmFatal(fmt.Sprintf("收藏/取消收藏歌单 %d", rid)); err != nil {
				return err
			}
			raw, _, err := k.RawDo(k.CookieCtx(), playlistendpoint.SubscribeMeta, playlistendpoint.SubscribeRequest(&mmpb.SubscribeRequest{PlaylistId: rid}))
			if err != nil {
				return err
			}
			return k.Render(playlistendpoint.ParseSubscribed(raw))
		},
	}
	withID(c, &id)
	return c
}

func newCreate(k *kit.Kit) *cobra.Command {
	var name string
	var privacy bool
	c := &cobra.Command{
		Use:   "create",
		Short: "创建歌单(写操作,登录态)",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			if err := k.RequireLogin(); err != nil {
				return err
			}
			if err := k.ConfirmFatal(fmt.Sprintf("创建歌单 %s", name)); err != nil {
				return err
			}
			raw, _, err := k.RawDo(k.CookieCtx(), playlistendpoint.CreateMeta, playlistendpoint.CreateRequest(&mmpb.CreateRequest{Name: name, Privacy: privacy}))
			if err != nil {
				return err
			}
			return k.Render(playlistendpoint.ParseCreateResponse(raw))
		},
	}
	c.Flags().StringVar(&name, "name", "", "歌单名")
	c.Flags().BoolVar(&privacy, "privacy", false, "是否隐私")
	_ = c.MarkFlagRequired("name")
	return c
}

func newDelete(k *kit.Kit) *cobra.Command {
	var id int64
	c := &cobra.Command{
		Use:   "delete",
		Short: "删除歌单(写操作,登录态)",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			rid, err := kit.ResolveID(id, args)
			if err != nil {
				return err
			}
			if err := k.RequireLogin(); err != nil {
				return err
			}
			if err := k.ConfirmFatal(fmt.Sprintf("删除歌单 %d", rid)); err != nil {
				return err
			}
			_, _, err = k.RawDo(k.CookieCtx(), playlistendpoint.DeleteMeta, playlistendpoint.DeleteRequest(&mmpb.DeleteRequest{PlaylistId: rid}))
			if err != nil {
				return err
			}
			fmt.Println("已删除")
			return nil
		},
	}
	withID(c, &id)
	return c
}

func newUpdateName(k *kit.Kit) *cobra.Command {
	var id int64
	var name string
	c := &cobra.Command{
		Use:   "update-name",
		Short: "歌单改名(写操作,登录态)",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			rid, err := kit.ResolveID(id, args)
			if err != nil {
				return err
			}
			if err := k.RequireLogin(); err != nil {
				return err
			}
			if err := k.ConfirmFatal(fmt.Sprintf("把歌单 %d 改名为 %q", rid, name)); err != nil {
				return err
			}
			_, _, err = k.RawDo(k.CookieCtx(), playlistendpoint.UpdateNameMeta, playlistendpoint.UpdateNameRequest(&mmpb.UpdateNameRequest{PlaylistId: rid, Name: name}))
			if err != nil {
				return err
			}
			fmt.Println("已更新")
			return nil
		},
	}
	withID(c, &id)
	c.Flags().StringVar(&name, "name", "", "新名称")
	_ = c.MarkFlagRequired("name")
	return c
}

func newUpdateDesc(k *kit.Kit) *cobra.Command {
	var id int64
	var desc string
	c := &cobra.Command{
		Use:   "update-desc",
		Short: "修改歌单描述(写操作,登录态)",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			rid, err := kit.ResolveID(id, args)
			if err != nil {
				return err
			}
			if err := k.RequireLogin(); err != nil {
				return err
			}
			if err := k.ConfirmFatal(fmt.Sprintf("修改歌单 %d 的描述", rid)); err != nil {
				return err
			}
			_, _, err = k.RawDo(k.CookieCtx(), playlistendpoint.UpdateDescMeta, playlistendpoint.UpdateDescRequest(&mmpb.UpdateDescRequest{PlaylistId: rid, Desc: desc}))
			if err != nil {
				return err
			}
			fmt.Println("已更新")
			return nil
		},
	}
	withID(c, &id)
	c.Flags().StringVar(&desc, "desc", "", "新描述")
	_ = c.MarkFlagRequired("desc")
	return c
}

func newUpdateTags(k *kit.Kit) *cobra.Command {
	var id int64
	var tags string
	c := &cobra.Command{
		Use:   "update-tags",
		Short: "修改歌单标签(写操作,登录态)",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			rid, err := kit.ResolveID(id, args)
			if err != nil {
				return err
			}
			if err := k.RequireLogin(); err != nil {
				return err
			}
			if err := k.ConfirmFatal(fmt.Sprintf("把歌单 %d 的标签改为 %q", rid, tags)); err != nil {
				return err
			}
			_, _, err = k.RawDo(k.CookieCtx(), playlistendpoint.UpdateTagsMeta, playlistendpoint.UpdateTagsRequest(&mmpb.UpdateTagsRequest{PlaylistId: rid, Tags: tags}))
			if err != nil {
				return err
			}
			fmt.Println("已更新")
			return nil
		},
	}
	withID(c, &id)
	c.Flags().StringVar(&tags, "tags", "", "标签,分号分隔")
	_ = c.MarkFlagRequired("tags")
	return c
}

func newUpdateTracks(k *kit.Kit) *cobra.Command {
	var id int64
	var opStr, tracks string
	c := &cobra.Command{
		Use:   "update-tracks",
		Short: "歌单增删歌曲(写操作,登录态)",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			rid, err := kit.ResolveID(id, args)
			if err != nil {
				return err
			}
			ids, err := parseIDs(tracks)
			if err != nil {
				return err
			}
			op := mmpb.TracksOp_TRACKS_OP_ADD
			opText := "添加"
			switch opStr {
			case "add":
			case "del":
				op = mmpb.TracksOp_TRACKS_OP_DEL
				opText = "删除"
			default:
				return fmt.Errorf("无效的 --op %q: 只支持 add/del", opStr)
			}
			if err := k.RequireLogin(); err != nil {
				return err
			}
			if err := k.ConfirmFatal(fmt.Sprintf("对歌单 %d %s歌曲 %v", rid, opText, ids)); err != nil {
				return err
			}
			raw, _, err := k.RawDo(k.CookieCtx(), playlistendpoint.UpdateTracksMeta, playlistendpoint.UpdateTracksRequest(&mmpb.UpdateTracksRequest{PlaylistId: rid, Op: op, TrackIds: ids}))
			if err != nil {
				return err
			}
			return k.Render(playlistendpoint.ParseUpdateTracksResponse(raw))
		},
	}
	withID(c, &id)
	c.Flags().StringVar(&opStr, "op", "add", "操作: add=添加 del=删除")
	c.Flags().StringVar(&tracks, "tracks", "", "歌曲 ID,逗号分隔")
	_ = c.MarkFlagRequired("tracks")
	return c
}
