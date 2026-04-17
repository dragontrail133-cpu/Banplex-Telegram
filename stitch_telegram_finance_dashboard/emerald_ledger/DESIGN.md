# Design System Strategy: The Architectural Ledger

## 1. Overview & Creative North Star
**Creative North Star: "The Financial Atelier"**
This design system moves away from the sterile, "SaaS-standard" look and toward the feel of a high-end architectural firm or a boutique private bank. The goal is "Editorial Precision"—using generous whitespace, intentional asymmetry, and tonal depth to convey institutional trust and modern sophistication.

Instead of a rigid grid of boxes, we view the UI as a series of **weighted surfaces**. By utilizing the deep teal (#065f46) as a grounding anchor against off-white backgrounds, we create a high-contrast environment that feels authoritative yet breathable. We reject "cheap" UI patterns—like thin grey borders—in favor of structural depth created through color shifts and soft layering.

---

## 2. Colors & Surface Logic
The palette is rooted in a deep, botanical teal and a crisp off-white, creating a professional and "expensive" atmosphere.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to section off content. Boundaries must be defined solely through background color shifts or tonal transitions. 
- Use `surface-container-low` (#f3f4f5) for the main page body.
- Use `surface-container-lowest` (#ffffff) for primary content cards to create a "lift" without a border.
- Use `surface-container-high` (#e7e8e9) for secondary sidebar or utility areas.

### The "Glass & Gradient" Rule
To elevate CTAs and Hero sections:
- **Primary CTAs:** Use a subtle linear gradient from `primary` (#004532) to `primary_container` (#065f46) at a 135-degree angle. This adds "soul" and prevents the flat-color fatigue of standard apps.
- **Floating Overlays:** Use `surface_container_lowest` with an 80% opacity and a 20px backdrop-blur to create a "frosted glass" effect for navigation bars or modals.

### Core Token Usage
- **Primary Surface:** `primary_container` (#065f46) is our signature. Use this for high-impact cards (e.g., Total Balance, Portfolio Summary).
- **Text:** Always use `on_surface` (#191c1d) for body text to ensure maximum legibility against the off-white background.
- **Alerts:** Use `error` (#ba1a1a) for destructive actions and `error_container` (#ffdad6) for subtle background warnings.

---

## 3. Typography: Editorial Authority
We use **Manrope** for its geometric clarity and modern professional tone.

- **Display Scale:** Use `display-md` (2.75rem) for major financial milestones. Apply a negative letter-spacing of `-0.02em` to give it a tight, editorial feel.
- **Headline vs. Body:** Headlines should be Bold (700 weight), while body text remains Regular (400) or Medium (500).
- **The "Small Label" Rule:** Use `label-md` (0.75rem) in All-Caps with `+0.05em` letter spacing for metadata (e.g., "TRANSACTION DATE"). This creates a rhythmic contrast between data and labels.

---

## 4. Elevation & Depth
Depth is achieved through **Tonal Layering**, mimicking the way fine paper stacks on a desk.

- **The Layering Principle:** Place a card using `surface-container-lowest` on top of a background using `surface-container-low`. The 1-2% shift in brightness is enough for the human eye to perceive hierarchy without needing a border.
- **Ambient Shadows:** Only use shadows for "active" floating elements (Modals, Popovers). Use a multi-layered shadow:
  - `box-shadow: 0 4px 20px rgba(25, 28, 29, 0.04), 0 12px 40px rgba(25, 28, 29, 0.08);`
  - This mimics natural, ambient light rather than a "drop shadow."
- **Ghost Border Fallback:** If a container sits on a background of the same color, use `outline_variant` at **15% opacity**. Never use a 100% opaque border.

---

## 5. Components & Interactions

### Buttons
- **Primary:** Gradient (`primary` to `primary_container`), `xl` (1.5rem) rounded corners, white text.
- **Secondary:** `surface_container_high` background with `on_surface` text. No border.
- **Tertiary/Ghost:** No background. Use `on_primary_fixed_variant` for text.

### Cards (The "Ledger Card")
- **Standard Card:** `xl` (1.5rem) or `lg` (1rem) corner radius. Background: `surface_container_lowest`.
- **Signature Card:** Background: `primary_container` (#065f46). Text: `on_primary`. Use this sparingly for the "Hero" data point of the screen.

### Input Fields
- **Styling:** Soft-grey background (`surface_container_low`) instead of a white box with a border.
- **Focus State:** 2px solid `primary` (#004532) but only on the bottom edge (the "Underline Focus") to maintain a sleek, financial-ledger aesthetic.

### Data Lists
- **Rule:** Forbid the use of divider lines.
- **Execution:** Use `body-md` for the title and `label-md` for the subtitle. Use vertical padding (16px) to create separation. High-contrast text on the light background provides all the "lines" the eye needs.

---

## 6. Do's and Don'ts

### Do:
- **Do** use `xl` (24px) corners for large containers and `md` (12px) for internal elements like buttons or tags.
- **Do** use Lucide icons with a "Thin" or "Light" stroke weight (1.5px) to maintain the sophisticated look.
- **Do** embrace "Asymmetric Breathing Room." Give more padding to the top of a section (e.g., 64px) than the bottom (e.g., 32px) to create a sense of movement.

### Don't:
- **Don't** use pure black (#000000). Use `on_surface` (#191c1d).
- **Don't** use standard 4px or 8px rounded corners. It feels "Bootstrap" and cheap. Stick to the `xl` (24px) or `lg` (16px) scale.
- **Don't** use bright, saturated red for errors. Use the sophisticated `error` (#ba1a1a) which has a deeper, more professional "soft red" tone.