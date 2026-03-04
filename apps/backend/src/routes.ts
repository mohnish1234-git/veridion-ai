import { Router } from "express";
import { authController } from "./modules/auth/auth.controller";
import { portfolioController } from "./modules/portfolio/portfolio.controller";
import { behavioralController } from "./modules/behavioral/behavioral.controller";
import { marketDataController } from "./modules/market-data/market-data.controller";
import { userController } from "./modules/user/user.controller";
import { monteCarloController } from "./modules/montecarlo/montecarlo.controller";
import { goalsController } from "./modules/goals/goals.controller";
import { riskController } from "./modules/risk/risk.controller";
import { alertsController } from "./modules/alerts/alerts.controller";
import { eventsController } from "./modules/events/events.controller";
import { explainabilityController } from "./modules/explainability/explainability.controller";
import { dashboardController } from "./modules/dashboard/dashboard.controller";

const router = Router();

// Auth (public)
router.use(authController);

// Protected modules
router.use("/portfolio", portfolioController);
router.use("/behavioral", behavioralController);
router.use("/market", marketDataController);
router.use(userController);
router.use("/montecarlo", monteCarloController);
router.use("/goals", goalsController);
router.use("/risk", riskController);
router.use("/alerts", alertsController);
router.use("/events", eventsController);
router.use("/explainability", explainabilityController);
router.use("/dashboard", dashboardController);

export default router;
