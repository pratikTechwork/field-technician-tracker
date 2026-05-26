# Excel Dashboard

This is a React + Recoil dashboard for:

- Uploading an Excel or CSV file with file select or drag and drop
- Viewing all sheet columns and row values in an editable table
- Adding new columns and new rows
- Saving the current table rows into a Supabase table

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and set your Supabase project values:

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

3. Run the app:

```bash
npm run dev
```

## Supabase Notes

- Enter your target table name in the dashboard before clicking save.
- The Supabase table should already exist.
- Its columns should match the Excel headers and any new columns you add in the UI.
