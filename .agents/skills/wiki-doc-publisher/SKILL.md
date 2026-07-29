---
name: wiki-doc-publisher
description: Convert uploaded document files (.docx, .pdf, .xlsx, .txt, .md) into rich, beautifully formatted Wiki 2.0 articles with chapters, tables, typography, and callouts using Codex Wiki CLI and .env.codex.local credentials.
---

# Wiki Document Publisher Skill

Use this skill whenever the user attaches or sends a document file (Word `.docx`, PDF `.pdf`, Excel `.xlsx`, Markdown `.md`, Text `.txt`) and asks to create a Wiki 2.0 article from it.

## Overview
This skill leverages `.env.codex.local` for admin authentication and executes `scripts/wiki-cli.ts` (or direct backend services) to transform documents into full-featured Wiki 2.0 articles without losing context or formatting.

---

## Capabilities & Automated Features
1. **Document Conversion**:
   - Word (`.docx`, `.doc`): Parsed with `mammoth` to convert typography, lists, and tables into HTML.
   - PDF (`.pdf`): Parsed with `pdf-parse` into clean structural sections and paragraphs.
   - Excel (`.xlsx`, `.csv`): Converted with `xlsx` into clean, responsive HTML `<table>` elements.
   - Markdown (`.md`) and Text (`.txt`): Converted into structured HTML with headings and list formatting.

2. **Wiki 2.0 Rich Formatting**:
   - **Chapters & Headings**: Automatically formats section titles with modern heading styles (`<h1>`, `<h2>`, `<h3>`).
   - **Tables**: Wraps tables in clean border styles (`border-collapse border border-border bg-card`).
   - **Callout Cards**: Converts notes and warnings into visual callout boxes:
     - `💡 Примечание`: Indigo callout box.
     - `⚠️ Важно`: Amber callout box.
   - **Section Scope**: Binds articles to target sections in the organization structure.

---

## Workflow Steps

### Step 1: Ensure `.env.codex.local` Exists
Check that `.env.codex.local` contains admin credentials:
```env
WIKI_API_URL=https://wiki-backend-combined.onrender.com/api
WIKI_LOCAL_API_URL=http://localhost:5001/api
WIKI_ADMIN_USERNAME=admin
WIKI_ADMIN_PASSWORD=admin
```

### Step 2: Convert and Publish Document
Run the publisher script from the workspace:
```bash
npx ts-node /Users/sherzad/Wiki\ 2.0/scripts/wiki-cli.ts publish <path-to-document> [--sectionId=<id>] [--title="<title>"]
```

Or execute via backend npm script:
```bash
npm --prefix /Users/sherzad/Wiki\ 2.0/backend run wiki:publish -- <path-to-document> --sectionId=<id>
```

### Step 3: Verify & Report
After publishing, report the created article details to the user:
- Article Title
- Slug URL
- Section Assignment
- Summary of chapters & tables generated
