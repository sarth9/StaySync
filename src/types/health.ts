export type ComponentStatus = "healthy" | "unhealthy";

export interface HealthServices {
  app: ComponentStatus;
  supplierA: ComponentStatus;
  supplierB: ComponentStatus;
  redis: ComponentStatus;
  temporal: ComponentStatus;
}

export interface HealthStatus {
  status: "ok" | "degraded" | "down";
  services: HealthServices;
}