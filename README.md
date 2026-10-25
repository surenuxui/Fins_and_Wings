# Fins & Wings storefront

A lightweight Vite/React static storefront. There is no database, checkout, or admin login.

## Edit shop content

**Non-coders: read `HOW_TO_EDIT.md`.** Summary: products and categories are spreadsheets (`public/data/*.csv`), words are in `site-settings.json`, delivery rules and shop coordinates are in `delivery-config.json`, photos go in the folders under `public/images/`.

## Publish

Run `npm run build` (or `pnpm build`) and upload the generated `dist/` folder to any static host. JSON edits only appear publicly after the changed files are rebuilt/uploaded to that host.

WhatsApp buttons and the enquiry form create a prefilled message in the customer’s browser. Details are not stored or sent to a server, and the customer must press Send in WhatsApp.
