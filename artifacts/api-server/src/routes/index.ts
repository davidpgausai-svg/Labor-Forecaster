import { Router, type IRouter } from "express";
import healthRouter from "./health";
import districtsRouter from "./districts";
import bargainingUnitsRouter from "./bargaining-units";
import employeesRouter from "./employees";
import salarySchedulesRouter from "./salary-schedules";
import hourlySchedulesRouter from "./hourly-schedules";
import scenariosRouter from "./scenarios";
import heatmapRouter from "./heatmap";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(districtsRouter);
router.use(bargainingUnitsRouter);
router.use(employeesRouter);
router.use(salarySchedulesRouter);
router.use(hourlySchedulesRouter);
router.use(scenariosRouter);
router.use(heatmapRouter);
router.use(dashboardRouter);

export default router;
