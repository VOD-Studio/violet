package job_test

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appmusic "blog-api/internal/application/music"
	"blog-api/internal/domain/music"
	"blog-api/internal/infrastructure/crypto"
	"blog-api/internal/job"
)

type renewalRepository struct {
	music.Repository
	mu         sync.Mutex
	credential music.Credential
}

func (r *renewalRepository) Credential(context.Context) (music.Credential, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.credential, nil
}

func (r *renewalRepository) ReplaceCredential(_ context.Context, generation int64, c music.Credential) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.credential.Generation != generation {
		return false, nil
	}
	c.Generation = generation + 1
	r.credential = c
	return true, nil
}

type renewalProvider struct {
	appmusic.Provider
	configured    bool
	cookie        string
	calls         []string
	statusCalls   int
	beforeRefresh func(context.Context) error
}

func (p *renewalProvider) Configured() bool { return p.configured }

func (p *renewalProvider) Refresh(ctx context.Context, cookie string) (string, error) {
	p.calls = append(p.calls, cookie)
	if p.beforeRefresh != nil {
		if err := p.beforeRefresh(ctx); err != nil {
			return "", err
		}
	}
	if cookie != p.cookie {
		return "", &appmusic.ProviderError{Reason: "LOGIN_REQUIRED", Message: "请重新扫码"}
	}
	p.cookie = fmt.Sprintf("MUSIC_U=renewed-%d; csrf=new", len(p.calls))
	return p.cookie, nil
}

func (p *renewalProvider) Account(_ context.Context, cookie string) (*appmusic.Session, error) {
	p.statusCalls++
	if cookie != p.cookie {
		return nil, &appmusic.ProviderError{Reason: "LOGIN_REQUIRED", Message: "请重新扫码"}
	}
	return &appmusic.Session{Profile: music.Profile{ID: "42", Nickname: "Owner"}}, nil
}

func newRenewalService(t *testing.T) (*appmusic.Service, *renewalRepository, *renewalProvider) {
	t.Helper()
	box, err := crypto.NewTokenBoxFromSecret("renewal-test-credential-key-32-characters")
	require.NoError(t, err)
	p := &renewalProvider{configured: true, cookie: "MUSIC_U=old; obsolete=remove"}
	sealed, err := box.Seal(p.cookie)
	require.NoError(t, err)
	r := &renewalRepository{credential: music.Credential{Generation: 1, SealedCookie: sealed, Profile: music.Profile{ID: "42", Nickname: "Owner"}}}
	return appmusic.NewService(r, p, box), r, p
}

func TestMusicRenewalJobRenewsEveryDayUsingLatestCookie(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		service, _, provider := newRenewalService(t)
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		go job.NewMusicRenewalJob(service).Start(ctx)
		synctest.Wait()

		time.Sleep(24*time.Hour - time.Second)
		synctest.Wait()
		assert.Empty(t, provider.calls, "首次到期前不请求上游续期")

		time.Sleep(time.Second)
		synctest.Wait()
		assert.Equal(t, []string{"MUSIC_U=old; obsolete=remove"}, provider.calls)
		account, err := service.Account(ctx)
		require.NoError(t, err)
		assert.Equal(t, "connected", account.State, "新 Cookie 必须可供后续账号查询使用")

		time.Sleep(24 * time.Hour)
		synctest.Wait()
		assert.Equal(t, []string{"MUSIC_U=old; obsolete=remove", "MUSIC_U=renewed-1; csrf=new"}, provider.calls, "次日必须使用完整新 Cookie，不能合并旧字段")
	})
}

func TestMusicRenewalJobSkipsUnavailableAccounts(t *testing.T) {
	for _, condition := range []string{"unconfigured", "no-key", "disconnected"} {
		t.Run(condition, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				service, repo, provider := newRenewalService(t)
				switch condition {
				case "unconfigured":
					provider.configured = false
				case "no-key":
					service = appmusic.NewService(repo, provider, nil)
				case "disconnected":
					repo.credential.SealedCookie = ""
				}
				ctx, cancel := context.WithCancel(context.Background())
				defer cancel()
				go job.NewMusicRenewalJob(service).Start(ctx)
				synctest.Wait()
				time.Sleep(48 * time.Hour)
				synctest.Wait()

				assert.Empty(t, provider.calls)
				assert.Zero(t, provider.statusCalls, "跳过账号不能先探测上游状态")
			})
		})
	}
}

func TestMusicRenewalJobContinuesNextDayAfterFailure(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		service, _, provider := newRenewalService(t)
		provider.beforeRefresh = func(context.Context) error {
			return &appmusic.ProviderError{Reason: "UPSTREAM_ERROR", Message: "音乐服务暂时不可用"}
		}
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		go job.NewMusicRenewalJob(service).Start(ctx)
		synctest.Wait()
		time.Sleep(24 * time.Hour)
		synctest.Wait()

		account, err := service.Account(ctx)
		require.NoError(t, err)
		assert.Equal(t, "connected", account.State, "临时故障不能清除已保存的连接")
		provider.beforeRefresh = nil
		time.Sleep(24*time.Hour - time.Second)
		synctest.Wait()
		assert.Equal(t, []string{"MUSIC_U=old; obsolete=remove"}, provider.calls, "故障后不得高频重试")

		time.Sleep(time.Second)
		synctest.Wait()
		assert.Equal(t, []string{"MUSIC_U=old; obsolete=remove", "MUSIC_U=old; obsolete=remove"}, provider.calls)
		account, err = service.Account(ctx)
		require.NoError(t, err)
		assert.Equal(t, "connected", account.State, "次日恢复后须能使用续期凭据")
	})
}

func TestMusicRenewalJobCancellationStopsPendingAndInflightWork(t *testing.T) {
	for _, inflight := range []bool{false, true} {
		t.Run(fmt.Sprintf("inflight=%t", inflight), func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				service, _, provider := newRenewalService(t)
				provider.beforeRefresh = func(ctx context.Context) error {
					<-ctx.Done()
					return ctx.Err()
				}
				ctx, cancel := context.WithCancel(context.Background())
				defer cancel()
				done := make(chan struct{})
				go func() {
					defer close(done)
					job.NewMusicRenewalJob(service).Start(ctx)
				}()
				synctest.Wait()
				if inflight {
					time.Sleep(24 * time.Hour)
					synctest.Wait()
					require.Equal(t, []string{"MUSIC_U=old; obsolete=remove"}, provider.calls)
				}
				cancel()
				synctest.Wait()
				select {
				case <-done:
				default:
					t.Fatal("取消后调度器未退出")
				}

				time.Sleep(48 * time.Hour)
				synctest.Wait()
				if inflight {
					assert.Equal(t, []string{"MUSIC_U=old; obsolete=remove"}, provider.calls, "关闭后不能再次续期")
				} else {
					assert.Empty(t, provider.calls, "首次执行前关闭不能触发续期")
				}
				assert.Zero(t, provider.statusCalls, "在途续期取消后不能继续状态查询")
			})
		})
	}
}

func TestMusicRenewalJobPausesExpiredAccountUntilManualRecovery(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		service, _, provider := newRenewalService(t)
		provider.cookie = "revoked"
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		go job.NewMusicRenewalJob(service).Start(ctx)
		synctest.Wait()
		time.Sleep(24 * time.Hour)
		synctest.Wait()

		account, err := service.Account(ctx)
		require.NoError(t, err)
		assert.Equal(t, "expired", account.State)
		playback, err := service.Playback(ctx)
		require.NoError(t, err)
		assert.Equal(t, "anonymous", playback.Mode)
		time.Sleep(48 * time.Hour)
		synctest.Wait()
		assert.Equal(t, []string{"MUSIC_U=old; obsolete=remove"}, provider.calls, "已确认失效的账号不应每日继续请求上游")

		provider.cookie = "MUSIC_U=old; obsolete=remove"
		account, err = service.Refresh(ctx)
		require.NoError(t, err)
		assert.Equal(t, "connected", account.State)
		playback, err = service.Playback(ctx)
		require.NoError(t, err)
		assert.Equal(t, "account", playback.Mode)
		time.Sleep(24 * time.Hour)
		synctest.Wait()
		assert.Equal(t, []string{"MUSIC_U=old; obsolete=remove", "MUSIC_U=old; obsolete=remove", "MUSIC_U=renewed-2; csrf=new"}, provider.calls, "恢复后每日任务应继续使用新凭据")
	})
}
