import express from "express";
import { sendTestPush } from "../controllers/testController.js";

const router = express.Router();

router.post("/test-push", sendTestPush);

export default router;
