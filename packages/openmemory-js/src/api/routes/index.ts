import { systemRoutes } from "./system";
import { memoryRoutes } from "./memory";
import { userRoutes } from "./users";
import { v1 } from "./v1";

export function routes(app: any) {
  systemRoutes(app);
  memoryRoutes(app);
  userRoutes(app);
  v1(app);
}
