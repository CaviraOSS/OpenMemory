"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.get_most_volatile = exports.compare_facts = exports.apply_decay = exports.get_temporal_stats = exports.search_temporal_facts = exports.get_subject_facts = exports.invalidate_temporal_fact = exports.update_temporal_fact = exports.get_predicate_history = exports.get_entity_timeline = exports.get_current_temporal_fact = exports.get_temporal_fact = exports.create_temporal_fact = void 0;
exports.temporal = temporal;
const store_1 = require("../../temporal_graph/store");
const query_1 = require("../../temporal_graph/query");
const timeline_1 = require("../../temporal_graph/timeline");
const create_temporal_fact = async (req, res) => {
    try {
        const { subject, predicate, object, valid_from, confidence, metadata } = req.body;
        if (!subject || !predicate || !object) {
            return res.status(400).json({ error: 'Missing required fields: subject, predicate, object' });
        }
        const valid_from_date = valid_from ? new Date(valid_from) : new Date();
        const conf = confidence !== undefined ? Math.max(0, Math.min(1, confidence)) : 1.0;
        const id = await (0, store_1.insert_fact)(subject, predicate, object, valid_from_date, conf, metadata);
        res.json({
            id,
            subject,
            predicate,
            object,
            valid_from: valid_from_date.toISOString(),
            confidence: conf,
            message: 'Fact created successfully'
        });
    }
    catch (error) {
        console.error('[TEMPORAL API] Error creating fact:', error);
        res.status(500).json({ error: 'Failed to create fact' });
    }
};
exports.create_temporal_fact = create_temporal_fact;
const get_temporal_fact = async (req, res) => {
    try {
        const { subject, predicate, object, at, min_confidence } = req.query;
        if (!subject && !predicate && !object) {
            return res.status(400).json({ error: 'At least one of subject, predicate, or object is required' });
        }
        const at_date = at ? new Date(at) : new Date();
        const min_conf = min_confidence ? parseFloat(min_confidence) : 0.1;
        const facts = await (0, query_1.query_facts_at_time)(subject, predicate, object, at_date, min_conf);
        res.json({
            facts,
            query: { subject, predicate, object, at: at_date.toISOString(), min_confidence: min_conf },
            count: facts.length
        });
    }
    catch (error) {
        console.error('[TEMPORAL API] Error querying facts:', error);
        res.status(500).json({ error: 'Failed to query facts' });
    }
};
exports.get_temporal_fact = get_temporal_fact;
const get_current_temporal_fact = async (req, res) => {
    try {
        const { subject, predicate } = req.query;
        if (!subject || !predicate) {
            return res.status(400).json({ error: 'Both subject and predicate are required' });
        }
        const fact = await (0, query_1.get_current_fact)(subject, predicate);
        if (!fact) {
            return res.status(404).json({ error: 'No current fact found', subject, predicate });
        }
        res.json({ fact });
    }
    catch (error) {
        console.error('[TEMPORAL API] Error getting current fact:', error);
        res.status(500).json({ error: 'Failed to get current fact' });
    }
};
exports.get_current_temporal_fact = get_current_temporal_fact;
const get_entity_timeline = async (req, res) => {
    try {
        const { subject, predicate } = req.query;
        if (!subject) {
            return res.status(400).json({ error: 'Subject parameter is required' });
        }
        const timeline = await (0, timeline_1.get_subject_timeline)(subject, predicate);
        res.json({
            subject,
            predicate,
            timeline,
            count: timeline.length
        });
    }
    catch (error) {
        console.error('[TEMPORAL API] Error getting timeline:', error);
        res.status(500).json({ error: 'Failed to get timeline' });
    }
};
exports.get_entity_timeline = get_entity_timeline;
const get_predicate_history = async (req, res) => {
    try {
        const { predicate, from, to } = req.query;
        if (!predicate) {
            return res.status(400).json({ error: 'Predicate parameter is required' });
        }
        const from_date = from ? new Date(from) : undefined;
        const to_date = to ? new Date(to) : undefined;
        const timeline = await (0, timeline_1.get_predicate_timeline)(predicate, from_date, to_date);
        res.json({
            predicate,
            from: from_date?.toISOString(),
            to: to_date?.toISOString(),
            timeline,
            count: timeline.length
        });
    }
    catch (error) {
        console.error('[TEMPORAL API] Error getting predicate timeline:', error);
        res.status(500).json({ error: 'Failed to get predicate timeline' });
    }
};
exports.get_predicate_history = get_predicate_history;
const update_temporal_fact = async (req, res) => {
    try {
        const { id } = req.params;
        const { confidence, metadata } = req.body;
        if (!id) {
            return res.status(400).json({ error: 'Fact ID is required' });
        }
        if (confidence === undefined && metadata === undefined) {
            return res.status(400).json({ error: 'At least one of confidence or metadata must be provided' });
        }
        const conf = confidence !== undefined ? Math.max(0, Math.min(1, confidence)) : undefined;
        await (0, store_1.update_fact)(id, conf, metadata);
        res.json({ id, confidence: conf, metadata, message: 'Fact updated successfully' });
    }
    catch (error) {
        console.error('[TEMPORAL API] Error updating fact:', error);
        res.status(500).json({ error: 'Failed to update fact' });
    }
};
exports.update_temporal_fact = update_temporal_fact;
const invalidate_temporal_fact = async (req, res) => {
    try {
        const { id } = req.params;
        const { valid_to } = req.body;
        if (!id) {
            return res.status(400).json({ error: 'Fact ID is required' });
        }
        const valid_to_date = valid_to ? new Date(valid_to) : new Date();
        await (0, store_1.invalidate_fact)(id, valid_to_date);
        res.json({ id, valid_to: valid_to_date.toISOString(), message: 'Fact invalidated successfully' });
    }
    catch (error) {
        console.error('[TEMPORAL API] Error invalidating fact:', error);
        res.status(500).json({ error: 'Failed to invalidate fact' });
    }
};
exports.invalidate_temporal_fact = invalidate_temporal_fact;
const get_subject_facts = async (req, res) => {
    try {
        const { subject } = req.params;
        const { at, include_historical } = req.query;
        if (!subject) {
            return res.status(400).json({ error: 'Subject parameter is required' });
        }
        const at_date = at ? new Date(at) : undefined;
        const include_hist = include_historical === 'true';
        const facts = await (0, query_1.get_facts_by_subject)(subject, at_date, include_hist);
        res.json({
            subject,
            at: at_date?.toISOString(),
            include_historical: include_hist,
            facts,
            count: facts.length
        });
    }
    catch (error) {
        console.error('[TEMPORAL API] Error getting subject facts:', error);
        res.status(500).json({ error: 'Failed to get subject facts' });
    }
};
exports.get_subject_facts = get_subject_facts;
const search_temporal_facts = async (req, res) => {
    try {
        const { pattern, field = 'subject', at } = req.query;
        if (!pattern) {
            return res.status(400).json({ error: 'Pattern parameter is required' });
        }
        if (!['subject', 'predicate', 'object'].includes(field)) {
            return res.status(400).json({ error: 'Field must be one of: subject, predicate, object' });
        }
        const at_date = at ? new Date(at) : undefined;
        const facts = await (0, query_1.search_facts)(pattern, field, at_date);
        res.json({
            pattern,
            field,
            at: at_date?.toISOString(),
            facts,
            count: facts.length
        });
    }
    catch (error) {
        console.error('[TEMPORAL API] Error searching facts:', error);
        res.status(500).json({ error: 'Failed to search facts' });
    }
};
exports.search_temporal_facts = search_temporal_facts;
const get_temporal_stats = async (req, res) => {
    try {
        const active_facts = await (0, store_1.get_active_facts_count)();
        const total_facts = await (0, store_1.get_total_facts_count)();
        const historical_facts = total_facts - active_facts;
        res.json({
            active_facts,
            historical_facts,
            total_facts,
            historical_percentage: total_facts > 0 ? ((historical_facts / total_facts) * 100).toFixed(2) + '%' : '0%'
        });
    }
    catch (error) {
        console.error('[TEMPORAL API] Error getting stats:', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
};
exports.get_temporal_stats = get_temporal_stats;
const apply_decay = async (req, res) => {
    try {
        const { decay_rate = 0.01 } = req.body;
        const updated = await (0, store_1.apply_confidence_decay)(decay_rate);
        res.json({
            decay_rate,
            facts_updated: updated,
            message: 'Confidence decay applied successfully'
        });
    }
    catch (error) {
        console.error('[TEMPORAL API] Error applying decay:', error);
        res.status(500).json({ error: 'Failed to apply confidence decay' });
    }
};
exports.apply_decay = apply_decay;
const compare_facts = async (req, res) => {
    try {
        const { subject, time1, time2 } = req.query;
        if (!subject || !time1 || !time2) {
            return res.status(400).json({ error: 'subject, time1, and time2 parameters are required' });
        }
        const t1 = new Date(time1);
        const t2 = new Date(time2);
        const comparison = await (0, timeline_1.compare_time_points)(subject, t1, t2);
        res.json({
            subject,
            time1: t1.toISOString(),
            time2: t2.toISOString(),
            ...comparison,
            summary: {
                added: comparison.added.length,
                removed: comparison.removed.length,
                changed: comparison.changed.length,
                unchanged: comparison.unchanged.length
            }
        });
    }
    catch (error) {
        console.error('[TEMPORAL API] Error comparing facts:', error);
        res.status(500).json({ error: 'Failed to compare facts' });
    }
};
exports.compare_facts = compare_facts;
const get_most_volatile = async (req, res) => {
    try {
        const { subject, limit = 10 } = req.query;
        const volatile = await (0, timeline_1.get_volatile_facts)(subject, parseInt(limit));
        res.json({
            subject,
            limit: parseInt(limit),
            volatile_facts: volatile,
            count: volatile.length
        });
    }
    catch (error) {
        console.error('[TEMPORAL API] Error getting volatile facts:', error);
        res.status(500).json({ error: 'Failed to get volatile facts' });
    }
};
exports.get_most_volatile = get_most_volatile;
function temporal(app) {
    app.post('/api/temporal/fact', exports.create_temporal_fact);
    app.get('/api/temporal/fact', exports.get_temporal_fact);
    app.get('/api/temporal/fact/current', exports.get_current_temporal_fact);
    app.patch('/api/temporal/fact/:id', exports.update_temporal_fact);
    app.delete('/api/temporal/fact/:id', exports.invalidate_temporal_fact);
    app.get('/api/temporal/timeline', exports.get_entity_timeline);
    app.get('/api/temporal/subject/:subject', exports.get_subject_facts);
    app.get('/api/temporal/search', exports.search_temporal_facts);
    app.get('/api/temporal/compare', exports.compare_facts);
    app.get('/api/temporal/stats', exports.get_temporal_stats);
    app.post('/api/temporal/decay', exports.apply_decay);
    app.get('/api/temporal/volatile', exports.get_most_volatile);
}
