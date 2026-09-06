import { proxyActivities, ApplicationFailure } from "@temporalio/workflow";
import {
  HotelOffer,
  HotelWorkflowInput,
  HotelWorkflowResult,
  AggregatedHotelResult,
  SupplierFetchResult,
} from "../../types/hotel";
import { combineSupplierResults } from "../../services/hotel.service";

interface SupplierActivities {
  fetchSupplierA(city: string): Promise<HotelOffer[]>;
  fetchSupplierB(city: string): Promise<HotelOffer[]>;
  refreshAndQueryHotels(
    city: string,
    offers: AggregatedHotelResult[],
    minPrice?: number,
    maxPrice?: number
  ): Promise<HotelWorkflowResult["hotels"]>;
}

const activities = proxyActivities<SupplierActivities>({
  startToCloseTimeout: "10 seconds",
  retry: {
    maximumAttempts: 2,
    initialInterval: "1 second",
    backoffCoefficient: 2,
  },
});

async function fetchSupplier(
  promise: Promise<HotelOffer[]>,
  supplierName: string,
  city: string
): Promise<SupplierFetchResult> {
  try {
    const hotels = await promise;
    return { hotels, failed: false };
  } catch (error) {
    console.log(
      `[Workflow] Supplier ${supplierName} failed for city ${city}: ${(error as Error).message}. Will continue without it.`
    );
    return { hotels: [], failed: true };
  }
}

async function hotelAggregationWorkflow(input: HotelWorkflowInput): Promise<HotelWorkflowResult> {
  const city = input.city?.trim() ?? "";
  const { minPrice, maxPrice } = input;

  if (!city || city === "") {
    throw new Error("city is required");
  }

  console.log(`[Workflow] Started hotel aggregation for city: ${city}`);

  // Supplier A and Supplier B calls run in parallel.
  // Each failure is captured (hotels=[], failed=true) so one failing supplier does
  // not block offers from the other. `failed=true` is distinct from a successful
  // empty result (hotels=[], failed=false).
  const [supplierA, supplierB] = await Promise.all([
    fetchSupplier(activities.fetchSupplierA(city), "A", city),
    fetchSupplier(activities.fetchSupplierB(city), "B", city),
  ]);

  // Deduplicate by name (cheapest wins, Supplier A wins ties).
  // Throws only when BOTH suppliers failed -> the workflow fails -> API returns HTTP 500.
  // "Both suppliers succeeded with zero hotels" is a valid result and yields [].
  // The `ApplicationFailure` (nonRetryable) terminates the workflow execution so
  // `handle.result()` rejects promptly instead of retrying the workflow task on
  // the server.
  let allOffers: AggregatedHotelResult[];
  try {
    allOffers = combineSupplierResults(supplierA, supplierB, city);
  } catch (error) {
    throw ApplicationFailure.nonRetryable(
      error instanceof Error ? error.message : "Both suppliers failed; aggregation cannot proceed",
      "BothSuppliersFailed"
    );
  }
  console.log(`[Workflow] Deduplication produced ${allOffers.length} unique hotels for ${city}`);

  // Save deduplicated results to Redis and query them back under a per-city lock.
  // DEL + ZADD are applied in one atomic transaction; price filtering happens inside Redis.
  const filteredHotels = await activities.refreshAndQueryHotels(city, allOffers, minPrice, maxPrice);
  console.log(`[Workflow] Completed: ${filteredHotels.length} hotels returned for ${city}`);

  return { hotels: filteredHotels };
}

export { hotelAggregationWorkflow };