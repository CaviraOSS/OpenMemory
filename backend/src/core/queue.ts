export class job_q<t> {
    private q: t[] = []
    private busy = false

    constructor(public delay = 0) { }

    add(x: t): Promise<void> {
        return new Promise((ok, no) => {
            this.q.push({ item: x, ok, no } as any)
            this.run()
        })
    }

    private async run() {
        if (this.busy) return
        this.busy = true
        while (this.q.length) {
            const job = this.q.shift()!
            if (this.delay > 0) await new Promise(r => setTimeout(r, this.delay))
            const { item, ok } = job as any
            ok(item)
        }
        this.busy = false
    }
}

export class db_q {
    private q = new job_q<() => Promise<any>>(0)

    async exec<t>(fn: () => Promise<t>): Promise<t> {
        return new Promise((ok, no) => {
            this.q.add(async () => {
                try {
                    const res = await fn()
                    ok(res)
                } catch (err) {
                    no(err)
                }
            })
        })
    }
}

export const dbq = new db_q()
