---
name: Scientific Luxury
colors:
  surface: '#f9f9f7'
  surface-dim: '#dadad8'
  surface-bright: '#f9f9f7'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f4f2'
  surface-container: '#eeeeec'
  surface-container-high: '#e8e8e6'
  surface-container-highest: '#e2e3e1'
  on-surface: '#1a1c1b'
  on-surface-variant: '#444748'
  inverse-surface: '#2f3130'
  inverse-on-surface: '#f1f1ef'
  outline: '#747878'
  outline-variant: '#c4c7c7'
  surface-tint: '#5f5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1c1b1b'
  on-primary-container: '#858383'
  inverse-primary: '#c8c6c5'
  secondary: '#735c00'
  on-secondary: '#ffffff'
  secondary-container: '#fed65b'
  on-secondary-container: '#745c00'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#0a1e26'
  on-tertiary-container: '#738791'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c8c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474646'
  secondary-fixed: '#ffe088'
  secondary-fixed-dim: '#e9c349'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#574500'
  tertiary-fixed: '#d1e6f1'
  tertiary-fixed-dim: '#b5cad4'
  on-tertiary-fixed: '#0a1e26'
  on-tertiary-fixed-variant: '#364952'
  background: '#f9f9f7'
  on-background: '#1a1c1b'
  surface-variant: '#e2e3e1'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 72px
    fontWeight: '300'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '300'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '400'
    lineHeight: '1.3'
    letterSpacing: -0.02em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: -0.01em
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  technical-label:
    fontFamily: Space Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: '1.2'
    letterSpacing: 0.1em
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1440px
  gutter: 24px
  margin-desktop: 80px
  margin-mobile: 24px
  section-gap: 160px
---

## Brand & Style
The design system embodies the intersection of high-science and ultra-luxury. It targets a discerning clientele who values clinical precision as much as aesthetic refinement. The emotional response is one of calm, absolute trust, and exclusivity.

The style is **Molecular Minimalism**: a fusion of the precision found in high-end optics (Leica), the restrained elegance of luxury hospitality (Aman), and the technical purity of premium hardware (Apple). The interface functions like a digital gallery—expansive, quiet, and meticulously ordered. Key characteristics include extreme whitespace, hairline structural elements, and a sophisticated use of transparency to suggest clarity and depth.

## Colors
The palette is dominated by "The Whites"—a tiered system of #FFFFFF, Ivory, and Pearl that creates subtle structural depth without relying on heavy shadows. 

- **Primary & Neutral:** Near Black (#111111) is used exclusively for high-contrast typography and essential iconography. 
- **Accents:** Champagne Gold is reserved for "The Signature"—premium call-to-actions, seal of authenticity markers, or subtle interactive states. Sky Blue provides a clinical, oxygenated breath to technical data or "active" molecular states.
- **Strict Adherence:** Avoid green entirely. Ensure that "Hairline Gray" is the primary method for defining boundaries, maintaining a "sketch-like" precision.

## Typography
The typographic hierarchy relies on dramatic scale contrasts. Large display type should be set with tight tracking and light weights to feel like architectural etchings. 

**Inter** serves as the primary engine for both editorial headlines and functional body copy, providing a neutral yet modern foundation. **Space Mono** is used sparingly for technical data, molecular formulas, and small labels to ground the luxury aesthetic in scientific rigor. All technical labels must be in uppercase with generous letter spacing to evoke the feeling of a laboratory instrument.

## Layout & Spacing
The layout follows a **Fixed-Fluid Hybrid** model. Content is housed within a 1440px max-width container, but decorative elements (like floating molecules or glass blurs) may bleed to the edge of the viewport.

- **Verticality:** Use extreme vertical padding (Section Gaps) to allow the eye to rest, mirroring the spatial experience of a high-end spa or gallery.
- **The 8px Rhythm:** All spacing between components and within cards must be multiples of 8px.
- **Adaptive Rules:** On mobile, margins reduce significantly, but the "Section Gap" must remain relatively high (80px-100px) to preserve the brand's expansive feel.

## Elevation & Depth
Depth is achieved through **Optical Layering** rather than traditional drop shadows.

1.  **Base Layer:** Pure White (#FFFFFF).
2.  **Surface Layer:** Pearl or Ivory containers with 1px Hairline Gray (#ECECEC) borders.
3.  **Glass Layer:** 40% opacity White backgrounds with a 20px backdrop-blur. These represent "suspended" technical interfaces.
4.  **Shadows:** When necessary, use "Ambient Shadows"—extremely soft (30-40px blur), very low opacity (3-5%), and slightly tinted with Sky Blue to create a "floating" effect rather than a "heavy" one.

## Shapes
The shape language is **Technical-Soft**. Primary containers and buttons use a subtle 4px (Soft) radius to maintain a professional, engineered look. Circular shapes are reserved for "Biological" elements: avatars, molecular nodes, and progress indicators. 

Avoid large radii or pill shapes for primary structural components, as they appear too casual. The goal is to look "precision-machined" rather than "molded."

## Components

- **Buttons:** 
  - *Primary:* Solid Near Black, sharp or slightly softened corners, white Inter Medium text. No shadows.
  - *Luxury:* Ghost button with a Hairline Gray border and a Champagne Gold hover state.
- **Technical Chips:** Using Space Mono, these are small, rectangular tags with 1px borders and light Sky Blue backgrounds (10% opacity) used for ingredient data.
- **Glass Cards:** Used for technical specs. Features a 1px white border (inner) and a 1px Hairline Gray border (outer) with a heavy backdrop-blur.
- **Input Fields:** Minimalist underlines or 1px borders. Focused state uses a 1px Champagne Gold border. Labels always use the Technical-Label style.
- **Molecular Scroll:** A custom component where floating 3D/Chrome spheres drift behind content, reacting to the user's scroll speed.
- **Lists:** Clean, horizontal dividers using Hairline Gray. Indicators should be small "+" icons in Gold rather than traditional bullets.