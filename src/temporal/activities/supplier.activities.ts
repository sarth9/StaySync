import axios from "axios";
import { HotelOffer } from "../../types/hotel";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";

export async function fetchSupplierA(city: string): Promise<HotelOffer[]> {
  logger.info(`[Activity] Fetching Supplier A offers for city: ${city}`);
  try {
    const response = await axios.get<HotelOffer[]>(`${env.SUPPLIER_A_URL}/supplierA/hotels?city=${encodeURIComponent(city)}`, {
      timeout: 5000,
    });
    logger.info(`[Activity] Supplier A returned ${response.data.length} offers for ${city}`);
    return response.data;
  } catch (error) {
    logger.error(`[Activity] Supplier A call failed for ${city}: ${(error as Error).message}`);
    throw error;
  }
}

export async function fetchSupplierB(city: string): Promise<HotelOffer[]> {
  logger.info(`[Activity] Fetching Supplier B offers for city: ${city}`);
  try {
    const response = await axios.get<HotelOffer[]>(`${env.SUPPLIER_B_URL}/supplierB/hotels?city=${encodeURIComponent(city)}`, {
      timeout: 5000,
    });
    logger.info(`[Activity] Supplier B returned ${response.data.length} offers for ${city}`);
    return response.data;
  } catch (error) {
    logger.error(`[Activity] Supplier B call failed for ${city}: ${(error as Error).message}`);
    throw error;
  }
}
