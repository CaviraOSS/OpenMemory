/*
 *   _____                 ___  ___
 *  |  _  |                |  \/  |
 *  | | | |_ __   ___ _ __ | .  . | ___ _ __ ___   ___  _ __ _   _
 *  | | | | '_ \ / _ \ '_ \| |\/| |/ _ \ '_ ` _ \ / _ \| '__| | | |
 *  \ \_/ / |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
 *   \___/| .__/ \___|_| |_\_|  |_/\___|_| |_| |_|\___/|_|   \__, |
 *        | |                                                 __/ |
 *        |_|                                                |___/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/core/temporal/bitemporal.ts
 *  usage : bitemporal validity predicates (valid + recorded time)
 */















import type { HydroNode } from '../types/hydro_node.js';


export function is_valid_at(node: HydroNode, valid_time: number): boolean {
    const { valid_from, valid_to } = node.temporal;
    return valid_from <= valid_time && (valid_to === null || valid_time < valid_to);
}


export function is_recorded_at(node: HydroNode, recorded_time: number): boolean {
    const { recorded_at, superseded_at } = node.temporal;
    return (
        recorded_at <= recorded_time &&
        (superseded_at === null || recorded_time < superseded_at)
    );
}





export function is_current(node: HydroNode, now: number): boolean {
    return (
        node.temporal.superseded_at === null &&
        node.temporal.recorded_at <= now &&
        is_valid_at(node, now)
    );
}


export function is_valid_and_recorded_at(
    node: HydroNode,
    valid_time: number,
    recorded_time: number,
): boolean {
    return is_valid_at(node, valid_time) && is_recorded_at(node, recorded_time);
}
