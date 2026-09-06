import { HotelOffer, AggregatedHotelResult, SupplierFetchResult } from "../types/hotel";

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

/**
 * Combines the two suppliers' fetch results into the deduplicated offer set.
 *
 * - If BOTH suppliers failed, aggregation cannot proceed and this throws
 *   (the workflow fails and the API surfaces HTTP 500).
 * - If exactly one supplier failed, its empty result is simply ignored and
 *   the healthy supplier's offers are used.
 * - If both suppliers succeeded (even with zero hotels), the results are
 *   deduplicated normally, which yields `[]` for a legitimate no-results case.
 */
export function combineSupplierResults(
  supplierA: SupplierFetchResult,
  supplierB: SupplierFetchResult,
  city: string
): AggregatedHotelResult[] {
  if (supplierA.failed && supplierB.failed) {
    throw new Error(`Both suppliers failed for city "${city}"; aggregation cannot proceed`);
  }
  return deduplicateAndSelectBestOffers(supplierA.hotels, supplierB.hotels);
}