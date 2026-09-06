import Redis, { RedisOptions } from "ioredis";
import { randomUUID } from "crypto";
import { AggregatedHotelResult, HotelResult } from "../types/hotel";
import { env } from "../config/env";

const CITY_LOCK_PREFIX = "lock:hotels:";
const CITY_LOCK_TTL_MS = 5000;
const CITY_LOCK_POLL_MS = 25;
const CITY_LOCK_MAX_WAIT_MS = 2000;
const RELEASE_LOCK_SCRIPT =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  // DEL and ZADD run in a single MULTI/EXEC transaction, so a concurrent reader
  // can never observe a half-written (empty/partial) sorted set.
  const pipeline = redis.multi();
  pipeline.del(key);
  if (offers.length > 0) {
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
  }
  await pipeline.exec();
}

/**
 * Runs `fn` while holding a city-scoped Redis lock.
 *
 * The lock is a single key (`lock:hotels:{city}`) acquired atomically with
 * `SET key token PX <ttl> NX`. The token is unique per operation so that only
 * the operation that acquired the lock can release it (verified via a Lua
 * script). The TTL guarantees a crashed process cannot hold the lock forever.
 * Contention is handled with a short bounded poll loop.
 *
 * `options` is a test seam so tests can exercise the wait/timeout paths without
 * real wall-clock delays; production callers use the defaults.
 */
export async function withCityLock<T>(
  redis: Redis,
  city: string,
  fn: () => Promise<T>,
  options: { pollMs?: number; maxWaitMs?: number } = {}
): Promise<T> {
  await ensureReady(redis);
  const pollMs = options.pollMs ?? CITY_LOCK_POLL_MS;
  const maxWaitMs = options.maxWaitMs ?? CITY_LOCK_MAX_WAIT_MS;
  const lockKey = `${CITY_LOCK_PREFIX}${city.toLowerCase()}`;
  const token = randomUUID();
  const deadline = Date.now() + maxWaitMs;

  for (;;) {
    const acquired = await redis.set(lockKey, token, "PX", CITY_LOCK_TTL_MS, "NX");
    if (acquired === "OK") {
      try {
        return await fn();
      } finally {
        await redis.eval(RELEASE_LOCK_SCRIPT, 1, lockKey, token);
      }
    }
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for aggregation lock on city "${city.toLowerCase()}"`);
    }
    await sleep(pollMs);
  }
}

/**
 * Replaces the sorted set for `city` with `offers` and immediately queries it,
 * holding the per-city lock across both steps. This guarantees concurrent
 * same-city aggregations are fully serialized: the query always reads the
 * complete set written by this aggregation and never one that another
 * aggregation is halfway through writing.
 */
export async function saveAndQueryHotels(
  redis: Redis,
  city: string,
  offers: AggregatedHotelResult[],
  minPrice?: number,
  maxPrice?: number
): Promise<HotelResult[]> {
  return withCityLock(redis, city, async () => {
    await saveHotels(redis, city, offers);
    return await queryHotels(redis, city, minPrice, maxPrice);
  });
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