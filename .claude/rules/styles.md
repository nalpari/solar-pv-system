---
globs:
  - "src/app/globals.css"
  - "src/app/**/*.css"
  - "src/app/components/**/*.tsx"
---

# Styling Rules

- CSS custom properties defined in `globals.css` (e.g., `--bg-primary`, `--text-primary`, `--accent-blue`)
- Components use **inline styles with CSS variables** — not Tailwind utility classes
- Tailwind CSS v4 is installed (`@tailwindcss/postcss`) but custom properties are the primary styling mechanism
