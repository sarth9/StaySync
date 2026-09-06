import { deduplicateAndSelectBestOffers } from "../src/services/hotel.service";
import { HotelOffer } from "../src/types/hotel";

describe("Deduplication and Best Offer Selection", () => {
  it("should select cheaper offer when hotel exists in both suppliers", () => {
    const supplierA: HotelOffer[] = [
      { hotelId: "a1", name: "Holtin", price: 6000, city: "delhi", commissionPct: 10 },
    ];
    const supplierB: HotelOffer[] = [
      { hotelId: "b1", name: "Holtin", price: 5340, city: "delhi", commissionPct: 20 },
    ];

    const result = deduplicateAndSelectBestOffers(supplierA, supplierB);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Holtin");
    expect(result[0].price).toBe(5340);
    expect(result[0].supplier).toBe("Supplier B");
  });

  it("should keep supplier A offer when supplier B has no offers", () => {
    const supplierA: HotelOffer[] = [
      { hotelId: "a1", name: "Grand Hyatt", price: 8500, city: "delhi", commissionPct: 12 },
    ];
    const supplierB: HotelOffer[] = [];

    const result = deduplicateAndSelectBestOffers(supplierA, supplierB);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Grand Hyatt");
    expect(result[0].supplier).toBe("Supplier A");
  });

  it("should keep supplier B offer when supplier A has no offers", () => {
    const supplierA: HotelOffer[] = [];
    const supplierB: HotelOffer[] = [
      { hotelId: "b1", name: "Marriott", price: 6800, city: "mumbai", commissionPct: 18 },
    ];

    const result = deduplicateAndSelectBestOffers(supplierA, supplierB);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Marriott");
    expect(result[0].supplier).toBe("Supplier B");
  });

  it("should select supplier A when prices are equal (deterministic tie-breaker)", () => {
    const supplierA: HotelOffer[] = [
      { hotelId: "a1", name: "Equal Price Hotel", price: 4000, city: "delhi", commissionPct: 10 },
    ];
    const supplierB: HotelOffer[] = [
      { hotelId: "b1", name: "Equal Price Hotel", price: 4000, city: "delhi", commissionPct: 15 },
    ];

    const result = deduplicateAndSelectBestOffers(supplierA, supplierB);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Equal Price Hotel");
    expect(result[0].price).toBe(4000);
    expect(result[0].supplier).toBe("Supplier A");
  });

  it("should return empty array when both suppliers return no offers", () => {
    const result = deduplicateAndSelectBestOffers([], []);
    expect(result).toHaveLength(0);
  });

  it("should keep the cheapest offer when a supplier returns duplicate names", () => {
    const supplierA: HotelOffer[] = [
      { hotelId: "a1", name: "Holtin", price: 6000, city: "delhi", commissionPct: 10 },
      { hotelId: "a2", name: "Holtin", price: 5600, city: "delhi", commissionPct: 12 },
    ];
    const result = deduplicateAndSelectBestOffers(supplierA, []);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Holtin");
    expect(result[0].price).toBe(5600);
    expect(result[0].originalId).toBe("a2");
  });

  it("should handle mixed overlapping and unique hotels", () => {
    const supplierA: HotelOffer[] = [
      { hotelId: "a1", name: "Holtin", price: 6000, city: "delhi", commissionPct: 10 },
      { hotelId: "a2", name: "Radison", price: 5900, city: "delhi", commissionPct: 13 },
      { hotelId: "a3", name: "Grand Hyatt", price: 8500, city: "delhi", commissionPct: 12 },
    ];
    const supplierB: HotelOffer[] = [
      { hotelId: "b1", name: "Holtin", price: 5340, city: "delhi", commissionPct: 20 },
      { hotelId: "b2", name: "Taj Palace", price: 7000, city: "delhi", commissionPct: 15 },
      { hotelId: "b3", name: "Radison", price: 6200, city: "delhi", commissionPct: 12 },
    ];

    const result = deduplicateAndSelectBestOffers(supplierA, supplierB);

    expect(result).toHaveLength(4);

    const holtin = result.find((h) => h.name === "Holtin");
    expect(holtin?.price).toBe(5340);
    expect(holtin?.supplier).toBe("Supplier B");

    const radison = result.find((h) => h.name === "Radison");
    expect(radison?.price).toBe(5900);
    expect(radison?.supplier).toBe("Supplier A");

    const grandHyatt = result.find((h) => h.name === "Grand Hyatt");
    expect(grandHyatt?.price).toBe(8500);
    expect(grandHyatt?.supplier).toBe("Supplier A");

    const tajPalace = result.find((h) => h.name === "Taj Palace");
    expect(tajPalace?.price).toBe(7000);
    expect(tajPalace?.supplier).toBe("Supplier B");
  });
});
