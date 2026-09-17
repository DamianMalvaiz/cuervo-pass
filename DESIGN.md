---
name: Cuervo Pass
description: App móvil para encontrar departamento y roomies compatibles cerca de tu universidad
colors:
  primary: "#208AEF"
  whatsapp-green: "#25D366"
  success-green: "#1a9d5c"
  destructive-red: "#d92d20"
  neutral-surface: "#E0E1E6"
  text-secondary: "#60646C"
  text-secondary-dark: "#B0B4BA"
  link-primary: "#3c87f7"
  background-light: "#ffffff"
  background-dark: "#000000"
  surface-element-light: "#F0F0F3"
  surface-element-dark: "#212225"
  surface-selected-dark: "#2E3135"
typography:
  title:
    fontFamily: "system-ui, -apple-system, Roboto"
    fontSize: "48px"
    fontWeight: 600
    lineHeight: "52px"
  subtitle:
    fontFamily: "system-ui, -apple-system, Roboto"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: "44px"
  body:
    fontFamily: "system-ui, -apple-system, Roboto"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: "24px"
  small:
    fontFamily: "system-ui, -apple-system, Roboto"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
  smallBold:
    fontFamily: "system-ui, -apple-system, Roboto"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: "20px"
  code:
    fontFamily: "ui-monospace, SF Mono, Roboto Mono, monospace"
    fontSize: "12px"
    fontWeight: 500
rounded:
  sm: "4px"
  md: "8px"
  lg: "16px"
  full: "9999px"
spacing:
  half: "2px"
  one: "4px"
  two: "8px"
  three: "16px"
  four: "24px"
  five: "32px"
  six: "64px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "16px"
  button-whatsapp:
    backgroundColor: "{colors.whatsapp-green}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "16px"
  button-destructive:
    backgroundColor: "{colors.destructive-red}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "16px"
  input-text:
    backgroundColor: "transparent"
    textColor: "#000000"
    rounded: "{rounded.md}"
    padding: "16px"
---

# Design System: Cuervo Pass

## Overview

**Creative North Star: "The Reliable Move-In Companion"**

Cuervo Pass exists for the exact moment a student decides on housing they cannot see in person. The interface earns trust the way a good moving company does: nothing flashy, nothing that calls attention to itself, everything legible, predictable, and clearly working. This is an **Operate**-mode product — task completion (find, publish, contact, confirm) always outranks expression. Right now the system is deliberately plain: one accent color, system typography, no shadows, no illustration, no custom iconography. That plainness is currently more accident than decision — it is the byproduct of building screen-by-screen against a 12-week deadline (see PRODUCT.md) rather than a chosen aesthetic. This file documents what exists today so future screens stay consistent with it; treat the flatness as a floor to build on, not a philosophy to defend.

One color carries almost the entire interface: a single utility blue for every primary action and link. WhatsApp's brand green is the one deliberate exception — contact buttons borrow it because the destination literally is WhatsApp, and a familiar green reduces hesitation to tap. Red and a muted green mark destructive/negative and confirmatory/positive actions respectively, used sparingly and only for actions with real consequences (deactivate a listing, reactivate it, cancel a session).

**Key Characteristics:**
- One primary accent (`#208AEF`), used for calls-to-action and links only — never decoratively.
- Flat everywhere: no shadows, no gradients, no elevation system yet.
- System typography only (no custom or brand typeface has been chosen).
- Every screen uses the same 8px spacing/radius grid; nothing is hand-tuned per screen.

## Colors

The palette is functional rather than expressive: one accent, one destination-brand exception (WhatsApp), two state colors, and a small neutral scale reused for every card, placeholder, and secondary text role.

### Primary
- **Utility Blue** (`#208AEF`): every primary button, the login/register CTA, active-state text ("Cambiar foto", "Editar", "+ Nueva publicación"), and the splash screen background. Used nowhere decoratively — its presence always means "you can act here."

### Secondary
- **WhatsApp Green** (`#25D366`): exclusively the "Contactar por WhatsApp" button. Borrowed intentionally from WhatsApp's own brand color so the action reads as "this opens WhatsApp" before the user even reads the label.

### Tertiary
- **Confirm Green** (`#1a9d5c`): the "Reactivar" action text — the one clearly positive, reversing-a-negative action in the app. Distinct from WhatsApp Green so the two never compete for the same meaning.
- **Alert Red** (`#d92d20`): destructive or negative actions and all inline validation errors — "Cerrar sesión", "Desactivar", "Reportar publicación", every Zod error message.

### Neutral
- **Placeholder Gray** (`#E0E1E6`): empty-state fills — avatars with no photo yet, listing thumbnails with no photo, the "add photo" tile.
- **Secondary Text** (`#60646C` light / `#B0B4BA` dark): captions, hints, the "Inactiva" tag, distances and secondary metadata under a title.
- **Element Surface** (`#F0F0F3` light / `#212225` dark): the raised background block behind grouped content (currently defined in the base theme but not yet applied anywhere — see Do's and Don'ts).
- **Selected Surface** (`#2E3135`, dark only): defined in the base theme, not yet consumed by any screen.
- **Borders** (`#ccc`, inline, not yet tokenized): every text input's 1px border. Should be promoted into the token set the next time inputs are touched.

### Named Rules
**The One Accent Rule.** `#208AEF` is the only color allowed to mean "primary action." If a second blue-ish accent shows up anywhere, it is a mistake, not a variant.

## Typography

**Body Font:** System default (San Francisco on iOS, Roboto on Android) — no custom typeface has been loaded or chosen yet.
**Label/Mono Font:** System monospace, used once (the `code` style), currently unused in any shipped screen.

**Character:** Entirely system-native today; the pairing has no personality of its own beyond "whatever the OS ships." That is acceptable for an Operate surface but is the single biggest opportunity for the app to develop a visual identity without touching layout.

### Hierarchy
- **Title** (600, 48px, 52px line-height): screen-level headers only — "Cuervo Pass" on login, "Crear cuenta", "Mi perfil", "Nueva publicación". One per screen, always at the top.
- **Subtitle** (600, 32px, 44px line-height): defined in the base theme; not yet used by any built screen.
- **Body / default** (500, 16px, 24px line-height): all standard UI text — form field values, button labels via `smallBold`-adjacent contexts, paragraph text.
- **Small** (500, 14px, 20px line-height): every secondary line — hints under a title, TODO placeholders, empty-state copy, distance/metadata under a listing price.
- **Small Bold** (700, 14px, 20px line-height): the one emphasis style in the system — currently only the price line on `TarjetaPublicacion` ("$2,800/mes") and usernames on `TarjetaRooming`.

### Named Rules
**The Two-Weight Rule.** The entire app uses exactly two font weights that matter — 500 (default) and 600/700 (title and the one bold emphasis style). A third weight anywhere is unintentional drift.

## Layout

Every screen is a single-column, top-padded stack (`Spacing.three` = 16px on most screens, `Spacing.four` = 24px on forms) with no grid system — this is a phone-first, one-column product; no tablet or multi-column layout has been designed. Lists (`FlatList`/`ScrollView`) run full-width with `Spacing.two`–`Spacing.three` gaps between items. Forms stack fields vertically with `Spacing.two` (8px) between them and no inline/side-by-side fields anywhere, even for short values like price.

## Elevation & Depth

**Flat by default — still true everywhere, including the roomie profile screen.** A first pass on the roomie profile screen (`perfil/[usuarioId].tsx`) tried colored shadows (glow ring on the avatar, a tinted shadow under the CTA) and a staggered spring entrance. Reverted: Android ignores `shadowColor` entirely (only `elevation` applies, always a flat gray/black tint), so the "brand-colored glow" rendered as a plain gray smudge there — inconsistent across platforms and off-brand. The spring/cascade motion was also the only bouncy, multi-step animation anywhere in the app; every other transition (`Collapsible.tsx`) is a single plain `FadeIn`, so the bounce read as inconsistent with the product's own voice, not confident. Depth still comes from flat color blocks only. The one addition worth keeping: a **tinted surface** (`tintedSurface`/`tintedBorder` tokens, a soft wash of the primary blue, not gray) for the compatibility card on that same screen — a flat-color trust cue, not a shadow.

### Named Rules
**The Flat-By-Default Rule.** No `shadow*` or `elevation` prop is used anywhere in the codebase, full stop — the roomie profile screen tried and reverted it (see above). Any future shadow use is still a deliberate new decision requiring a real system update here, not a one-off prop.
**Motion consistency rule (new).** Every entrance/appearance animation in the app is a single plain `FadeIn`, short duration, no spring/bounce, no staggering across sibling elements. A different feel needs a documented reason here first.

## Shapes

Corners are consistently rounded at `Spacing.two` (8px) — buttons, text inputs, photo thumbnails, and the empty-photo placeholder all share this one radius. The single exception is fully circular avatars (profile photo, rooming candidate avatar), which use `width / 2` as their radius rather than a token — a pattern to formalize as `rounded.full` the next time an avatar component is touched. No borders exist except the 1px `#ccc` outline on text inputs.

## Components

### Buttons
- **Shape:** 8px corner radius (`rounded.md`), full-width within their container, 16px internal padding.
- **Primary** (`#208AEF` background, white text, weight 600): every main CTA — "Entrar", "Crear cuenta", "Publicar", "Guardar", "Guardar cambios".
- **WhatsApp** (`#25D366` background, white text): the single-purpose contact action; never reused for anything else.
- **Destructive** (`#d92d20` background or text-only, depending on context): "Cerrar sesión" is a filled destructive button; "Desactivar" and "Reportar publicación" are text-only in the same red — an inconsistency to resolve (see Do's and Don'ts).
- **Ghost / Text-only:** links styled as plain colored text with no background — "¿No tienes cuenta? Regístrate", "Editar", "+ Nueva publicación" (all in Utility Blue), "Reactivar" (Confirm Green).

### Cards / Containers
- **Corner Style:** 8px (`rounded.md`).
- **Background:** transparent container, `neutral-surface` (`#E0E1E6`) only for image placeholders.
- **Shadow Strategy:** none — see Elevation & Depth.
- **Internal Padding:** `Spacing.two` (8px) on list cards (`TarjetaPublicacion`, `TarjetaRooming`).

### Inputs / Fields
- **Style:** 1px `#ccc` border, 8px radius, 16px padding, transparent background.
- **Focus:** no distinct focus treatment defined yet — inputs look identical focused and unfocused. Worth a pass once the app has more form density.
- **Error:** the input itself never changes appearance; a red (`#d92d20`) small-text line appears below it instead.

### Navigation
- Bottom tab bar (5 destinations: Sugerencias, Publicaciones, Roomings, Chats, Perfil) using Expo Router's default `Tabs` styling — no custom icons, colors, or active-state treatment have been applied yet. This is the single largest unstyled surface in the app.

## Do's and Don'ts

### Do:
- **Do** keep Utility Blue (`#208AEF`) as the only color that means "you can act here" — never introduce a second accent hue.
- **Do** use WhatsApp Green (`#25D366`) exclusively for the WhatsApp contact action; it borrows meaning from the destination app and loses that meaning if reused elsewhere.
- **Do** keep every corner radius at 8px (`rounded.md`) unless a component is fully circular (avatars).
- **Do** put validation errors as red small-text below the field, never by recoloring the input border.

### Don't:
- **Don't** add a shadow or `elevation` prop anywhere — it was tried once (roomie profile screen) and reverted for looking inconsistent on Android; use a tinted flat surface (`tintedSurface`/`tintedBorder`) instead when a block needs to stand out.
- **Don't** add a spring, bounce, or staggered multi-element entrance animation — every animation in the app is a single plain `FadeIn` (see Elevation & Depth); a bouncier one was tried and reverted for reading inconsistent with the rest of the product.
- **Don't** treat "Desactivar"/"Reportar" (text-only red) and "Cerrar sesión" (filled red button) as the same component — reconcile which destructive actions are filled vs. text-only before adding a third one.
- **Don't** style the bottom tab bar or any new screen against a generic Material/iOS default without checking this file first — the tab bar is currently unstyled by omission, not by decision, and is the top candidate for the app's next real design pass.
