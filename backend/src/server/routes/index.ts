import { sys } from './system'
import { mem } from './memory'
import { dynroutes } from './dynamics'
import { ide } from './ide'
import { compression } from './compression'
import { lg } from './langgraph'
import { usr } from './users'

export function routes(app: any) {
    sys(app)
    mem(app)
    dynroutes(app)
    ide(app)
    compression(app)
    lg(app)
    usr(app)
}
