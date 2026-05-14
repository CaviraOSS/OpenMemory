import { sys } from "./system";
import { mem } from "./memory";
import { usr } from "./users";

export function routes(app: any) {
  sys(app);
  mem(app);
  usr(app);
}
