import { tripUsApi } from "@/shared/api/trip-us-api";

type EventProperty = boolean | number | string | null;

export function trackEvent(name: string, properties: Record<string, EventProperty> = {}): void {
  void tripUsApi.POST("/v1/telemetry/events", {
    body: { events: [{ name, occurredAt: new Date().toISOString(), properties }] },
  }).catch(() => {
    // Telemetry is best-effort and must never block a user action.
  });
}

export function captureError(error: unknown, context: string): void {
  const normalized = error instanceof Error ? error : new Error(String(error));
  trackEvent("mobile.error", {
    context,
    errorName: normalized.name.slice(0, 80),
    message: normalized.message.slice(0, 300),
  });
}
