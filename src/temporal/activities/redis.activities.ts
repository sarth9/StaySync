import { AggregatedHotelResult, HotelResult } from "../../types/hotel";
import { logger } from "../../utils/logger";
import { createRedisClient, saveAndQueryHotels } from "../../services/redis.service";

export async function refreshAndQueryHotels(
  city: string,
  offers: AggregatedHotelResult[],
  minPrice?: number,
  maxPrice?: number
): Promise<HotelResult[]> {
  const redis = createRedisClient();
  try {
    const range = minPrice !== undefined || maxPrice !== undefined ? ` [${minPrice ?? "-inf"}, ${maxPrice ?? "+inf"}]` : " (all)";
    logger.info(`[Activity] Refreshing Redis set for city ${city} with ${offers.length} hotels${range}`);
    const hotels = await saveAndQueryHotels(redis, city, offers, minPrice, maxPrice);
    logger.info(`[Activity] Redis query returned ${hotels.length} hotels`);
    return hotels;
  } finally {
    redis.disconnect();
  }
}