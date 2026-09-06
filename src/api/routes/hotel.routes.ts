import { Router } from "express";
import { getHotels } from "../controllers/hotel.controller";

const router = Router();

router.get("/hotels", getHotels);

export default router;