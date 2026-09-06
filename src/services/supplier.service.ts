import { HotelOffer } from "../types/hotel";
import { supplierAData } from "../suppliers/supplierA";
import { supplierBData } from "../suppliers/supplierB";
import { logger } from "../utils/logger";

export function getSupplierAOffers(city: string): HotelOffer[] {
  logger.info(`Fetching Supplier A offers for city: ${city}`);
  const offers = supplierAData.filter((h) => h.city.toLowerCase() === city.toLowerCase());
  logger.info(`Supplier A returned ${offers.length} offers for ${city}`);
  return offers;
}

export function getSupplierBOffers(city: string): HotelOffer[] {
  logger.info(`Fetching Supplier B offers for city: ${city}`);
  const offers = supplierBData.filter((h) => h.city.toLowerCase() === city.toLowerCase());
  logger.info(`Supplier B returned ${offers.length} offers for ${city}`);
  return offers;
}
