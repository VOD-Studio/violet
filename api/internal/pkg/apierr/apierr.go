package apierr

import (
	"encoding/json"
	"net/http"
)

type APIError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Detail  string `json:"detail,omitempty"`
}

func (e *APIError) Error() string {
	return e.Message
}

var (
	ErrNotFound  = &APIError{Code: http.StatusNotFound, Message: "not found"}
	ErrUnauth    = &APIError{Code: http.StatusUnauthorized, Message: "unauthorized"}
	ErrForbidden = &APIError{Code: http.StatusForbidden, Message: "forbidden"}
	ErrInternal  = &APIError{Code: http.StatusInternalServerError, Message: "internal server error"}
)

func ErrBadRequest(detail string) *APIError {
	return &APIError{Code: http.StatusBadRequest, Message: "bad request", Detail: detail}
}

func RespondError(w http.ResponseWriter, err *APIError) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(err.Code)
	json.NewEncoder(w).Encode(err)
}