import { Router } from "express";
import { HotelOffer } from "../../types/hotel";

export interface SupplierRouterOptions {
  name: "A" | "B";
  getOffers: (city: string) => HotelOffer[];
  simulateFailure: () => boolean;
}

export function createSupplierRouter({ name, getOffers, simulateFailure }: SupplierRouterOptions): Router {
  const router = Router();

  router.get("/hotels", (req, res) => {
    const city = typeof req.query.city === "string" ? req.query.city.trim() : "";
    if (!city) {
      res.status(400).json({ error: "city query parameter is required" });
      return;
    }
    if (simulateFailure()) {
      res.status(503).json({ error: `Supplier ${name} is temporarily unavailable` });
      return;
    }
    res.json(getOffers(city));
  });

  return router;
}