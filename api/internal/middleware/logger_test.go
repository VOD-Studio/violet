package middleware

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/stretchr/testify/require"
)

func TestLoggerStreamsBeforeHandlerCompletes(t *testing.T) {
	release := make(chan struct{})
	server := httptest.NewServer(Logger(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = io.WriteString(w, "data: first\n\n")
		w.(http.Flusher).Flush()
		<-release
		_, _ = io.WriteString(w, "data: last\n\n")
	})))
	defer server.Close()
	defer close(release)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, server.URL, nil)
	require.NoError(t, err)
	response, err := server.Client().Do(request)
	require.NoError(t, err)
	defer response.Body.Close()
	line, err := bufio.NewReader(response.Body).ReadString('\n')
	require.NoError(t, err)
	require.Equal(t, "data: first\n", line)
}

func TestLoggerKeepsCommittedStatusAndRequestCorrelationAfterPanic(t *testing.T) {
	var output bytes.Buffer
	previous := log.Logger
	log.Logger = zerolog.New(&output)
	t.Cleanup(func() { log.Logger = previous })
	handler := RequestID(Logger(Recoverer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Ctx(r.Context()).Info().Msg("business-probe")
		w.WriteHeader(http.StatusAccepted)
		panic("panic-probe")
	}))))
	request := httptest.NewRequest(http.MethodGet, "/probe", nil)
	request.Header.Set(RequestIDHeader, "correlation-probe")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	require.Equal(t, http.StatusAccepted, response.Code)
	require.Equal(t, "correlation-probe", response.Header().Get(RequestIDHeader))

	decoder := json.NewDecoder(&output)
	var sawRequest, sawBusiness, sawPanic bool
	for {
		var entry map[string]any
		err := decoder.Decode(&entry)
		if err != nil {
			require.ErrorIs(t, err, io.EOF)
			break
		}
		require.Equal(t, "correlation-probe", entry["request_id"])
		if status, ok := entry["status"]; ok {
			sawRequest = true
			require.Equal(t, float64(http.StatusAccepted), status)
			require.Equal(t, "info", entry["level"])
		}
		if entry["message"] == "business-probe" {
			sawBusiness = true
		}
		if entry["error"] == "panic-probe" {
			sawPanic = true
			require.Equal(t, "error", entry["level"])
		}
	}
	require.True(t, sawRequest, "missing request outcome")
	require.True(t, sawBusiness, "missing context-bound business log")
	require.True(t, sawPanic, "missing correlated panic")
}
