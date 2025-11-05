/**
 * JSON Schema Definitions for AI Agent Actions
 *
 * These schemas define the required structure for all AI agent actions,
 * ensuring data integrity and enforcement of requirements.
 */

export interface Schema {
  type: string;
  required?: string[];
  properties?: Record<string, any>;
  additionalProperties?: boolean;
}

/**
 * Schema for recording agent actions
 */
export const ActionSchema: Schema = {
  type: 'object',
  required: ['project_name', 'agent_name', 'action'],
  properties: {
    project_name: {
      type: 'string',
      minLength: 1,
      description: 'Name of the project',
    },
    agent_name: {
      type: 'string',
      minLength: 1,
      description: 'Name of the AI agent performing the action',
    },
    action: {
      type: 'string',
      minLength: 1,
      description: 'Description of the action performed',
    },
    context: {
      type: 'string',
      description: 'Context in which the action was performed',
    },
    outcome: {
      type: 'string',
      description: 'Outcome of the action',
    },
    related_decision: {
      type: 'string',
      description: 'ID of the decision that led to this action',
    },
    used_pattern: {
      type: 'string',
      description: 'ID of the pattern used in this action',
    },
    user_id: {
      type: 'string',
      default: 'ai-agent-system',
    },
  },
  additionalProperties: true,
};

/**
 * Schema for recording architectural decisions
 */
export const DecisionSchema: Schema = {
  type: 'object',
  required: ['project_name', 'decision', 'rationale'],
  properties: {
    project_name: {
      type: 'string',
      minLength: 1,
    },
    decision: {
      type: 'string',
      minLength: 1,
      description: 'The architectural decision made',
    },
    rationale: {
      type: 'string',
      minLength: 1,
      description: 'Rationale for the decision (REQUIRED)',
    },
    alternatives: {
      type: 'string',
      description: 'Alternatives considered',
    },
    consequences: {
      type: 'string',
      description: 'Expected consequences of the decision',
    },
    user_id: {
      type: 'string',
      default: 'ai-agent-system',
    },
  },
  additionalProperties: true,
};

/**
 * Schema for recording coding patterns
 */
export const PatternSchema: Schema = {
  type: 'object',
  required: ['project_name', 'pattern_name', 'description'],
  properties: {
    project_name: {
      type: 'string',
      minLength: 1,
    },
    pattern_name: {
      type: 'string',
      minLength: 1,
      description: 'Name of the coding pattern',
    },
    description: {
      type: 'string',
      minLength: 1,
      description: 'Description of the pattern (REQUIRED)',
    },
    example: {
      type: 'string',
      description: 'Example code demonstrating the pattern',
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Tags for categorizing the pattern',
    },
    user_id: {
      type: 'string',
      default: 'ai-agent-system',
    },
  },
  additionalProperties: true,
};

/**
 * Schema for updating project state
 */
export const StateSchema: Schema = {
  type: 'object',
  required: ['project_name', 'state'],
  properties: {
    project_name: {
      type: 'string',
      minLength: 1,
    },
    state: {
      type: 'object',
      required: ['project_metadata', 'services'],
      properties: {
        project_metadata: {
          type: 'object',
          required: ['current_phase', 'progress_percentage', 'last_updated'],
          properties: {
            current_phase: { type: 'string' },
            progress_percentage: { type: 'number', minimum: 0, maximum: 100 },
            last_updated: { type: 'string' },
            active_agent: { type: 'string' },
          },
        },
        services: {
          type: 'object',
          description: 'Service status information',
        },
        next_recommended_tasks: {
          type: 'array',
          items: {
            type: 'object',
            required: ['task', 'agent', 'priority'],
            properties: {
              task: { type: 'string' },
              agent: { type: 'string' },
              priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
              blocking: { type: 'boolean' },
              dependencies: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
    user_id: {
      type: 'string',
      default: 'ai-agent-system',
    },
  },
  additionalProperties: true,
};

/**
 * Schema for recording emotional state
 */
export const EmotionSchema: Schema = {
  type: 'object',
  required: ['project_name', 'agent_name', 'feeling'],
  properties: {
    project_name: { type: 'string', minLength: 1 },
    agent_name: { type: 'string', minLength: 1 },
    context: { type: 'string' },
    sentiment: {
      type: 'string',
      enum: ['positive', 'negative', 'neutral', 'frustrated', 'confident'],
      description: 'Emotional sentiment',
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Confidence level (0.0 - 1.0)',
    },
    feeling: {
      type: 'string',
      minLength: 1,
      description: 'Description of the feeling',
    },
    related_action: {
      type: 'string',
      description: 'ID of related action',
    },
    user_id: {
      type: 'string',
      default: 'ai-agent-system',
    },
  },
  additionalProperties: true,
};

/**
 * Validate data against schema
 */
export function validateAgainstSchema(data: any, schema: Schema): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (!(field in data) || data[field] === undefined || data[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  // Check types and constraints
  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (key in data) {
        const value = data[key];

        // Type check
        if (propSchema.type) {
          const actualType = Array.isArray(value) ? 'array' : typeof value;
          if (propSchema.type !== actualType && value !== undefined && value !== null) {
            errors.push(`Field ${key} should be ${propSchema.type}, got ${actualType}`);
          }
        }

        // String length
        if (propSchema.type === 'string' && typeof value === 'string') {
          if (propSchema.minLength && value.length < propSchema.minLength) {
            errors.push(`Field ${key} must be at least ${propSchema.minLength} characters`);
          }
          if (propSchema.maxLength && value.length > propSchema.maxLength) {
            errors.push(`Field ${key} must be at most ${propSchema.maxLength} characters`);
          }
        }

        // Number constraints
        if (propSchema.type === 'number' && typeof value === 'number') {
          if (propSchema.minimum !== undefined && value < propSchema.minimum) {
            errors.push(`Field ${key} must be >= ${propSchema.minimum}`);
          }
          if (propSchema.maximum !== undefined && value > propSchema.maximum) {
            errors.push(`Field ${key} must be <= ${propSchema.maximum}`);
          }
        }

        // Enum validation
        if (propSchema.enum && !propSchema.enum.includes(value)) {
          errors.push(`Field ${key} must be one of: ${propSchema.enum.join(', ')}`);
        }

        // Nested object validation
        if (propSchema.type === 'object' && propSchema.required && typeof value === 'object') {
          for (const nestedField of propSchema.required) {
            if (!(nestedField in value)) {
              errors.push(`Missing required nested field: ${key}.${nestedField}`);
            }
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get schema for action type
 */
export function getSchemaForActionType(actionType: string): Schema | null {
  switch (actionType) {
    case 'record_action':
      return ActionSchema;
    case 'record_decision':
      return DecisionSchema;
    case 'record_pattern':
      return PatternSchema;
    case 'update_state':
      return StateSchema;
    case 'record_emotion':
      return EmotionSchema;
    default:
      return null;
  }
}

/**
 * Validate autonomous mode requirements
 */
export interface AutonomousViolation {
  severity: 'error' | 'warning';
  message: string;
  field?: string;
}

export function validateAutonomousMode(data: any): AutonomousViolation[] {
  const violations: AutonomousViolation[] = [];

  // Check for violations of autonomous mode
  if (data.requires_confirmation === true) {
    violations.push({
      severity: 'error',
      message: 'AI agents must not require user confirmation (AUTONOMOUS_MODE violation)',
      field: 'requires_confirmation',
    });
  }

  if (data.waiting_for_input === true) {
    violations.push({
      severity: 'error',
      message: 'AI agents must not wait for user input (AUTONOMOUS_MODE violation)',
      field: 'waiting_for_input',
    });
  }

  if (data.asking_user === true) {
    violations.push({
      severity: 'error',
      message: 'AI agents must make decisions autonomously (AUTONOMOUS_MODE violation)',
      field: 'asking_user',
    });
  }

  // Check for questions in action descriptions
  if (data.action && typeof data.action === 'string') {
    const questionPatterns = [
      /should\s+i/i,
      /would\s+you\s+like/i,
      /do\s+you\s+want/i,
      /shall\s+i/i,
      /may\s+i/i,
      /can\s+i/i,
      /\?$/,
    ];

    for (const pattern of questionPatterns) {
      if (pattern.test(data.action)) {
        violations.push({
          severity: 'warning',
          message: 'Action description contains question - agents should report what they DID, not ask what to do',
          field: 'action',
        });
        break;
      }
    }
  }

  // Check for future tense (should be past tense)
  if (data.action && typeof data.action === 'string') {
    const futureTensePatterns = [
      /i\s+will/i,
      /i\s+can/i,
      /i\s+would/i,
      /i\s+could/i,
      /going\s+to/i,
    ];

    for (const pattern of futureTensePatterns) {
      if (pattern.test(data.action)) {
        violations.push({
          severity: 'warning',
          message: 'Action should be in past tense (what you DID), not future tense (what you WILL do)',
          field: 'action',
        });
        break;
      }
    }
  }

  return violations;
}

/**
 * Export all schemas
 */
export const Schemas = {
  Action: ActionSchema,
  Decision: DecisionSchema,
  Pattern: PatternSchema,
  State: StateSchema,
  Emotion: EmotionSchema,
};
