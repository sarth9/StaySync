import { AggregatedHotelResult, HotelResult } from "../../types/hotel";
import { logger } from "../../utils/logger";
import { createRedisClient, saveHotels, queryHotels } from "../../services/redis.service";

export async function saveHotelsToRedis(city: string, offers: AggregatedHotelResult[]): Promise<void> {
  const redis = createRedisClient();
  try {
    logger.info(`[Activity] Saving ${offers.length} hotels to Redis for city ${city}`);
    await saveHotels(redis, city, offers);
    logger.info(`[Activity] Redis write completed for city ${city}`);
  } finally {
    redis.disconnect();
  }
}

export async function queryHotelsFromRedis(
  city: string,
  minPrice?: number,
  maxPrice?: number
): Promise<HotelResult[]> {
  const redis = createRedisClient();
  try {
    const priceRange = minPrice !== undefined || maxPrice !== undefined ? ` [${minPrice ?? "-inf"}, ${maxPrice ?? "+inf"}]` : " (all)";
    logger.info(`[Activity] Redis query for city ${city}${priceRange}`);
    const hotels = await queryHotels(redis, city, minPrice, maxPrice);
    logger.info(`[Activity] Redis query returned ${hotels.length} hotels`);
    return hotels;
  } finally {
    redis.disconnect();
  }
}
