import { systemRoutes } from "./system";
import { v1 } from "./v1";

export function routes(app: any) {
  systemRoutes(app);
  v1(app);
}
