# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Primary: Mexican university students — especially new-enrollment or out-of-town students — searching for an apartment and/or a compatible roommate near their campus, many of whom must decide sight-unseen because they live far away and can't visit in person before moving. Secondary: independent landlords near campus who want to publish a listing and get contacted directly, without intermediaries. Tertiary: students who already have an apartment and need to replace a roommate who left.

## Product Purpose

Cuervo Pass helps university students find housing and compatible roommates near their campus, replacing disorganized Facebook groups with a matching engine that combines hard filters (budget, distance, pet policy, noise) with AI semantic similarity to rank listings and roommate candidates, plus direct WhatsApp contact. It is a school capstone project ("integradora") graded live by an instructor — success means a complete, reliable, well-explained demo end to end, not commercial adoption metrics.

## Positioning

A two-stage retrieval-then-ranking engine (hard SQL filters first, then pgvector cosine-similarity re-ranking) mirrors real production recommendation systems (Netflix/Spotify-style), rather than a bare "AI search" that can't guarantee budget or distance constraints. Also positioned on a deliberate dual local/cloud AI architecture (embeddings run locally in development, the parsing LLM runs on Claude Haiku from day one) as an engineering trade-off worth explaining, not a limitation to hide.

## Operating Context

Used mainly during move-in season, when a student is choosing housing from another city without having seen it. Landlords publish and manage one or more listings; roommate-seekers post separately and chat in-app. The product is presented live to an instructor on a rehearsed, timed script, with a recorded backup video and a mobile hotspot as fallbacks for connectivity failure.

## Capabilities and Constraints

- Auth via Supabase Auth (email/password); Row Level Security enforced on every table, no exceptions.
- Editable profile with photo and bio — this specifically builds trust for users who can't visit in person before committing.
- CRUD for listings ("publicaciones"): up to 5 photos, WhatsApp deep-link contact, activate/deactivate, edit after publishing.
- Roomie postings + in-app chat via Supabase Realtime — planned, not yet built.
- Two-level suggestion engine: weighted SQL filters (budget, distance, pet/noise match, freshness), then pgvector cosine-similarity re-ranking on top — planned for later in the build; do not pull this earlier than scheduled.
- Free-text profile text is encrypted at rest (pgcrypto); no sensitive key is ever exposed to the client.
- Cost constraint: must run at effectively $0 during development (free tiers only; minimal paid LLM usage).
- Timeline constraint: fixed 12-week academic schedule with features intentionally sequenced (no AI work before its scheduled week) specifically to avoid running out of time before the graded demo.
- Moderation: users can report a listing; repeated reports should eventually auto-hide it (automation not yet built).

## Brand Commitments

Name: **Cuervo Pass** (renamed mid-build from "Cuervo de Paz"). No pre-existing logo or visual identity beyond the name — the visual system is still to be designed and documented, not an inherited constraint.

## Evidence on Hand

No real testimonials, case studies, or press — pre-launch student project. Demo listings and three example profiles are intentionally fabricated and must be preloaded before the live demo; never register real accounts in front of the instructor.

## Product Principles

- Reliability over features: anything that could fail live (network, the AI microservice, Mapbox) must degrade gracefully, never crash or block a flow.
- Follow the 12-week build sequence as written; do not pull later-week work (AI parsing, embeddings) earlier just because it looks more impressive sooner.
- Every security/privacy decision (RLS, encryption, key handling) must be independently verified with two test accounts, not assumed correct.
- Trust-building for remote, sight-unseen users (photo, bio, reporting) matters as much as raw matching accuracy.

## Accessibility & Inclusion

General baseline only: WCAG AA text contrast, 44×44pt minimum touch targets, visible loading states, specific (non-generic) error messages, and respecting the system's font-size scaling. No specific user accessibility requirement has been identified beyond these standards.
