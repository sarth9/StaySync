import { proxyActivities } from "@temporalio/workflow";
import { HotelOffer, HotelWorkflowInput, HotelWorkflowResult, AggregatedHotelResult } from "../../types/hotel";
import { deduplicateAndSelectBestOffers } from "../../services/hotel.service";

interface SupplierActivities {
  fetchSupplierA(city: string): Promise<HotelOffer[]>;
  fetchSupplierB(city: string): Promise<HotelOffer[]>;
  saveHotelsToRedis(city: string, offers: AggregatedHotelResult[]): Promise<void>;
  queryHotelsFromRedis(city: string, minPrice?: number, maxPrice?: number): Promise<HotelWorkflowResult["hotels"]>;
}

const activities = proxyActivities<SupplierActivities>({
  startToCloseTimeout: "10 seconds",
  retry: {
    maximumAttempts: 2,
    initialInterval: "1 second",
    backoffCoefficient: 2,
  },
});

async function fetchWithFallback(
  promise: Promise<HotelOffer[]>,
  supplierName: string,
  city: string
): Promise<HotelOffer[]> {
  try {
    return await promise;
  } catch (error) {
    console.log(`[Workflow] Supplier ${supplierName} failed for city ${city}: ${(error as Error).message}. Continue with empty offers.`);
    return [];
  }
}

async function hotelAggregationWorkflow(input: HotelWorkflowInput): Promise<HotelWorkflowResult> {
  const city = input.city;
  const { minPrice, maxPrice } = input;

  if (!city || city.trim() === "") {
    throw new Error("city is required");
  }

  console.log(`[Workflow] Started hotel aggregation for city: ${city}`);

  // Supplier A and Supplier B calls run in parallel.
  // Each is guarded so one failing supplier does not block offers from the other.
  const [supplierAOffers, supplierBOffers] = await Promise.all([
    fetchWithFallback(activities.fetchSupplierA(city), "A", city),
    fetchWithFallback(activities.fetchSupplierB(city), "B", city),
  ]);

  // Deduplicate by name (cheapest wins, Supplier A wins ties)
  const allOffers = deduplicateAndSelectBestOffers(supplierAOffers, supplierBOffers);
  console.log(`[Workflow] Deduplication produced ${allOffers.length} unique hotels for ${city}`);

  // Save deduplicated results to Redis (overwrites stale data)
  await activities.saveHotelsToRedis(city, allOffers);

  // Query from Redis with optional price filtering (filtering happens inside Redis)
  const filteredHotels = await activities.queryHotelsFromRedis(city, minPrice, maxPrice);
  console.log(`[Workflow] Completed: ${filteredHotels.length} hotels returned for ${city}`);

  return { hotels: filteredHotels };
}

export { hotelAggregationWorkflow };