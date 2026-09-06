import { summarizeHealth } from "../src/services/health.service";
import { HealthServices } from "../src/types/health";

const allHealthy: HealthServices = {
  app: "healthy",
  supplierA: "healthy",
  supplierB: "healthy",
  redis: "healthy",
  temporal: "healthy",
};

describe("summarizeHealth", () => {
  it("returns ok when every component is healthy", () => {
    expect(summarizeHealth(allHealthy)).toEqual({ status: "ok", services: allHealthy });
  });

  it("returns degraded when at least one component is unhealthy", () => {
    const services: HealthServices = { ...allHealthy, redis: "unhealthy" };
    expect(summarizeHealth(services).status).toBe("degraded");
  });

  it("returns down when every component is unhealthy", () => {
    const services: HealthServices = {
      app: "unhealthy",
      supplierA: "unhealthy",
      supplierB: "unhealthy",
      redis: "unhealthy",
      temporal: "unhealthy",
    };
    expect(summarizeHealth(services).status).toBe("down");
  });
});