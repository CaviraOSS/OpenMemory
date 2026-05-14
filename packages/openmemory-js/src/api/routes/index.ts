import { sys } from "./system";
import { mem } from "./memory";
import { usr } from "./users";
import { v1 } from "./v1";

export function routes(app: any) {
  sys(app);
  mem(app);
  usr(app);
  v1(app);
}
