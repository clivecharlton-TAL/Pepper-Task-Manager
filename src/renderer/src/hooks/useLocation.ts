export function useLocation() {
  const hash = window.location.hash
  return {
    isQuickAdd: hash === '#quick-add'
  }
}
