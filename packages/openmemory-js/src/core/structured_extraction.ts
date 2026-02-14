/**
 * Structured Metadata Extraction (D3)
 *
 * Schema-driven extraction of structured data from documents.
 * Supports multiple document types with type-specific field extraction.
 */

import { z } from "zod";

// Document types with their extraction schemas
export type DocumentType =
    | "agreement"
    | "contract"
    | "policy"
    | "memo"
    | "report"
    | "invoice"
    | "legal_filing"
    | "correspondence"
    | "unknown";

// Base metadata schema (applies to all documents)
const BaseMetadataSchema = z.object({
    doc_type: z.enum([
        "agreement",
        "contract",
        "policy",
        "memo",
        "report",
        "invoice",
        "legal_filing",
        "correspondence",
        "unknown",
    ]).optional(),
    title: z.string().optional(),
    author: z.string().optional(),
    created_date: z.string().datetime().optional(),
    language: z.string().optional(),
    word_count: z.number().int().positive().optional(),
    confidence: z.number().min(0).max(1).optional(),
});

// Agreement/Contract specific fields
const AgreementMetadataSchema = BaseMetadataSchema.extend({
    doc_type: z.literal("agreement").or(z.literal("contract")),
    parties: z.array(z.string()).optional(),
    effective_date: z.string().datetime().optional(),
    expiration_date: z.string().datetime().optional(),
    signing_date: z.string().datetime().optional(),
    governing_law: z.string().optional(),
    jurisdiction: z.string().optional(),
    contract_value: z.object({
        amount: z.number(),
        currency: z.string(),
    }).optional(),
    term_length: z.string().optional(),
    renewal_terms: z.string().optional(),
    termination_notice_days: z.number().int().optional(),
});

// Invoice specific fields
const InvoiceMetadataSchema = BaseMetadataSchema.extend({
    doc_type: z.literal("invoice"),
    invoice_number: z.string().optional(),
    invoice_date: z.string().datetime().optional(),
    due_date: z.string().datetime().optional(),
    vendor: z.string().optional(),
    customer: z.string().optional(),
    total_amount: z.object({
        amount: z.number(),
        currency: z.string(),
    }).optional(),
    tax_amount: z.object({
        amount: z.number(),
        currency: z.string(),
    }).optional(),
    line_items: z.array(z.object({
        description: z.string(),
        quantity: z.number().optional(),
        unit_price: z.number().optional(),
        amount: z.number().optional(),
    })).optional(),
});

// Legal filing specific fields
const LegalFilingMetadataSchema = BaseMetadataSchema.extend({
    doc_type: z.literal("legal_filing"),
    case_number: z.string().optional(),
    court: z.string().optional(),
    judge: z.string().optional(),
    filing_date: z.string().datetime().optional(),
    parties: z.array(z.object({
        name: z.string(),
        role: z.enum(["plaintiff", "defendant", "appellant", "respondent", "applicant", "petitioner", "other"]),
    })).optional(),
    document_type: z.string().optional(), // e.g., "motion", "brief", "complaint"
    matter: z.string().optional(),
});

// Correspondence specific fields
const CorrespondenceMetadataSchema = BaseMetadataSchema.extend({
    doc_type: z.literal("correspondence"),
    from: z.string().optional(),
    to: z.array(z.string()).optional(),
    cc: z.array(z.string()).optional(),
    subject: z.string().optional(),
    date: z.string().datetime().optional(),
    is_reply: z.boolean().optional(),
    reference_number: z.string().optional(),
});

// Generic document metadata
const GenericMetadataSchema = BaseMetadataSchema.extend({
    keywords: z.array(z.string()).optional(),
    summary: z.string().optional(),
    sections: z.array(z.string()).optional(),
});

export type BaseMetadata = z.infer<typeof BaseMetadataSchema>;
export type AgreementMetadata = z.infer<typeof AgreementMetadataSchema>;
export type InvoiceMetadata = z.infer<typeof InvoiceMetadataSchema>;
export type LegalFilingMetadata = z.infer<typeof LegalFilingMetadataSchema>;
export type CorrespondenceMetadata = z.infer<typeof CorrespondenceMetadataSchema>;
export type GenericMetadata = z.infer<typeof GenericMetadataSchema>;

export type StructuredMetadata =
    | AgreementMetadata
    | InvoiceMetadata
    | LegalFilingMetadata
    | CorrespondenceMetadata
    | GenericMetadata;

// Extraction patterns
const PATTERNS = {
    // Document type detection
    doc_type: {
        agreement: /\b(?:agreement|nda|non-disclosure|confidentiality|license)\b/i,
        contract: /\b(?:contract|terms\s+and\s+conditions|service\s+agreement)\b/i,
        policy: /\b(?:policy|procedure|guideline|standard)\b/i,
        memo: /\b(?:memorandum|memo|internal\s+note)\b/i,
        report: /\b(?:report|analysis|review|assessment)\b/i,
        invoice: /\b(?:invoice|bill|statement)\b/i,
        legal_filing: /\b(?:court|filing|motion|brief|complaint|petition|affidavit)\b/i,
        correspondence: /\b(?:dear\s|sincerely|regards|re:|subject:)\b/i,
    },

    // Party extraction
    parties: {
        between: /between\s+([A-Z][A-Za-z0-9\s&.,'"()-]{1,100}?)[\s\n]+(?:and|,)[\s\n]+([A-Z][A-Za-z0-9\s&.,'"()-]{1,100}?)(?:[\s\n]*[,.;]|effective|$)/i,
        party_def: /[""]([A-Z][A-Za-z\s]+)[""](?:\s+or\s+the\s+[""]([A-Z][a-z]+)[""])?/g,
    },

    // Date extraction
    dates: {
        effective: /effective(?:\s+date)?(?:\s+is|:\s*|\s+of\s+)?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/i,
        expiration: /(?:expir(?:ation|es?)|terminat(?:es?|ion))(?:\s+date)?(?:\s+is|:\s*|\s+on\s+)?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/i,
        signing: /(?:signed|dated|executed)(?:\s+(?:on|as\s+of))?(?:\s+this)?\s*(?:day\s+of\s+)?([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/i,
        general: /(?:date|dated)(?:\s+is|:\s*)?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    },

    // Currency/amount extraction
    currency: /(?:(?:USD|AUD|EUR|GBP|CAD)\s*)?[\$£€]\s*([\d,]+(?:\.\d{2})?)\s*(?:USD|AUD|EUR|GBP|CAD)?/gi,
    amount_with_currency: /(?:(USD|AUD|EUR|GBP|CAD)\s*)?[\$£€]?\s*([\d,]+(?:\.\d{2})?)\s*(?:(USD|AUD|EUR|GBP|CAD))?/i,

    // Invoice specific
    invoice: {
        number: /(?:invoice|inv|bill)\s*(?:#|no\.?|number)\s*:?\s*([A-Z0-9-]+)/i,
        due_date: /(?:due|payment\s+due)(?:\s+date)?(?:\s+is|:\s*)?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    },

    // Legal filing specific
    legal: {
        case_number: /(?:case|matter|file)\s*(?:#|no\.?|number)?:?\s*([A-Z0-9-\/\s]+?)(?:\n|$)/i,
        court: /(?:in\s+the\s+|before\s+the\s+)?([A-Z][A-Za-z\s]+(?:Court|Tribunal|Commission|Board))/i,
        judge: /(?:judge|justice|magistrate|(?:the\s+)?hon(?:orable|ourable)?\.?)\s+([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)/i,
    },

    // Correspondence specific
    correspondence: {
        from: /(?:from|sender):?\s*([A-Za-z\s.]+?)(?:\n|<|$)/i,
        to: /(?:to|recipient|addressee):?\s*([A-Za-z\s.,;]+?)(?:\n|cc:|bcc:|$)/i,
        subject: /(?:subject|re):?\s*(.+?)(?:\n|$)/i,
    },

    // Governing law/jurisdiction
    governing_law: /(?:governed\s+by|construed\s+(?:in\s+accordance\s+with|under))\s+(?:the\s+laws\s+of\s+)?(?:the\s+)?([A-Z][A-Za-z\s]+?)(?:\.|,|\s+and)/i,
    jurisdiction: /(?:jurisdiction|venue)\s+(?:of|in|shall\s+be)\s+(?:the\s+)?([A-Z][A-Za-z\s,]+?)(?:\.|$)/i,

    // Term/duration
    term: /(?:term|duration|period)(?:\s+(?:of|is)|[^.]{0,40}shall\s+be)\s+(\d+)\s+(day|week|month|year)s?/i,
    notice_period: /(\d+)\s+(?:days?|business\s+days?)\s+(?:prior\s+)?(?:written\s+)?notice/i,
};

/**
 * Parse a date string to ISO format
 */
function parseDate(raw: string): string | undefined {
    if (!raw) return undefined;

    const trimmed = raw.trim();

    // Try direct parsing
    let date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
        return date.toISOString();
    }

    // Try MM/DD/YYYY or DD/MM/YYYY
    const slash_match = trimmed.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (slash_match) {
        const [, a, b, year_raw] = slash_match;
        const year = year_raw.length === 2 ? (parseInt(year_raw) > 50 ? "19" : "20") + year_raw : year_raw;
        // Assume MM/DD/YYYY (US format)
        date = new Date(`${year}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`);
        if (!isNaN(date.getTime())) return date.toISOString();
    }

    return undefined;
}

/**
 * Parse a currency amount
 */
function parseCurrency(raw: string): { amount: number; currency: string } | undefined {
    const match = raw.match(PATTERNS.amount_with_currency);
    if (!match) return undefined;

    const currency = match[1] || match[3] || "USD";
    const amount_str = match[2]?.replace(/,/g, "");
    const amount = parseFloat(amount_str);

    if (isNaN(amount)) return undefined;

    return { amount, currency };
}

/**
 * Detect document type from content
 */
export function detectDocumentType(text: string): DocumentType {
    const sample = text.slice(0, 4000).toLowerCase();

    // Check patterns in order of specificity
    if (PATTERNS.doc_type.invoice.test(sample)) return "invoice";
    if (PATTERNS.doc_type.legal_filing.test(sample)) return "legal_filing";
    if (PATTERNS.doc_type.correspondence.test(sample)) return "correspondence";
    if (PATTERNS.doc_type.agreement.test(sample)) return "agreement";
    if (PATTERNS.doc_type.contract.test(sample)) return "contract";
    if (PATTERNS.doc_type.policy.test(sample)) return "policy";
    if (PATTERNS.doc_type.memo.test(sample)) return "memo";
    if (PATTERNS.doc_type.report.test(sample)) return "report";

    return "unknown";
}

/**
 * Extract base metadata common to all document types
 */
function extractBaseMetadata(text: string): Partial<BaseMetadata> {
    const metadata: Partial<BaseMetadata> = {};

    metadata.word_count = text.split(/\s+/).filter(w => w.length > 0).length;
    metadata.doc_type = detectDocumentType(text);

    // Try to extract title from first line or header
    const first_line = text.split(/\n/)[0]?.trim();
    if (first_line && first_line.length < 200 && first_line.length > 3) {
        // If it looks like a title (short, not a sentence, all caps or starts with uppercase)
        if ((!first_line.endsWith(".") && first_line === first_line.toUpperCase()) || /^[A-Z]/.test(first_line)) {
            metadata.title = first_line;
        }
    }

    return metadata;
}

/**
 * Extract agreement/contract metadata
 */
function extractAgreementMetadata(text: string): Partial<AgreementMetadata> {
    const base = extractBaseMetadata(text);
    const metadata: Partial<AgreementMetadata> = { ...base };
    const sample = text.slice(0, 10000);

    // Parties
    const between = sample.match(PATTERNS.parties.between);
    if (between) {
        metadata.parties = [between[1].trim(), between[2].trim()];
    }

    // Dates
    const effective = sample.match(PATTERNS.dates.effective);
    if (effective) metadata.effective_date = parseDate(effective[1]);

    const expiration = sample.match(PATTERNS.dates.expiration);
    if (expiration) metadata.expiration_date = parseDate(expiration[1]);

    const signing = sample.match(PATTERNS.dates.signing);
    if (signing) metadata.signing_date = parseDate(signing[1]);

    // Governing law
    const law = sample.match(PATTERNS.governing_law);
    if (law) metadata.governing_law = law[1].trim();

    // Jurisdiction
    const jurisdiction = sample.match(PATTERNS.jurisdiction);
    if (jurisdiction) metadata.jurisdiction = jurisdiction[1].trim();

    // Contract value (look for total/consideration amounts)
    const amounts: { amount: number; currency: string }[] = [];
    let match;
    PATTERNS.currency.lastIndex = 0;
    while ((match = PATTERNS.currency.exec(sample)) !== null) {
        const parsed = parseCurrency(match[0]);
        if (parsed && parsed.amount > 100) {  // Filter out small amounts
            amounts.push(parsed);
        }
    }
    if (amounts.length > 0) {
        // Use the largest amount as contract value
        amounts.sort((a, b) => b.amount - a.amount);
        metadata.contract_value = amounts[0];
    }

    // Term length
    const term = sample.match(PATTERNS.term);
    if (term) metadata.term_length = `${term[1]} ${term[2]}s`;

    // Termination notice
    const notice = sample.match(PATTERNS.notice_period);
    if (notice) metadata.termination_notice_days = parseInt(notice[1], 10);

    return metadata;
}

/**
 * Extract invoice metadata
 */
function extractInvoiceMetadata(text: string): Partial<InvoiceMetadata> {
    const base = extractBaseMetadata(text);
    const metadata: Partial<InvoiceMetadata> = { ...base, doc_type: "invoice" };

    // Invoice number
    const inv_num = text.match(PATTERNS.invoice.number);
    if (inv_num) metadata.invoice_number = inv_num[1];

    // Invoice date
    const inv_date = text.match(PATTERNS.dates.general);
    if (inv_date) metadata.invoice_date = parseDate(inv_date[1]);

    // Due date
    const due_date = text.match(PATTERNS.invoice.due_date);
    if (due_date) metadata.due_date = parseDate(due_date[1]);

    // Total amount (find largest amount)
    const amounts: { amount: number; currency: string }[] = [];
    let match;
    PATTERNS.currency.lastIndex = 0;
    while ((match = PATTERNS.currency.exec(text)) !== null) {
        const parsed = parseCurrency(match[0]);
        if (parsed) amounts.push(parsed);
    }
    if (amounts.length > 0) {
        amounts.sort((a, b) => b.amount - a.amount);
        metadata.total_amount = amounts[0];
    }

    return metadata;
}

/**
 * Extract legal filing metadata
 */
function extractLegalFilingMetadata(text: string): Partial<LegalFilingMetadata> {
    const base = extractBaseMetadata(text);
    const metadata: Partial<LegalFilingMetadata> = { ...base, doc_type: "legal_filing" };

    // Case number
    const case_num = text.match(PATTERNS.legal.case_number);
    if (case_num) metadata.case_number = case_num[1].trim();

    // Court
    const court = text.match(PATTERNS.legal.court);
    if (court) metadata.court = court[1].trim();

    // Judge
    const judge = text.match(PATTERNS.legal.judge);
    if (judge) metadata.judge = judge[1].trim();

    // Filing date - look for "Filed:" specifically first
    const filed_match = text.match(/filed:?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    if (filed_match) {
        metadata.filing_date = parseDate(filed_match[1]);
    } else {
        const filing_date = text.match(PATTERNS.dates.general);
        if (filing_date) metadata.filing_date = parseDate(filing_date[1]);
    }

    return metadata;
}

/**
 * Extract correspondence metadata
 */
function extractCorrespondenceMetadata(text: string): Partial<CorrespondenceMetadata> {
    const base = extractBaseMetadata(text);
    const metadata: Partial<CorrespondenceMetadata> = { ...base, doc_type: "correspondence" };

    // From
    const from = text.match(PATTERNS.correspondence.from);
    if (from) metadata.from = from[1].trim();

    // To
    const to = text.match(PATTERNS.correspondence.to);
    if (to) {
        metadata.to = to[1].split(/[,;]/).map(s => s.trim()).filter(Boolean);
    }

    // Subject
    const subject = text.match(PATTERNS.correspondence.subject);
    if (subject) metadata.subject = subject[1].trim();

    // Date
    const date = text.match(PATTERNS.dates.general);
    if (date) metadata.date = parseDate(date[1]);

    // Is reply (check for "Re:" in subject or at line start)
    metadata.is_reply = /(?:^|\s|:)re:/im.test(text);

    return metadata;
}

/**
 * Extract generic metadata (for unknown document types)
 */
function extractGenericMetadata(text: string): Partial<GenericMetadata> {
    const base = extractBaseMetadata(text);
    const metadata: Partial<GenericMetadata> = { ...base };

    // Extract section headers
    const section_pattern = /^(?:#{1,3}\s+)?([A-Z][A-Z\s]{2,50})$/gm;
    const sections: string[] = [];
    let match;
    while ((match = section_pattern.exec(text)) !== null && sections.length < 20) {
        sections.push(match[1].trim());
    }
    if (sections.length > 0) metadata.sections = sections;

    return metadata;
}

/**
 * Extract structured metadata from text
 */
export function extractStructuredMetadata(
    text: string,
    doc_type?: DocumentType,
): { metadata: StructuredMetadata; validation_errors: string[] } {
    // Detect type if not provided
    const detected_type = doc_type || detectDocumentType(text);

    let raw_metadata: Partial<StructuredMetadata>;
    let schema: z.ZodSchema;

    // Extract based on document type
    switch (detected_type) {
        case "agreement":
        case "contract":
            raw_metadata = extractAgreementMetadata(text);
            raw_metadata.doc_type = detected_type;
            schema = AgreementMetadataSchema.partial();
            break;

        case "invoice":
            raw_metadata = extractInvoiceMetadata(text);
            schema = InvoiceMetadataSchema.partial();
            break;

        case "legal_filing":
            raw_metadata = extractLegalFilingMetadata(text);
            schema = LegalFilingMetadataSchema.partial();
            break;

        case "correspondence":
            raw_metadata = extractCorrespondenceMetadata(text);
            schema = CorrespondenceMetadataSchema.partial();
            break;

        default:
            raw_metadata = extractGenericMetadata(text);
            schema = GenericMetadataSchema.partial();
    }

    // Validate with zod
    const result = schema.safeParse(raw_metadata);

    if (result.success) {
        return {
            metadata: result.data as StructuredMetadata,
            validation_errors: [],
        };
    }

    // Return raw metadata with validation errors
    return {
        metadata: raw_metadata as StructuredMetadata,
        validation_errors: result.error.errors.map(e => `${e.path.join(".")}: ${e.message}`),
    };
}

/**
 * Validate existing metadata against schema
 */
export function validateMetadata(
    metadata: Record<string, unknown>,
    doc_type?: DocumentType,
): { valid: boolean; errors: string[] } {
    const type = (doc_type || metadata.doc_type || "unknown") as DocumentType;

    let schema: z.ZodSchema;

    switch (type) {
        case "agreement":
        case "contract":
            schema = AgreementMetadataSchema.partial();
            break;
        case "invoice":
            schema = InvoiceMetadataSchema.partial();
            break;
        case "legal_filing":
            schema = LegalFilingMetadataSchema.partial();
            break;
        case "correspondence":
            schema = CorrespondenceMetadataSchema.partial();
            break;
        default:
            schema = GenericMetadataSchema.partial();
    }

    const result = schema.safeParse(metadata);

    return {
        valid: result.success,
        errors: result.success ? [] : result.error.errors.map(e => `${e.path.join(".")}: ${e.message}`),
    };
}

/**
 * Merge extracted metadata with existing metadata (extraction wins on conflicts)
 */
export function mergeMetadata(
    existing: Record<string, unknown>,
    extracted: StructuredMetadata,
): StructuredMetadata {
    const merged = { ...existing };

    // Only add extracted fields if they don't exist or are more complete
    for (const [key, value] of Object.entries(extracted)) {
        if (value !== undefined && value !== null) {
            // Don't overwrite if existing has a value (unless extracted is more detailed)
            if (merged[key] === undefined || merged[key] === null) {
                merged[key] = value;
            } else if (Array.isArray(value) && Array.isArray(merged[key])) {
                // Merge arrays
                merged[key] = [...new Set([...(merged[key] as unknown[]), ...value])];
            }
        }
    }

    return merged as StructuredMetadata;
}
