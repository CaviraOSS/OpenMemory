export type chunk = { text: string, start: number, end: number, tokens: number }

const cpt = 4
const est = (t: string) => Math.ceil(t.length / cpt)

export const chunk_text = (txt: string, tgt = 768, ovr = 0.1): chunk[] => {
    const tot = est(txt)
    if (tot <= tgt) return [{ text: txt, start: 0, end: txt.length, tokens: tot }]

    const tch = tgt * cpt, och = Math.floor(tch * ovr)
    const paras = txt.split(/\n\n+/)

    const chks: chunk[] = []
    let cur = '', cs = 0

    for (const p of paras) {
        const sents = p.split(/(?<=[.!?])\s+/)
        for (const s of sents) {
            const pot = cur + (cur ? ' ' : '') + s
            if (pot.length > tch && cur.length > 0) {
                chks.push({ text: cur, start: cs, end: cs + cur.length, tokens: est(cur) })
                const ovt = cur.slice(-och)
                cur = ovt + ' ' + s
                cs = cs + cur.length - ovt.length - 1
            } else cur = pot
        }
    }

    if (cur.length > 0) chks.push({ text: cur, start: cs, end: cs + cur.length, tokens: est(cur) })
    return chks
}

export const agg_vec = (vecs: number[][]): number[] => {
    const n = vecs.length
    if (!n) throw new Error('no vecs')
    if (n === 1) return vecs[0].slice()

    const d = vecs[0].length, r = new Array(d).fill(0)
    for (const v of vecs) for (let i = 0; i < d; i++)r[i] += v[i]
    const rc = 1 / n
    for (let i = 0; i < d; i++)r[i] *= rc
    return r
}

export const join_chunks = (cks: chunk[]) => cks.length ? cks.map(c => c.text).join(' ') : ''
