import Redis, { RedisOptions } from "ioredis";
import { AggregatedHotelResult, HotelResult } from "../types/hotel";
import { env } from "../config/env";

export function createRedisClient(overrides: Partial<RedisOptions> = {}): Redis {
  return new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    ...overrides,
  });
}

export async function ensureReady(redis: Redis): Promise<void> {
  if (redis.status === "ready") return;
  if (redis.status === "connecting" || redis.status === "connect" || redis.status === "reconnecting") {
    await new Promise<void>((resolve, reject) => {
      const onError = (err: Error) => {
        redis.removeListener("ready", onReady);
        reject(err);
      };
      const onReady = () => {
        redis.removeListener("error", onError);
        resolve();
      };
      redis.once("ready", onReady);
      redis.once("error", onError);
    });
  } else {
    await redis.connect();
  }
}

export function hotelKey(city: string): string {
  return `hotels:${city.toLowerCase()}`;
}

export async function saveHotels(redis: Redis, city: string, offers: AggregatedHotelResult[]): Promise<void> {
  await ensureReady(redis);
  const key = hotelKey(city);
  await redis.del(key);
  if (offers.length > 0) {
    const pipeline = redis.multi();
    for (const offer of offers) {
      const member = JSON.stringify({
        name: offer.name,
        price: offer.price,
        supplier: offer.supplier,
        commissionPct: offer.commissionPct,
        originalId: offer.originalId,
        city: offer.city,
      });
      pipeline.zadd(key, offer.price, member);
    }
    await pipeline.exec();
  }
}

export async function queryHotels(
  redis: Redis,
  city: string,
  minPrice?: number,
  maxPrice?: number
): Promise<HotelResult[]> {
  await ensureReady(redis);
  const key = hotelKey(city);
  let members: string[];
  if (minPrice !== undefined || maxPrice !== undefined) {
    const min = minPrice === undefined ? "-inf" : minPrice;
    const max = maxPrice === undefined ? "+inf" : maxPrice;
    members = await redis.zrangebyscore(key, min, max);
  } else {
    members = await redis.zrange(key, 0, -1);
  }
  return members.map((m) => {
    const parsed = JSON.parse(m) as HotelResult;
    return { name: parsed.name, price: parsed.price, supplier: parsed.supplier, commissionPct: parsed.commissionPct };
  });
}
