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
 *  file  : src/core/i18n/multilingual_embeddings.ts
 *  usage : multilingual embedding provider and deterministic fallback
 */

import { createHash } from 'node:crypto';
import { tokenize } from './multilingual_tokenizer.js';

export type multilingual_embedding_provider = { embed(text: string, language?: string): number[] | Promise<number[]> };

const concepts: Array<[string, string[]]> = [
    ['prefer', ['prefer','preference','likes','पसंद','पसंद है','ఇష్టం','விருப்பம்','পছন্দ','پسند','يفضل','prefiere','préfère','bevorzugt','voorkeur','suosii','喜欢','好み','선호','предпочитает','prefere']],
    ['language', ['language','भाषा','भాష','மொழி','ভাষা','زبان','لغة','idioma','langue','sprache','taal','kieli','语言','言語','언어','язык']],
    ['backend', ['backend','बैकएंड','బ్యాకెండ్','பின்தளம்','ব্যাকএন্ড','بیک اینڈ','خلفية','servidor','backend-entwicklung','后端','バックエンド','백엔드','бэкенд']],
    ['project', ['project','परियोजना','ప్రాజెక్ట్','திட்டம்','প্রকল্প','منصوبہ','مشروع','proyecto','projet','projekt','hanke','项目','プロジェクト','프로젝트','проект','projeto']],
    ['user', ['user','उपयोगकर्ता','వినియోగదారు','பயனர்','ব্যবহারকারী','صارف','مستخدم','usuario','utilisateur','benutzer','gebruiker','käyttäjä','用户','ユーザー','사용자','пользователь']],
    ['typescript', ['typescript','टाइपस्क्रिप्ट','టైప్‌స్క్రిప్ట్','டைப்ஸ்கிரிப்ட்','টাইপস্ক্রিপ্ট','ٹائپ اسکرپٹ','تايب سكريبت']],
];

const canonical_concepts = (text: string): string[] => {
    const lower = text.toLocaleLowerCase();
    const found = concepts.filter(([, variants]) => variants.some((variant) => lower.includes(variant.toLocaleLowerCase()))).map(([concept]) => concept);
    return [...new Set([...found, ...tokenize(text).map((token) => token.value)])];
};

export class deterministic_multilingual_embeddings implements multilingual_embedding_provider {
    constructor(readonly dimension = 8) {}

    embed(text: string): number[] {
        const vector = new Array<number>(this.dimension).fill(0);
        for (const token of canonical_concepts(text)) {
            const digest = createHash('sha256').update(token).digest();
            for (let index = 0; index < this.dimension; index++) vector[index] += (digest[index % digest.length] / 255) * 2 - 1;
        }
        const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
        return norm ? vector.map((value) => value / norm) : vector;
    }
}