// Package recommend 提供推荐相关命令。
package recommend

import (
	"github.com/spf13/cobra"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
	recommendendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/recommend"
)

// NewCommand 创建 recommend 命令组。
func NewCommand(k *kit.Kit) *cobra.Command {
	c := &cobra.Command{
		Use:   "recommend",
		Short: "推荐相关命令",
		Args:  cobra.NoArgs,
	}
	c.AddCommand(newPlaylists(k), newNewSongs(k), newDailyPlaylists(k), newDailySongs(k))
	annotateRecommendRpcs(c)
	return c
}

// annotateRecommendRpcs 给 recommend 组各子命令打 rpc 注解(PRD-0014 #B 命令树守护)。
// 命名偏移:daily-songs↔GetDailyRecommend、daily-playlists↔DailyRecommendPlaylists。
func annotateRecommendRpcs(c *cobra.Command) {
	rpcs := map[string][]string{
		"playlists":       {"RecommendService/RecommendPlaylists"},
		"new-songs":       {"RecommendService/RecommendNewSongs"},
		"daily-playlists": {"RecommendService/DailyRecommendPlaylists"},
		"daily-songs":     {"RecommendService/GetDailyRecommend"},
	}
	for _, sub := range c.Commands() {
		if v, ok := rpcs[sub.Name()]; ok {
			kit.AnnotateRpcs(sub, v...)
		}
	}
}

func newPlaylists(k *kit.Kit) *cobra.Command {
	var limit int
	c := &cobra.Command{
		Use:   "playlists",
		Short: "推荐歌单",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return kit.RenderExec(k, recommendendpoint.RecommendPlaylists, &mmpb.RecommendPlaylistsRequest{Limit: int32(limit)})
		},
	}
	c.Flags().IntVar(&limit, "limit", 10, "返回数量")
	return c
}

func newNewSongs(k *kit.Kit) *cobra.Command {
	var limit int
	c := &cobra.Command{
		Use:   "new-songs",
		Short: "推荐新歌",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return kit.RenderExec(k, recommendendpoint.RecommendNewSongs, &mmpb.RecommendNewSongsRequest{Limit: int32(limit)})
		},
	}
	c.Flags().IntVar(&limit, "limit", 10, "返回数量")
	return c
}

func newDailyPlaylists(k *kit.Kit) *cobra.Command {
	return &cobra.Command{
		Use:   "daily-playlists",
		Short: "每日推荐歌单(登录态)",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			if err := k.RequireLogin(); err != nil {
				return err
			}
			return kit.RenderExec(k, recommendendpoint.DailyRecommendPlaylists, &mmpb.DailyRecommendPlaylistsRequest{})
		},
	}
}

func newDailySongs(k *kit.Kit) *cobra.Command {
	return &cobra.Command{
		Use:   "daily-songs",
		Short: "每日推荐歌曲",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return kit.RenderExec(k, recommendendpoint.GetDailyRecommend, &mmpb.GetDailyRecommendRequest{})
		},
	}
}
