// Prompt for browser notification permission the first time the user opts into
// a reminder. Call it from a click/change handler so the browser allows the
// prompt; it's a no-op on the server, when unsupported, or once decided.
export function ensureNotificationPermission() {
  if (
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "default"
  ) {
    void Notification.requestPermission();
  }
}
