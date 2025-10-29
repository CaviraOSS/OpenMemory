import { sys } from './system'
import { mem } from './memory'
import { dynroutes } from './dynamics'
import { ide } from './ide'

export function routes(app: any) {
    sys(app)
    mem(app)
    dynroutes(app)
    ide(app)
}
