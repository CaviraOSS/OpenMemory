export const multilingual_preferences = [
    { language: "hi", text: "मुझे चाय पसंद है" },
    { language: "te", text: "నాకు కాఫీ ఇష్టం" },
    { language: "es", text: "Prefiero TypeScript para backend" },
    { language: "en", text: "I prefer SQLite for local development" },
];

export const multilingual_entities = [
    { canonical: "Narendra Modi", alias: "మోదీ", language: "te", should_merge: true },
    { canonical: "Samar Khan", alias: "ثمر خان", language: "ur", should_merge: false },
];

export const code_switching = [
    { text: "मुझे TypeScript पसंद है", languages: ["hi", "en"] },
    { text: "మనం backend build చేద్దాం", languages: ["te", "en"] },
    { text: "Este proyecto usa SQLite", languages: ["es", "en"] },
];

export const crosslingual_recall_dataset = [
    { memory: "मुझे चाय पसंद है", query: "What drink does the user like?", answer: "tea" },
    { memory: "I prefer TypeScript for backend", query: "बैकएंड के लिए कौन सी भाषा?", answer: "TypeScript" },
    { memory: "నాకు PostgreSQL ఇష్టం", query: "Which database is preferred?", answer: "PostgreSQL" },
];

export const translation_safety = [
    { text: "मुझे चाय पसंद है", translation_allowed: true },
    { text: "secret token abc", translation_allowed: false },
    { text: "private medical note", translation_allowed: false },
];
