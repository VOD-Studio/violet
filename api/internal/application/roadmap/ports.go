package roadmap

type PermissionChecker interface {
	HasPermission(role string, isRoot bool, codes ...string) bool
}
