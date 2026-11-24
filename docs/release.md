# Release and recovery

The official remote is `https://github.com/kissu06101997-oss/G1-Virtual-Labs.git` and the production branch is `main`. The original Windows working tree is `E:\G1 Virtual Labs website`. Use a development branch, inspect the running site visually, run the tests, and obtain release approval before pushing future changes.

## Candidate source

This repository includes the approved Next.js site, shared glass UI, Three.js logo and atom, public artwork, science adapters, curriculum definitions, eight database migrations, local startup scripts and automated tests. The four retained files in `project-brief` supply the catalogue source and three experiment definitions read by the app, seed tools and tests. The original logo remains available for rollback and its regression test.

The release snapshot excludes obsolete mockups, screenshot and audit archives, local agent tooling, private records, database files and dumps, uploaded test objects, credentials, Vercel links, dependencies and build outputs. Synthetic fixture **code** remains to make local tests reproducible. Seed and reset are restricted to local loopback databases. Legacy identifiers such as `g1-virtua-labs`, `g1_virtua_labs` and `@g1virtualabs.test` preserve compatibility.

## Rebuild

1. Install Node.js LTS, run `npm ci`, and follow [local setup](../SETUP_LOCAL.md).
2. Run `npm run typecheck`, `npm run lint`, and `npm run test:unit`.
3. Install Chromium with `npx playwright install chromium` and install FFmpeg/FFprobe for the media tests.
4. Run `node scripts/test-local-upgrade.mjs` to migrate a fresh embedded database, seed synthetic records, create an optimized build and run the browser tests.

## Vercel and Neon

Link the new project to the official repository after verifying the candidate in Preview. Configure a separate Neon preview branch with isolated test data and verify its endpoint before applying migrations. Use the direct `DATABASE_URL_UNPOOLED` for migration runs and the pooled `DATABASE_URL` for serverless application traffic. Use verified TLS on remote PostgreSQL connections. Record the production recovery point or Neon backup before applying additive migrations. Existing schools and learning records must be preserved.

Set a separate server-only `SESSION_SECRET` per environment and set `APP_ORIGIN` to the intended deployment origin. Set `ALLOW_LOCAL_SYNTHETIC_FIXTURES=false` and `ENABLE_OPTIONAL_TUTOR=false` in Production. Configure [Contact Us alerts](contact-inquiries.md) separately if approved.

Local Creator media uses the embedded development media store. Hosted uploads use a private, environment-specific Vercel Blob store configured through `BLOB_READ_WRITE_TOKEN`. Large uploads go directly from the browser to private storage in resumable parts. The application verifies file length, signature and video or image encoding before marking the file ready, then serves it through permission-checked range requests. Production Creator accounts can be provisioned by an authorized non-synthetic operator. Existing local accounts and unpublished media stay in the local development environment.

## Promotion and rollback

Verify Preview in a clean browser at desktop and mobile widths. Validate the database, media, science workflows, authorization and contact persistence. Fast-forward the tested candidate into `main`, confirm the matching production deployment in Vercel, and check the actual public URL. Record the deployed commit and deployment ID. To roll back the app, restore a known-good Vercel deployment and use a Git revert for source history. Retain additive database migrations and use the recorded Neon recovery point if database recovery is separately required.
