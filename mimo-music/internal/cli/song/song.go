// Package song 提供歌曲相关命令。
package song

import (
	"fmt"

	"github.com/spf13/cobra"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
	songendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/song"
)

// NewCommand 创建 song 命令组。
func NewCommand(k *kit.Kit) *cobra.Command {
	c := &cobra.Command{
		Use:   "song",
		Short: "歌曲相关命令",
		Args:  cobra.NoArgs,
	}
	c.AddCommand(
		newDetail(k), newURL(k), newLyric(k), newWordLyric(k),
		newCheckAvailable(k), newQualityDetail(k), newLikeCount(k),
		newDynamicCover(k), newChorusTime(k), newCreatorInfo(k),
		newSimilarSongs(k),
		newLike(k), newTrash(k), newDisallowRecommend(k),
		newLikedList(k), newIsLike(k),
		newDownload(k),
	)
	return c
}

// simple 构造一个单 --id 参数的读命令。
func simple(k *kit.Kit, use, short string, run func(id int64) error) *cobra.Command {
	var id int64
	c := &cobra.Command{
		Use:   use,
		Short: short,
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return run(id)
		},
	}
	c.Flags().Int64Var(&id, "id", 0, "歌曲 ID")
	_ = c.MarkFlagRequired("id")
	return c
}

func newDetail(k *kit.Kit) *cobra.Command {
	return simple(k, "detail", "歌曲详情", func(id int64) error {
		return kit.RenderExec(k, songendpoint.Detail, &mmpb.GetSongDetailRequest{SongId: id})
	})
}

func newURL(k *kit.Kit) *cobra.Command {
	var id int64
	var level int
	c := &cobra.Command{
		Use:   "url",
		Short: "歌曲播放地址",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return kit.RenderExec(k, songendpoint.URL, &mmpb.GetSongURLRequest{SongId: id, Level: mmpb.SongLevel(level)})
		},
	}
	c.Flags().Int64Var(&id, "id", 0, "歌曲 ID")
	c.Flags().IntVar(&level, "level", 1, "音质: 1=standard 2=exhigh 3=lossless 4=hires")
	_ = c.MarkFlagRequired("id")
	return c
}

func newLyric(k *kit.Kit) *cobra.Command {
	return simple(k, "lyric", "歌词", func(id int64) error {
		return kit.RenderExec(k, songendpoint.Lyric, &mmpb.GetLyricRequest{SongId: id})
	})
}

func newWordLyric(k *kit.Kit) *cobra.Command {
	return simple(k, "word-lyric", "逐字歌词", func(id int64) error {
		return kit.RenderExec(k, songendpoint.WordLyricEP, &mmpb.GetWordLyricRequest{SongId: id})
	})
}

func newCheckAvailable(k *kit.Kit) *cobra.Command {
	return simple(k, "check-available", "检查歌曲是否可用", func(id int64) error {
		return kit.RenderExec(k, songendpoint.CheckAvailable, &mmpb.CheckAvailableRequest{SongId: id})
	})
}

func newQualityDetail(k *kit.Kit) *cobra.Command {
	return simple(k, "quality-detail", "音质详情(eapi)", func(id int64) error {
		return kit.RenderExec(k, songendpoint.QualityDetail, &mmpb.QualityDetailRequest{SongId: id})
	})
}

func newLikeCount(k *kit.Kit) *cobra.Command {
	return simple(k, "like-count", "红心数(eapi)", func(id int64) error {
		return kit.RenderExec(k, songendpoint.LikeCount, &mmpb.LikeCountRequest{SongId: id})
	})
}

func newDynamicCover(k *kit.Kit) *cobra.Command {
	return simple(k, "dynamic-cover", "动态封面(eapi)", func(id int64) error {
		return kit.RenderExec(k, songendpoint.DynamicCover, &mmpb.DynamicCoverRequest{SongId: id})
	})
}

func newChorusTime(k *kit.Kit) *cobra.Command {
	return simple(k, "chorus-time", "副歌(eapi)", func(id int64) error {
		return kit.RenderExec(k, songendpoint.ChorusTime, &mmpb.ChorusTimeRequest{SongId: id})
	})
}

func newCreatorInfo(k *kit.Kit) *cobra.Command {
	return simple(k, "creator-info", "创作者(eapi)", func(id int64) error {
		return kit.RenderExec(k, songendpoint.CreatorInfo, &mmpb.CreatorInfoRequest{SongId: id})
	})
}

func newSimilarSongs(k *kit.Kit) *cobra.Command {
	return simple(k, "similar-songs", "相似歌曲", func(id int64) error {
		return kit.RenderExec(k, songendpoint.SimilarSongs, &mmpb.SimilarSongsRequest{SongId: id})
	})
}

func newLike(k *kit.Kit) *cobra.Command {
	var id int64
	var on bool
	c := &cobra.Command{
		Use:   "like",
		Short: "红心/取消红心(写操作,登录态)",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			if err := k.RequireLogin(); err != nil {
				return err
			}
			action := "取消红心"
			if on {
				action = "点红心"
			}
			if err := k.ConfirmFatal(fmt.Sprintf("对歌曲 %d %s", id, action)); err != nil {
				return err
			}
			return kit.RenderExec(k, songendpoint.Like, &mmpb.LikeRequest{SongId: id, Like: on})
		},
	}
	c.Flags().Int64Var(&id, "id", 0, "歌曲 ID")
	c.Flags().BoolVar(&on, "on", false, "红心(true)/取消(false)")
	_ = c.MarkFlagRequired("id")
	return c
}

func newTrash(k *kit.Kit) *cobra.Command {
	return simple(k, "trash", "丢进垃圾桶,降推荐权重(写操作,登录态)", func(id int64) error {
		if err := k.RequireLogin(); err != nil {
			return err
		}
		if err := k.ConfirmFatal(fmt.Sprintf("把歌曲 %d 丢进垃圾桶(降推荐权重)", id)); err != nil {
			return err
		}
		return kit.RenderExec(k, songendpoint.Trash, &mmpb.TrashRequest{SongId: id})
	})
}

func newDisallowRecommend(k *kit.Kit) *cobra.Command {
	return simple(k, "disallow-recommend", "标记不感兴趣,影响日推(写操作,登录态)", func(id int64) error {
		if err := k.RequireLogin(); err != nil {
			return err
		}
		if err := k.ConfirmFatal(fmt.Sprintf("标记歌曲 %d 不感兴趣(影响日推)", id)); err != nil {
			return err
		}
		return kit.RenderExec(k, songendpoint.DisallowRecommend, &mmpb.DisallowRecommendRequest{SongId: id})
	})
}

func newLikedList(k *kit.Kit) *cobra.Command {
	var uid int64
	c := &cobra.Command{
		Use:   "liked-list",
		Short: "红心歌曲列表(登录态)",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			if err := k.RequireLogin(); err != nil {
				return err
			}
			return kit.RenderExec(k, songendpoint.LikedList, &mmpb.LikedListRequest{UserId: uid})
		},
	}
	c.Flags().Int64Var(&uid, "uid", 0, "用户 ID")
	_ = c.MarkFlagRequired("uid")
	return c
}

func newIsLike(k *kit.Kit) *cobra.Command {
	return simple(k, "is-like", "是否已红心(登录态)", func(id int64) error {
		if err := k.RequireLogin(); err != nil {
			return err
		}
		return kit.RenderExec(k, songendpoint.IsLike, &mmpb.IsLikeRequest{SongId: id})
	})
}
