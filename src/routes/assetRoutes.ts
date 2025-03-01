import { Router } from "express";
import { createAssetJob } from "../controllers/assetController";

const router = Router();

router.post("/", createAssetJob);

export default router;
