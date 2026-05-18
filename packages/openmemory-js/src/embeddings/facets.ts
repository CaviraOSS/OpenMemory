export interface FacetConfig {
  model: string;
  decay_lambda: number;
  weight: number;
  patterns: RegExp[];
}

export const facetConfigs: Record<string, FacetConfig> = {
  episodic: {
    model: "episodic-optimized",
    decay_lambda: 0.015,
    weight: 1.2,
    patterns: [
      /\b(today|yesterday|tomorrow|last\s+(week|month|year)|next\s+(week|month|year))\b/i,
      /\b(remember\s+when|recall|that\s+time|when\s+I|I\s+was|we\s+were)\b/i,
      /\b(went|saw|met|felt|heard|visited|attended|participated)\b/i,
      /\b(at\s+\d{1,2}:\d{2}|on\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i,
      /\b(event|moment|experience|incident|occurrence|happened)\b/i,
      /\bI\s+'?m\s+going\s+to\b/i,
    ],
  },
  semantic: {
    model: "semantic-optimized",
    decay_lambda: 0.005,
    weight: 1.0,
    patterns: [
      /\b(is\s+a|represents|means|stands\s+for|defined\s+as)\b/i,
      /\b(concept|theory|principle|law|hypothesis|theorem|axiom)\b/i,
      /\b(fact|statistic|data|evidence|proof|research|study|report)\b/i,
      /\b(capital|population|distance|weight|height|width|depth)\b/i,
      /\b(history|science|geography|math|physics|biology|chemistry)\b/i,
      /\b(know|understand|learn|read|write|speak)\b/i,
    ],
  },
  procedural: {
    model: "procedural-optimized",
    decay_lambda: 0.008,
    weight: 1.1,
    patterns: [
      /\b(how\s+to|step\s+by\s+step|guide|tutorial|manual|instructions)\b/i,
      /\b(first|second|then|next|finally|afterwards|lastly)\b/i,
      /\b(install|run|execute|compile|build|deploy|configure|setup)\b/i,
      /\b(click|press|type|enter|select|drag|drop|scroll)\b/i,
      /\b(method|function|class|algorithm|routine|recipie)\b/i,
      /\b(to\s+do|to\s+make|to\s+build|to\s+create)\b/i,
    ],
  },
  emotional: {
    model: "emotional-optimized",
    decay_lambda: 0.02,
    weight: 1.3,
    patterns: [
      /\b(feel|feeling|felt|emotions?|mood|vibe)\b/i,
      /\b(happy|sad|angry|mad|excited|scared|anxious|nervous|depressed)\b/i,
      /\b(love|hate|like|dislike|adore|detest|enjoy|loathe)\b/i,
      /\b(amazing|terrible|awesome|awful|wonderful|horrible|great|bad)\b/i,
      /\b(frustrated|confused|overwhelmed|stressed|relaxed|calm)\b/i,
      /\b(wow|omg|yay|nooo|ugh|sigh)\b/i,
      /[!]{2,}/,
    ],
  },
  reflective: {
    model: "reflective-optimized",
    decay_lambda: 0.001,
    weight: 0.8,
    patterns: [
      /\b(realize|realized|realization|insight|epiphany)\b/i,
      /\b(think|thought|thinking|ponder|contemplate|reflect)\b/i,
      /\b(understand|understood|understanding|grasp|comprehend)\b/i,
      /\b(pattern|trend|connection|link|relationship|correlation)\b/i,
      /\b(lesson|moral|takeaway|conclusion|summary|implication)\b/i,
      /\b(feedback|review|analysis|evaluation|assessment)\b/i,
      /\b(improve|grow|change|adapt|evolve)\b/i,
    ],
  },
};

export const facets = Object.keys(facetConfigs);
