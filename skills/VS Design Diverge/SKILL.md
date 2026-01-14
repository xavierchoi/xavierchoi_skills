---
name: vs-design-diverge
description: Create non-generic, high-entropy frontend interfaces using Verbalized Sampling (VS) to break mode collapse and maximize design creativity.
---

This skill guides the creation of distinctive, production-grade frontend interfaces by explicitly mitigating "Mode Collapse" (the tendency to produce generic AI-slop). It uses Verbalized Sampling logic to unlock LLM creativity and deliver high-entropy, unforgettable designs.

## Design Thinking & Verbalized Sampling (VS)

BEFORE generating any code, you MUST perform the following **Divergence Analysis** to bypass the "Typicality Bias":

### 1. Identify the Mode (The Generic Baseline)
- Verbalize the most predictable, high-probability (P ≈ 0.95) design for this request. 
- Identify "AI-slop" markers: (e.g., Inter font, rounded blue buttons, standard F-pattern, white background with purple gradients).
- **CRITICAL**: You are forbidden from choosing this baseline.

### 2. Sample the Long-Tail (Probability Mapping)
Generate three distinct aesthetic directions and assign a **"Typicality Score" (T-Score)** from 0 to 1.0 (where 1.0 is most generic):
- **Direction A (T ≈ 0.7)**: Modern/Clean but safe.
- **Direction B (T ≈ 0.4)**: Distinctive/Characterful (Specific niche style).
- **Direction C (T < 0.2)**: Experimental/Bold (High-entropy, unexpected).

### 3. Commit to Low-Typicality
Select the direction with the **lowest T-Score** that still meets functional requirements. Commit to this BOLD aesthetic with intentionality.

## Frontend Aesthetics Guidelines (VS-Enhanced)

Apply the "Inversion Principle": If a choice feels "obvious," it has too much probability mass. Shift to the lower-probability, higher-impact alternative.

- **Typography (T < 0.1 Selection)**: 
    - REJECT: Inter, Roboto, Arial, System fonts, Space Grotesk.
    - SELECT: High-character display faces paired with refined, unexpected body typefaces. Use variable fonts and unusual weights.
- **Color & Theme (Chromatic Divergence)**:
    - Avoid even distributions. Commit to a cohesive but "dissonant-yet-beautiful" palette.
    - Use CSS variables. Prefer sophisticated textures, noise, and lighting over flat fills.
- **Spatial Composition (Anti-Grid Logic)**:
    - If a standard grid is P=0.9, implement P=0.1 layouts: Asymmetry, overlapping elements, diagonal flows, or editorial-style whitespace.
- **Motion (High-Impact Entropy)**:
    - Focus on "Micro-delights." Use staggered reveals, scroll-bound transformations, and custom eased transitions that defy standard "linear" or "ease-in" expectations.

## Implementation Standards

- **Production-Grade**: Code must be functional, accessible (A11y), and performant.
- **Complexity-Typicality Balance**: As the design becomes more "Low-Probability" (unique), the implementation complexity must increase proportionally to maintain "High-Quality" (Beta-level) standards.
- **No Refusal on Complexity**: Claude is capable of extraordinary creative work. Do not simplify the vision for the sake of brevity.

## Execution Process

1. **Verbalize Analysis**: State the $P(Generic)$ baseline and your chosen $T < 0.2$ direction.
2. **Define Tone**: Pick an extreme (e.g., Brutalist Raw, Retro-Futuristic, Luxury Refined).
3. **Execute Code**: Implement the working code with meticulous attention to the chosen aesthetic.
4. **Surprise Check**: Final validation—does this look like something an "AI" would typically build? If yes, refactor the most generic element.

**REMEMBER**: The goal is to maximize the "Surprise Score" while maintaining "Production Quality." Break the mold.
---