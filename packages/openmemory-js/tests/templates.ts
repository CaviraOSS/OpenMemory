/**
 * Test for template management (D6)
 */
import assert from "node:assert/strict";
import {
    extract_variables,
    validate_variables,
    instantiate_template,
    type Template,
    type TemplateVariable,
} from "../src/core/templates";

function test_variable_extraction() {
    console.log("\n[Test] Variable extraction from template content...");

    const content = `
Dear {{recipient_name}},

This Agreement is made on {{effective_date:date}} between:

1. {{party_a}} ("Party A")
2. {{party_b}} ("Party B")

The contract value is {{amount:number|0}} dollars.

Terms: {{include_standard_terms:boolean|true}}

Selected options: {{options:select}}
    `.trim();

    const variables = extract_variables(content);

    assert.ok(variables.length >= 6, `Should extract at least 6 variables, got ${variables.length}`);

    const names = variables.map(v => v.name);
    assert.ok(names.includes("recipient_name"), "Should extract recipient_name");
    assert.ok(names.includes("effective_date"), "Should extract effective_date");
    assert.ok(names.includes("party_a"), "Should extract party_a");
    assert.ok(names.includes("party_b"), "Should extract party_b");
    assert.ok(names.includes("amount"), "Should extract amount");

    // Check type detection
    const date_var = variables.find(v => v.name === "effective_date");
    assert.equal(date_var?.type, "date", "Should detect date type");

    const num_var = variables.find(v => v.name === "amount");
    assert.equal(num_var?.type, "number", "Should detect number type");

    // Check default values
    assert.equal(num_var?.default_value, "0", "Should extract default value");

    console.log(` -> Extracted ${variables.length} variables`);
    variables.forEach(v => console.log(`    - ${v.name}: ${v.type}${v.default_value ? ` = ${v.default_value}` : ""}`));
    console.log(" -> PASS: Variable extraction works");
}

function test_variable_validation() {
    console.log("\n[Test] Variable validation...");

    const template: Template = {
        id: "test-1",
        name: "Test Template",
        category: "test",
        content: "{{name}} {{amount:number}} {{date:date}}",
        variables: [
            { name: "name", type: "string", required: true },
            { name: "amount", type: "number", required: true },
            { name: "date", type: "date", required: false },
            { name: "choice", type: "select", required: true, options: ["A", "B", "C"] },
        ],
        tags: [],
        version: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
    };

    // Valid input
    const valid_result = validate_variables(template, {
        name: "Test",
        amount: 100,
        date: "2026-01-01",
        choice: "A",
    });
    assert.ok(valid_result.valid, "Should validate correct input");
    assert.equal(valid_result.errors.length, 0, "Should have no errors");

    // Missing required
    const missing_result = validate_variables(template, {
        amount: 100,
        choice: "A",
    });
    assert.ok(!missing_result.valid, "Should reject missing required field");
    assert.ok(missing_result.errors.some(e => e.includes("name")), "Should report missing name");

    // Invalid type
    const type_result = validate_variables(template, {
        name: "Test",
        amount: "not-a-number",
        choice: "A",
    });
    assert.ok(!type_result.valid, "Should reject invalid type");

    // Invalid select option
    const select_result = validate_variables(template, {
        name: "Test",
        amount: 100,
        choice: "D",  // Not in options
    });
    assert.ok(!select_result.valid, "Should reject invalid select option");

    console.log(` -> Valid input: ${valid_result.valid}`);
    console.log(` -> Missing required: ${missing_result.errors.length} errors`);
    console.log(` -> Invalid type: ${type_result.errors.length} errors`);
    console.log(` -> Invalid select: ${select_result.errors.length} errors`);
    console.log(" -> PASS: Variable validation works");
}

function test_template_instantiation() {
    console.log("\n[Test] Template instantiation...");

    const template: Template = {
        id: "test-2",
        name: "Service Agreement",
        category: "agreements",
        content: `SERVICE AGREEMENT

This Agreement is entered into on {{effective_date:date}} between:

1. {{provider_name}} ("Provider")
2. {{client_name}} ("Client")

SERVICES
The Provider shall provide {{service_description}} to the Client.

COMPENSATION
The Client shall pay {{amount:number}} {{currency|USD}} for services rendered.

TERM
This Agreement is effective for {{term_months:number|12}} months.

Signed: {{signed:boolean|false}}`,
        variables: [
            { name: "effective_date", type: "date", required: true },
            { name: "provider_name", type: "string", required: true },
            { name: "client_name", type: "string", required: true },
            { name: "service_description", type: "string", required: true },
            { name: "amount", type: "number", required: true },
            { name: "currency", type: "string", required: false, default_value: "USD" },
            { name: "term_months", type: "number", required: false, default_value: "12" },
            { name: "signed", type: "boolean", required: false, default_value: "false" },
        ],
        tags: ["agreement", "service"],
        version: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
    };

    const instance = instantiate_template(template, {
        effective_date: "2026-01-15",
        provider_name: "Acme Corp",
        client_name: "Beta LLC",
        service_description: "software development services",
        amount: 50000,
        signed: true,
    });

    assert.equal(instance.template_id, template.id, "Should reference template");
    assert.ok(instance.content.includes("Acme Corp"), "Should substitute provider_name");
    assert.ok(instance.content.includes("Beta LLC"), "Should substitute client_name");
    assert.ok(instance.content.includes("50000"), "Should substitute amount");
    assert.ok(instance.content.includes("USD"), "Should use default currency");
    assert.ok(instance.content.includes("12"), "Should use default term_months");
    assert.ok(instance.content.includes("Yes"), "Should format boolean as Yes");

    console.log(` -> Template: ${template.name}`);
    console.log(` -> Output length: ${instance.content.length} chars`);
    console.log(` -> Sample: ${instance.content.substring(0, 100)}...`);
    console.log(" -> PASS: Template instantiation works");
}

function test_date_formatting() {
    console.log("\n[Test] Date formatting in templates...");

    const template: Template = {
        id: "test-3",
        name: "Date Test",
        category: "test",
        content: "Date: {{event_date:date}}",
        variables: [
            { name: "event_date", type: "date", required: true },
        ],
        tags: [],
        version: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
    };

    // ISO format
    const iso_instance = instantiate_template(template, {
        event_date: "2026-03-15T10:30:00Z",
    });
    assert.ok(iso_instance.content.includes("2026-03-15"), "Should format ISO date");

    // Date string (may have timezone variations)
    const str_instance = instantiate_template(template, {
        event_date: "March 15, 2026",
    });
    assert.ok(str_instance.content.includes("2026-03"), "Should parse and format date string");

    console.log(` -> ISO date: ${iso_instance.content}`);
    console.log(` -> String date: ${str_instance.content}`);
    console.log(" -> PASS: Date formatting works");
}

function test_list_variables() {
    console.log("\n[Test] List variable handling...");

    const template: Template = {
        id: "test-4",
        name: "List Test",
        category: "test",
        content: "Attendees: {{attendees:list}}",
        variables: [
            { name: "attendees", type: "list", required: true },
        ],
        tags: [],
        version: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
    };

    const instance = instantiate_template(template, {
        attendees: ["Alice", "Bob", "Charlie"],
    });

    assert.ok(instance.content.includes("Alice, Bob, Charlie"), "Should join list items");

    // Validation
    const valid = validate_variables(template, { attendees: ["a", "b"] });
    assert.ok(valid.valid, "Should accept array");

    const invalid = validate_variables(template, { attendees: "not-an-array" });
    assert.ok(!invalid.valid, "Should reject non-array");

    console.log(` -> List output: ${instance.content}`);
    console.log(" -> PASS: List variable handling works");
}

function test_nested_variables() {
    console.log("\n[Test] Multiple occurrences of same variable...");

    const template: Template = {
        id: "test-5",
        name: "Multiple Reference",
        category: "test",
        content: `
Dear {{client_name}},

This letter confirms that {{client_name}} has agreed to the terms.

Signed by {{client_name}} on {{date:date}}.
        `.trim(),
        variables: [
            { name: "client_name", type: "string", required: true },
            { name: "date", type: "date", required: true },
        ],
        tags: [],
        version: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
    };

    const instance = instantiate_template(template, {
        client_name: "John Smith",
        date: "2026-02-01",
    });

    const count = (instance.content.match(/John Smith/g) || []).length;
    assert.equal(count, 3, "Should replace all occurrences");

    console.log(` -> 'John Smith' appears ${count} times`);
    console.log(" -> PASS: Multiple occurrences handled");
}

async function run_all() {
    try {
        test_variable_extraction();
        test_variable_validation();
        test_template_instantiation();
        test_date_formatting();
        test_list_variables();
        test_nested_variables();

        console.log("\n[TEMPLATE TESTS] ALL PASSED ✓");
        process.exit(0);
    } catch (e) {
        console.error("\n[TEMPLATE TESTS] FAILED:", e);
        process.exit(1);
    }
}

run_all();
