import { sys } from "./system";
import { mem } from "./memory";
import { dynroutes } from "./dynamics";
import { ide } from "./ide";
import { compression } from "./compression";
import { lg } from "./langgraph";
import { usr } from "./users";
import { temporal } from "./temporal";
import { dash } from "./dashboard";
import { vercel } from "./vercel";
import { src } from "./sources";
import { audit } from "./audit";
import { versioning } from "./versioning";
import { citations } from "./citations";
import { extraction } from "./extraction";
import { clauses } from "./clauses";
import { templates } from "./templates";
import { compliance } from "./compliance";
import { metrics } from "./metrics";

export function routes(app: any) {
    metrics(app);  // Register first - public endpoint for Prometheus scraping
    sys(app);
    mem(app);
    dynroutes(app);
    ide(app);
    compression(app);
    lg(app);
    usr(app);
    temporal(app);
    dash(app);
    vercel(app);
    src(app);
    audit(app);
    versioning(app);
    citations(app);
    extraction(app);
    clauses(app);
    templates(app);
    compliance(app);
}

