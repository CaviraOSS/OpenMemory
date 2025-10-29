import { sys } from './system'
import { mem } from './memory'
import { dynroutes } from './dynamics'

export function routes(app: any) {
    sys(app)
    mem(app)
    dynroutes(app)
}
