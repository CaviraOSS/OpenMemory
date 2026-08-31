/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/core/temporal/interval_algebra.ts
 *  usage : implements the LongMemory interval algebra component
 */


export type Interval = {
    start: number;
    
    end: number | null;
};

function end_of(i: Interval): number {
    return i.end ?? Number.POSITIVE_INFINITY;
}


export function before(a: Interval, b: Interval): boolean {
    return end_of(a) <= b.start;
}


export function after(a: Interval, b: Interval): boolean {
    return before(b, a);
}


export function overlaps(a: Interval, b: Interval): boolean {
    return a.start < end_of(b) && b.start < end_of(a);
}


export function during(a: Interval, b: Interval): boolean {
    return a.start >= b.start && end_of(a) <= end_of(b);
}


export function contains(a: Interval, b: Interval): boolean {
    return during(b, a);
}


export function equals(a: Interval, b: Interval): boolean {
    return a.start === b.start && end_of(a) === end_of(b);
}
