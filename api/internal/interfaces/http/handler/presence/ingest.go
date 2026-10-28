package presence

import (
	"bufio"
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/coder/websocket"
	"github.com/rs/zerolog/log"

	apppresence "blog-api/internal/application/presence"
	domainpresence "blog-api/internal/domain/presence"
)

const subprotocol = "nowbeam.v1"

// IngestHandler nowbeam.v1 上报端点：只做 WebSocket 适配，连接归属、序号与租约由 Registry 判定。
type IngestHandler struct {
	registry *apppresence.Registry
}

func NewIngestHandler(registry *apppresence.Registry) *IngestHandler {
	return &IngestHandler{registry: registry}
}

// Ingest 握手前完成凭证校验；成功后 welcome → 首份快照 → 原子接受 → ACK。
//
// GET /presence/ingest。Authorization: Bearer 设备凭证 + Sec-WebSocket-Protocol: nowbeam.v1。
func (h *IngestHandler) Ingest(w http.ResponseWriter, r *http.Request) {
	// 注册与鉴权是同一操作：即使撤销发生在 Upgrade 期间，候选连接也已被隔离
	session, err := h.registry.Register(r.Context(), bearerToken(r))
	switch {
	case errors.Is(err, apppresence.ErrUnauthorized):
		upgradeFail(w, http.StatusUnauthorized, "unauthorized")
		return
	case errors.Is(err, apppresence.ErrUnavailable):
		upgradeFail(w, http.StatusServiceUnavailable, "unavailable")
		return
	case err != nil:
		log.Error().Err(err).Msg("实时状态上报鉴权失败")
		upgradeFail(w, http.StatusInternalServerError, "internal_error")
		return
	}
	defer h.registry.Disconnect(session)

	// 原生上报协议，浏览器 Origin 一律拒绝；Origin 不能代替身份认证
	if len(r.Header.Values("Origin")) != 0 {
		upgradeFail(w, http.StatusForbidden, "origin_forbidden")
		return
	}
	if !containsToken(r.Header.Values("Sec-WebSocket-Protocol"), subprotocol, false) {
		upgradeFail(w, http.StatusBadRequest, "unsupported_protocol")
		return
	}
	if r.Header.Get("Sec-WebSocket-Version") != "13" {
		w.Header().Set("Sec-WebSocket-Version", "13")
		upgradeFail(w, http.StatusUpgradeRequired, "unsupported_websocket_version")
		return
	}
	if !r.ProtoAtLeast(1, 1) || !containsToken(r.Header.Values("Upgrade"), "websocket", true) ||
		!containsToken(r.Header.Values("Connection"), "upgrade", true) {
		upgradeFail(w, http.StatusBadRequest, "invalid_upgrade")
		return
	}
	keys := r.Header.Values("Sec-WebSocket-Key")
	if len(keys) != 1 {
		upgradeFail(w, http.StatusBadRequest, "invalid_upgrade")
		return
	}
	if key, err := base64.StdEncoding.DecodeString(strings.TrimSpace(keys[0])); err != nil || len(key) != 16 {
		upgradeFail(w, http.StatusBadRequest, "invalid_upgrade")
		return
	}
	// 上游库对子协议大小写宽松；只把已精确匹配的协议交给协商器
	r.Header.Set("Sec-WebSocket-Protocol", subprotocol)
	writer := &hijackWriter{ResponseWriter: w}
	conn, err := websocket.Accept(writer, r, &websocket.AcceptOptions{
		Subprotocols:    []string{subprotocol},
		CompressionMode: websocket.CompressionDisabled,
	})
	if err != nil {
		return
	}
	defer func() {
		// 必须先关闭真实传输；已有关闭握手时 CloseNow 只会等待，不会强制断开
		if writer.transport != nil {
			_ = writer.transport.Close()
		}
		_ = conn.CloseNow()
	}()
	// 多读一字节作溢出哨兵，应用层先清除状态再发固定原因的 1009
	conn.SetReadLimit(domainpresence.MaxMessageBytes + 1)
	h.serve(conn, writer.transport, session)
}

func (h *IngestHandler) serve(conn *websocket.Conn, transport net.Conn, session *apppresence.Session) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	select {
	case <-session.Done():
		terminate(ctx, conn, transport, session)
		return
	default:
	}
	if err := send(ctx, conn, newWelcome(session.ID, session.DeviceID, time.Now())); err != nil {
		return
	}
	if !h.registry.Activate(session) {
		terminate(ctx, conn, transport, session)
		return
	}
	closed := make(chan struct{})
	go func() {
		defer close(closed)
		select {
		case <-session.Done():
			terminate(ctx, conn, transport, session)
		case <-ctx.Done():
		}
		cancel()
	}()
	defer func() {
		h.registry.Disconnect(session)
		<-closed
	}()
	for {
		kind, reader, err := conn.Reader(ctx)
		if err != nil {
			return
		}
		if kind != websocket.MessageText {
			h.registry.Reject(session, 1003, "unsupported_data")
			<-closed
			return
		}
		data, err := io.ReadAll(io.LimitReader(reader, domainpresence.MaxMessageBytes+1))
		if err != nil {
			return
		}
		if len(data) > domainpresence.MaxMessageBytes {
			h.registry.Reject(session, 1009, "message_too_large")
			<-closed
			return
		}
		if !utf8.Valid(data) {
			h.registry.Reject(session, 1007, "invalid_utf8")
			<-closed
			return
		}
		snapshot, err := parseSnapshot(data)
		if err != nil {
			h.registry.Reject(session, 1008, apppresence.CodeInvalidMessage)
			<-closed
			return
		}
		ack, accepted := h.registry.Submit(session, snapshot)
		if !accepted {
			<-closed
			return
		}
		if err := send(ctx, conn, newAck(ack)); err != nil {
			return
		}
	}
}

// hijackWriter 记下被劫持的底层 socket，供关闭握手卡住时强制断开。
type hijackWriter struct {
	http.ResponseWriter
	transport net.Conn
}

func (w *hijackWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	conn, buffered, err := http.NewResponseController(w.ResponseWriter).Hijack()
	if err != nil {
		return nil, nil, err
	}
	w.transport = conn
	if secure, ok := conn.(*tls.Conn); ok {
		// TLS Close 会尝试 close_notify 并重设写期限；兜底必须直接关闭底层 socket
		w.transport = secure.NetConn()
	}
	return conn, buffered, nil
}

// terminate 先发协议 error（如适用）再按关闭码关闭；看门狗 1 秒后强制断开传输。
func terminate(ctx context.Context, conn *websocket.Conn, transport net.Conn, session *apppresence.Session) {
	forced := make(chan struct{})
	timer := time.AfterFunc(time.Second, func() {
		if transport != nil {
			_ = transport.Close()
		}
		close(forced)
	})
	defer func() {
		if !timer.Stop() {
			<-forced
		}
	}()
	end := session.Termination()
	switch end.Code {
	case apppresence.CodeInvalidMessage, apppresence.CodeOutOfOrder, apppresence.CodeSequenceConflict,
		apppresence.CodeCredentialRevoked, apppresence.CodeSessionReplaced, apppresence.CodeInternalError:
		_ = send(ctx, conn, wireError{ProtocolVersion: 1, Type: "error", ConnectionID: session.ID, Sequence: end.Sequence, Code: end.Code})
	}
	_ = conn.Close(websocket.StatusCode(end.CloseCode), end.Code)
}

func send(ctx context.Context, conn *websocket.Conn, value any) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	writeCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	return conn.Write(writeCtx, websocket.MessageText, data)
}

// upgradeFail 握手前失败只回稳定错误码，不回显凭证或内部异常。
func upgradeFail(w http.ResponseWriter, status int, code string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(`{"code":"` + code + `"}`))
}

// bearerToken 只接受唯一的 Authorization: Bearer 头；凭证不从 URL、Cookie 或子协议读取。
func bearerToken(r *http.Request) string {
	values := r.Header.Values("Authorization")
	if len(values) != 1 {
		return ""
	}
	scheme, token, ok := strings.Cut(values[0], " ")
	if !ok || !strings.EqualFold(scheme, "Bearer") {
		return ""
	}
	return strings.TrimSpace(token)
}

func containsToken(values []string, expected string, fold bool) bool {
	for _, value := range values {
		for _, token := range strings.Split(value, ",") {
			token = strings.TrimSpace(token)
			if token == expected || (fold && strings.EqualFold(token, expected)) {
				return true
			}
		}
	}
	return false
}
