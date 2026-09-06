import request from "supertest";
import app from "../src/api/app";
import { executeHotelAggregation } from "../src/services/aggregation.service";
import { getHealthStatus } from "../src/services/health.service";

jest.mock("../src/services/aggregation.service");
jest.mock("../src/services/health.service", () => ({
  getHealthStatus: jest.fn(),
}));

const mockExecute = executeHotelAggregation as jest.MockedFunction<typeof executeHotelAggregation>;
const mockGetHealthStatus = getHealthStatus as jest.MockedFunction<typeof getHealthStatus>;

describe("GET /api/hotels", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when city is missing", async () => {
    const res = await request(app).get("/api/hotels");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "city query parameter is required" });
  });

  it("returns 400 when city is empty", async () => {
    const res = await request(app).get("/api/hotels?city=");
    expect(res.status).toBe(400);
  });

  it("returns 400 when minPrice is not a number", async () => {
    const res = await request(app).get("/api/hotels?city=delhi&minPrice=abc");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining("minPrice") });
  });

  it("returns 400 when minPrice is negative", async () => {
    const res = await request(app).get("/api/hotels?city=delhi&minPrice=-5");
    expect(res.status).toBe(400);
  });

  it("returns 400 when maxPrice is not a number", async () => {
    const res = await request(app).get("/api/hotels?city=delhi&maxPrice=xyz");
    expect(res.status).toBe(400);
  });

  it("returns 400 when minPrice is greater than maxPrice", async () => {
    const res = await request(app).get("/api/hotels?city=delhi&minPrice=7000&maxPrice=5000");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "minPrice cannot be greater than maxPrice" });
  });

  it("returns hotels for a valid request", async () => {
    mockExecute.mockResolvedValue({
      hotels: [{ name: "Holtin", price: 5340, supplier: "Supplier B", commissionPct: 20 }],
    });

    const res = await request(app).get("/api/hotels?city=delhi");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ name: "Holtin", price: 5340, supplier: "Supplier B", commissionPct: 20 }]);
    expect(mockExecute).toHaveBeenCalledWith({ city: "delhi", minPrice: undefined, maxPrice: undefined });
  });

  it("passes price range to aggregation when provided", async () => {
    mockExecute.mockResolvedValue({ hotels: [] });

    await request(app).get("/api/hotels?city=delhi&minPrice=5000&maxPrice=6000");

    expect(mockExecute).toHaveBeenCalledWith({ city: "delhi", minPrice: 5000, maxPrice: 6000 });
  });

  it("returns an empty array for a city with no offers", async () => {
    mockExecute.mockResolvedValue({ hotels: [] });

    const res = await request(app).get("/api/hotels?city=chennai");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns 500 with a generic message when aggregation fails", async () => {
    mockExecute.mockRejectedValue(new Error("temporal down"));

    const res = await request(app).get("/api/hotels?city=delhi");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });

  it("does not leak stack traces", async () => {
    mockExecute.mockRejectedValue(new Error("secret internal detail"));

    const res = await request(app).get("/api/hotels?city=delhi");
    expect(res.text).not.toContain("secret internal detail");
  });
});

describe("Supplier endpoints", () => {
  it("returns 400 for supplier without city", async () => {
    const res = await request(app).get("/supplierA/hotels");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "city query parameter is required" });
  });

  it("returns supplier A offers for delhi", async () => {
    const res = await request(app).get("/supplierA/hotels?city=delhi");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((h: { city: string }) => h.city === "delhi")).toBe(true);
  });

  it("returns supplier B offers for delhi", async () => {
    const res = await request(app).get("/supplierB/hotels?city=delhi");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("simulates Supplier A failure with 503 when enabled", async () => {
    const env = require("../src/config/env").env;
    env.SIMULATE_SUPPLIER_A_FAILURE = true;
    try {
      const res = await request(app).get("/supplierA/hotels?city=delhi");
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ error: "Supplier A is temporarily unavailable" });
    } finally {
      env.SIMULATE_SUPPLIER_A_FAILURE = false;
    }
  });

  it("simulates Supplier B failure with 503 when enabled", async () => {
    const env = require("../src/config/env").env;
    env.SIMULATE_SUPPLIER_B_FAILURE = true;
    try {
      const res = await request(app).get("/supplierB/hotels?city=delhi");
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ error: "Supplier B is temporarily unavailable" });
    } finally {
      env.SIMULATE_SUPPLIER_B_FAILURE = false;
    }
  });
});

describe("GET /health", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 200 with ok status when all services are healthy", async () => {
    mockGetHealthStatus.mockResolvedValue({
      status: "ok",
      services: {
        app: "healthy",
        supplierA: "healthy",
        supplierB: "healthy",
        redis: "healthy",
        temporal: "healthy",
      },
    });

    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: "ok",
      services: {
        app: "healthy",
        supplierA: "healthy",
        supplierB: "healthy",
        redis: "healthy",
        temporal: "healthy",
      },
    });
  });

  it("returns 503 when a dependency is degraded", async () => {
    mockGetHealthStatus.mockResolvedValue({
      status: "degraded",
      services: {
        app: "healthy",
        supplierA: "healthy",
        supplierB: "healthy",
        redis: "unhealthy",
        temporal: "healthy",
      },
    });

    const res = await request(app).get("/health");
    expect(res.status).toBe(503);
    expect(res.body.status).toBe("degraded");
  });
});

describe("404 handling", () => {
  it("returns 404 for unknown routes", async () => {
    const res = await request(app).get("/unknown");
    expect(res.status).toBe(404);
  });
});