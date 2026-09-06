import { HotelOffer, AggregatedHotelResult } from "../types/hotel";

function indexCheapestByName(offers: HotelOffer[]): Map<string, HotelOffer> {
  const byName: Map<string, HotelOffer> = new Map();
  for (const offer of offers) {
    const key = offer.name.toLowerCase();
    const current = byName.get(key);
    if (!current || offer.price < current.price) {
      byName.set(key, offer);
    }
  }
  return byName;
}

export function deduplicateAndSelectBestOffers(
  supplierAOffers: HotelOffer[],
  supplierBOffers: HotelOffer[]
): AggregatedHotelResult[] {
  const offersBySupplierA = indexCheapestByName(supplierAOffers);
  const offersBySupplierB = indexCheapestByName(supplierBOffers);

  const allHotelNames = new Set([...offersBySupplierA.keys(), ...offersBySupplierB.keys()]);
  const results: AggregatedHotelResult[] = [];

  for (const name of allHotelNames) {
    const offerA = offersBySupplierA.get(name);
    const offerB = offersBySupplierB.get(name);

    if (offerA && offerB) {
      // Both suppliers have this hotel - pick cheaper; deterministic tie goes to Supplier A
      if (offerB.price < offerA.price) {
        results.push({
          name: offerB.name,
          price: offerB.price,
          supplier: "Supplier B",
          commissionPct: offerB.commissionPct,
          originalId: offerB.hotelId,
          city: offerB.city,
        });
      } else {
        results.push({
          name: offerA.name,
          price: offerA.price,
          supplier: "Supplier A",
          commissionPct: offerA.commissionPct,
          originalId: offerA.hotelId,
          city: offerA.city,
        });
      }
    } else if (offerA) {
      results.push({
        name: offerA.name,
        price: offerA.price,
        supplier: "Supplier A",
        commissionPct: offerA.commissionPct,
        originalId: offerA.hotelId,
        city: offerA.city,
      });
    } else if (offerB) {
      results.push({
        name: offerB.name,
        price: offerB.price,
        supplier: "Supplier B",
        commissionPct: offerB.commissionPct,
        originalId: offerB.hotelId,
        city: offerB.city,
      });
    }
  }

  return results;
}