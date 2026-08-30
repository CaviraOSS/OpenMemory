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
 *  file  : integrations/n8n-nodes-longmemory/nodes/LongMemory/LongMemory.node.ts
 *  usage : configures the LongMemory n8n-nodes-longmemory integration
 */

import type {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
    IHttpRequestOptions,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

const unwrap = (value: unknown): unknown => value && typeof value === 'object' && 'data' in value ? (value as { data: unknown }).data : value;

export class LongMemory implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'LongMemory',
        name: 'longMemory',
        icon: { light: 'file:longmemory.svg', dark: 'file:longmemory.dark.svg' },
        group: ['input'],
        version: 1,
        description: 'Recall and store durable AI memory',
        subtitle: '={{$parameter["operation"]}}',
        defaults: { name: 'LongMemory' },
        inputs: [NodeConnectionTypes.Main],
        outputs: [NodeConnectionTypes.Main],
        usableAsTool: true,
        credentials: [{ name: 'longMemoryApi', required: true }],
        properties: [
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                options: [
                    { name: 'Recall', value: 'recall', action: 'Recall memory' },
                    { name: 'Store', value: 'store', action: 'Store a memory' },
                    { name: 'Explain', value: 'explain', action: 'Explain a memory' },
                    { name: 'Stats', value: 'stats', action: 'Read memory statistics' },
                ],
                default: 'recall',
            },
            {
                displayName: 'Query', name: 'query', type: 'string', default: '', required: true,
                displayOptions: { show: { operation: ['recall'] } },
                typeOptions: { rows: 3 },
            },
            {
                displayName: 'Mode', name: 'mode', type: 'options', default: 'associative',
                options: [
                    { name: 'Strict', value: 'strict' },
                    { name: 'Historical', value: 'historical' },
                    { name: 'Associative', value: 'associative' },
                    { name: 'World Grounded', value: 'world_grounded' },
                ],
                displayOptions: { show: { operation: ['recall'] } },
            },
            {
                displayName: 'Limit', name: 'limit', type: 'number', default: 50,
                description: 'Max number of results to return',
                typeOptions: { minValue: 1, maxValue: 100 },
                displayOptions: { show: { operation: ['recall'] } },
            },
            {
                displayName: 'Token Budget', name: 'tokenBudget', type: 'number', default: 2048,
                typeOptions: { minValue: 64, maxValue: 32768 },
                displayOptions: { show: { operation: ['recall'] } },
            },
            {
                displayName: 'Memory', name: 'text', type: 'string', default: '', required: true,
                displayOptions: { show: { operation: ['store'] } },
                typeOptions: { rows: 4 },
            },
            {
                displayName: 'User ID', name: 'userId', type: 'string', default: 'n8n', required: true,
                displayOptions: { show: { operation: ['store'] } },
            },
            {
                displayName: 'Source', name: 'source', type: 'string', default: 'n8n',
                displayOptions: { show: { operation: ['store'] } },
            },
            {
                displayName: 'Memory ID', name: 'memoryId', type: 'string', default: '', required: true,
                displayOptions: { show: { operation: ['explain'] } },
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const input = this.getInputData();
        const output: INodeExecutionData[] = [];
        const credentials = await this.getCredentials('longMemoryApi');
        const baseUrl = String(credentials.baseUrl).replace(/\/+$/, '');
        for (let itemIndex = 0; itemIndex < input.length; itemIndex++) {
            try {
                const operation = this.getNodeParameter('operation', itemIndex) as string;
                let request: IHttpRequestOptions;
                if (operation === 'recall') {
                    request = {
                        method: 'POST', url: `${baseUrl}/v1/recall`,
                        body: {
                            text: this.getNodeParameter('query', itemIndex) as string,
                            mode: this.getNodeParameter('mode', itemIndex) as string,
                            k: this.getNodeParameter('limit', itemIndex) as number,
                            token_budget: this.getNodeParameter('tokenBudget', itemIndex) as number,
                        },
                        json: true,
                    };
                } else if (operation === 'store') {
                    const source = this.getNodeParameter('source', itemIndex) as string;
                    request = {
                        method: 'POST', url: `${baseUrl}/v1/ingest`,
                        body: {
                            user_id: this.getNodeParameter('userId', itemIndex) as string,
                            text: this.getNodeParameter('text', itemIndex) as string,
                            source: { id: source, type: 'n8n' },
                            metadata: { source_type: 'n8n', workflow_id: this.getWorkflow().id ?? null },
                        },
                        json: true,
                    };
                } else if (operation === 'explain') {
                    const memoryId = encodeURIComponent(this.getNodeParameter('memoryId', itemIndex) as string);
                    request = { method: 'GET', url: `${baseUrl}/v1/explain/${memoryId}`, json: true };
                } else {
                    request = { method: 'GET', url: `${baseUrl}/v1/stats`, json: true };
                }
                const response = await this.helpers.httpRequestWithAuthentication.call(this, 'longMemoryApi', request);
                output.push({ json: unwrap(response) as INodeExecutionData['json'], pairedItem: itemIndex });
            } catch (error) {
                if (this.continueOnFail()) {
                    output.push({ json: input[itemIndex].json, error, pairedItem: itemIndex });
                    continue;
                }
                throw new NodeOperationError(this.getNode(), error, { itemIndex });
            }
        }
        return [output];
    }
}
