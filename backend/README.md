# Utility Bill Decoder (WTQ Build Track)

Reads K-Electric / LESCO / IESCO bill images, extracts structured data (Level 1) and answers customer questions in plain English (Level 2). Node.js CLI, no server or database.

## Runtime
Node.js 22

## Setup
    cd source
    npm ci
    cp .env.example .env      # Set your actual API_KEY in .env

## Generate the Result CSVs (Scoring Run)
    npm run run:test          # Reads ../test/bills + ../test/csv, writes ../output
    npm run validate

Or run directly via Node:
    node scripts/cli.js --bills ../test/bills --csv ../test/csv --out ../output

## Dev / Testing Run (Training Bills)
    npm run run:dev           # Runs on training bills with built-in sample questions

Or run directly via Node:
    node scripts/cli.js --bills ./train/bills --out ./dev_output --dev

## How It Works
1. **Extraction (Vision):** Gemini reads the bill image and outputs structured JSON (Level 1 fields + usage/billing history).
2. **Normalization:** `models/billModel.js` normalizes values (casts numbers, converts CR credits to negative values, formats dates to ISO, enums types, sets missing/masked fields to null, and strips personal IDs).
3. **Statistical Computation:** `services/statsService.js` computes exact statistics deterministically via code (tax %, averages, unit thresholds, late fee deltas).
4. **Reasoning & Explanation:** Gemini answers all Level 2 questions per bill grounded strictly in bill data and computed stats.
5. **CSV Export:** Files are generated using `csv-stringify`, preserving exact template column names and row ordering.
6. **Reliability & Caching:** Temperature is set to 0. The primary model includes retry logic with automated fallback. Validated responses are cached in `.cache/` to ensure deterministic, reproducible outputs.

## AI Usage
- **Models:** gemini-3.5-flash-lite (primary), gemini-3.1-flash-lite (fallback)
- **APIs / Services:** Google Gemini API (Google AI Studio)
- **Frameworks / Libraries:** @google/genai, sharp, csv-parse, csv-stringify, dotenv
- **OCR / Prebuilt Extractors:** none
- **AI Tools Used to Write Code:** Claude (chat)