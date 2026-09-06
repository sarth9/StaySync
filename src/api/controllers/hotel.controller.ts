import { Request, Response, NextFunction } from "express";
import { executeHotelAggregation } from "../../services/aggregation.service";
import { logger } from "../../utils/logger";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function parseCityQuery(req: Request): string {
  const city = req.query.city;
  if (typeof city !== "string" || city.trim() === "") {
    throw new HttpError(400, "city query parameter is required");
  }
  return city.trim();
}

export function parseNumberQuery(value: unknown, name: string): number | undefined {
  if (typeof value === "undefined") return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `${name} must be a non-negative number`);
  }
  const num = Number(value);
  if (Number.isNaN(num) || num < 0 || !Number.isFinite(num)) {
    throw new HttpError(400, `${name} must be a non-negative number`);
  }
  return num;
}

export async function getHotels(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const city = parseCityQuery(req);
    const minPrice = parseNumberQuery(req.query.minPrice, "minPrice");
    const maxPrice = parseNumberQuery(req.query.maxPrice, "maxPrice");

    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      throw new HttpError(400, "minPrice cannot be greater than maxPrice");
    }

    logger.info(`GET /api/hotels city=${city} minPrice=${minPrice ?? "none"} maxPrice=${maxPrice ?? "none"}`);

    const result = await executeHotelAggregation({ city, minPrice, maxPrice });
    logger.info(`GET /api/hotels returned ${result.hotels.length} hotels for ${city}`);
    res.json(result.hotels);
  } catch (error) {
    next(error);
  }
}