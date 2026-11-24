# Contact inquiries

Update the public founder, address for email, phone and hours in `src/lib/contact.ts`. The email and phone cards use native device handlers. The WhatsApp card links directly to the configured chat number.

## Local operation

The development launcher runs migration `007_contact_inquiries.sql`. The form records validated inquiries in PostgreSQL. Visit `/admin/inquiries` with the existing `operator` role to read them and reply by email. Local synthetic mode seeds `operator@g1virtualabs.test` with the standard synthetic fixture password described in `SETUP_LOCAL.md`. School, district, state, creator and editorial roles cannot read the inbox.

The form accepts only same-origin JSON submissions from `APP_ORIGIN` and checks consent, field lengths, email syntax and a spam honeypot. Shared database limits count requests by trusted Vercel client IP or a shared direct-server bucket, and by email after validation. Rate keys are HMAC-protected. Identical normalized content is recorded once, even with concurrent submissions. These controls apply across app instances. Free-text input is displayed as escaped text in the private inbox.

## Optional email alerts

Without credentials, the form records inquiries and the private inbox is the source of truth. The public confirmation only states that the inquiry was recorded. The inbox distinguishes disabled notifications, provider acceptance and unconfirmed notification attempts.

- Set `APP_ORIGIN` to the exact approved site origin when configuring that environment.
- Set the server-only `CONTACT_RESEND_API_KEY` to an approved, restricted sending key.
- Set `CONTACT_EMAIL_FROM` to a verified Resend sender on an approved domain.
- Assign the current `operator` role to the authorized person who will handle inquiries.

Resend receives a minimal notification with an internal reference and the official recipient. Inquiry content and visitor contact details stay in PostgreSQL. Local synthetic mode always suppresses outbound email. A failed alert leaves the recorded inquiry available in the inbox. Provider acceptance does not establish inbox delivery. [Resend sending API](https://resend.com/docs/api-reference/emails/send-email) · [Vercel request headers](https://vercel.com/docs/headers/request-headers)
