import type { Config } from "tailwindcss";

/**
 * A colour token from `src/index.css`, wired so Tailwind's `/N` opacity
 * modifiers keep working.
 *
 * The tokens hold plain hexes (`#2d48d2`), which is the format anyone can read
 * and paste into a colour picker — but CSS can't add an alpha to a hex, so
 * `bg-card/80` can't be `hsl(var(--card) / 0.8)` the way it was. `color-mix`
 * against `transparent` does the same job on any colour format.
 *
 * Tailwind calls this with no argument for the plain utility (`bg-card`), and
 * with the modifier for `/N` (`bg-card/80` → `opacityValue: "0.8"`), so a plain
 * utility still compiles to a bare `var(--card)` — only the tinted ones pay for
 * `color-mix`. The legacy `bg-opacity-*` plugins are off (see `corePlugins`
 * below), which is what keeps that true.
 */
const token =
  (name: string) =>
  ({ opacityValue }: { opacityValue?: string } = {}) =>
    opacityValue === undefined
      ? `var(${name})`
      : `color-mix(in srgb, var(${name}) calc(${opacityValue} * 100%), transparent)`;

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        border: token("--border"),
        input: token("--input"),
        ring: token("--ring"),
        background: token("--background"),
        foreground: token("--foreground"),
        primary: {
          DEFAULT: token("--primary"),
          foreground: token("--primary-foreground"),
        },
        secondary: {
          DEFAULT: token("--secondary"),
          foreground: token("--secondary-foreground"),
        },
        destructive: {
          DEFAULT: token("--destructive"),
          foreground: token("--destructive-foreground"),
        },
        muted: {
          DEFAULT: token("--muted"),
          foreground: token("--muted-foreground"),
        },
        accent: {
          DEFAULT: token("--accent"),
          foreground: token("--accent-foreground"),
        },
        popover: {
          DEFAULT: token("--popover"),
          foreground: token("--popover-foreground"),
        },
        card: {
          DEFAULT: token("--card"),
          foreground: token("--card-foreground"),
        },
        warning: {
          DEFAULT: token("--warning"),
          foreground: token("--warning-foreground"),
        },
        grade: {
          a: token("--grade-a"),
          "a-minus": token("--grade-a-minus"),
          b: token("--grade-b"),
          c: token("--grade-c"),
          d: token("--grade-d"),
          f: token("--grade-f"),
        },
        sidebar: {
          DEFAULT: token("--sidebar-background"),
          foreground: token("--sidebar-foreground"),
          primary: token("--sidebar-primary"),
          "primary-foreground": token("--sidebar-primary-foreground"),
          accent: token("--sidebar-accent"),
          "accent-foreground": token("--sidebar-accent-foreground"),
          border: token("--sidebar-border"),
          ring: token("--sidebar-ring"),
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "scale-in": "scale-in 0.15s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
  // Tailwind 2's separate opacity scales, superseded by the `/N` modifier and
  // unused here. Off because they'd wrap *every* colour utility in the
  // `--tw-*-opacity` variable, which for a hex token means routing even a plain
  // `bg-card` through `color-mix`. Use `bg-card/80`, not `bg-card bg-opacity-80`.
  corePlugins: {
    backgroundOpacity: false,
    textOpacity: false,
    borderOpacity: false,
    divideOpacity: false,
    placeholderOpacity: false,
    ringOpacity: false,
  },
} satisfies Config;
