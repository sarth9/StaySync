import { saveHotels, queryHotels } from "../src/services/redis.service";
import { AggregatedHotelResult, HotelResult } from "../src/types/hotel";

interface FakeRedis {
  status: string;
  del(key: string): Promise<number>;
  multi(): {
    zadd(key: string, score: number, member: string): void;
    exec(): Promise<unknown>;
  };
  zrangebyscore(key: string, min: number | string, max: number | string): Promise<string[]>;
  zrange(key: string, start: number, stop: number): Promise<string[]>;
}

interface AggregateHotelsZaddOp {
  key: string;
  score: number;
  member: string;
}

const offer: AggregatedHotelResult = {
  name: "Holtin",
  price: 5340,
  supplier: "Supplier B",
  commissionPct: 20,
  originalId: "b1",
  city: "delhi",
};

function makeFakeRedis(multiImpl?: () => { zadd(key: string, score: number, member: string): void; exec(): Promise<unknown> }): FakeRedis {
  return {
    status: "ready",
    del: jest.fn().mockResolvedValue(0),
    multi: multiImpl ? multiImpl : (jest.fn() as never),
    zrangebyscore: jest.fn().mockResolvedValue([] as string[]) as never,
    zrange: jest.fn().mockResolvedValue([] as string[]) as never,
  };
}

describe("Redis service (sorted set)", () => {
  it("deletes the key before saving to avoid stale entries", async () => {
    const ops: AggregateHotelsZaddOp[] = [];
    const fake = makeFakeRedis(() => ({
      zadd: (key: string, score: number, member: string) => ops.push({ key, score, member }),
      exec: jest.fn().mockResolvedValue(undefined),
    }));

    await saveHotels(fake as never, "delhi", [offer]);

    expect(fake.del).toHaveBeenCalledWith("hotels:delhi");
    expect(ops).toHaveLength(1);
    expect(ops[0].key).toBe("hotels:delhi");
    expect(ops[0].score).toBe(5340);
    expect(JSON.parse(ops[0].member)).toMatchObject({ name: "Holtin", price: 5340, supplier: "Supplier B" });
  });

  it("stores hotel price as the sorted set score with lowercased city key", async () => {
    const ops: AggregateHotelsZaddOp[] = [];
    const fake = makeFakeRedis(() => ({
      zadd: (key: string, score: number, member: string) => ops.push({ key, score, member }),
      exec: jest.fn().mockResolvedValue(undefined),
    }));

    await saveHotels(fake as never, "DELHI", [offer]);

    expect(ops[0].key).toBe("hotels:delhi");
  });

  it("queries all hotels with zrange when no price range is given", async () => {
    const members = [JSON.stringify({ name: "Holtin", price: 5340, supplier: "Supplier B", commissionPct: 20 })];
    const fake = makeFakeRedis();
    (fake.zrange as jest.Mock).mockResolvedValue(members);

    const hotels = await queryHotels(fake as never, "delhi");

    expect(fake.zrange).toHaveBeenCalledWith("hotels:delhi", 0, -1);
    expect(hotels).toHaveLength(1);
    expect(hotels[0]).toMatchObject({ name: "Holtin", price: 5340, supplier: "Supplier B", commissionPct: 20 });
  });

  it("uses zrangebyscore for price-range filtering inside Redis", async () => {
    const fake = makeFakeRedis();

    const hotels = await queryHotels(fake as never, "delhi", 5000, 6000);

    expect(fake.zrangebyscore).toHaveBeenCalledWith("hotels:delhi", 5000, 6000);
    expect(hotels).toEqual([]);
  });

  it("uses infinities for open-ended ranges", async () => {
    const fake = makeFakeRedis();

    await queryHotels(fake as never, "delhi", undefined, 6000);
    expect(fake.zrangebyscore).toHaveBeenCalledWith("hotels:delhi", "-inf", 6000);

    await queryHotels(fake as never, "delhi", 5000, undefined);
    expect(fake.zrangebyscore).toHaveBeenCalledWith("hotels:delhi", 5000, "+inf");
  });
});

// Ensure HotelResult is referenced for type completeness
const _typeCheck: HotelResult = { name: "", price: 0, supplier: "", commissionPct: 0 };