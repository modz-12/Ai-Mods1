#!/usr/bin/env python3
"""
MODZ CSS LIB generator.
Generates every src/*.css file, concatenates into dist/modz.css,
and produces a minified dist/modz.min.css.
Also dumps a JSON manifest of every class (for the docs playground JS,
which is fully separate from the library itself).
"""
import re, json, os

ROOT = "."
SRC = os.path.join(ROOT, "src")
DIST = os.path.join(ROOT, "dist")
os.makedirs(SRC, exist_ok=True)
os.makedirs(DIST, exist_ok=True)

manifest = []  # (selector, category)

def add(cat, selector):
    manifest.append((selector, cat))

# ---------------------------------------------------------------------------
# Color palette
# ---------------------------------------------------------------------------
COLORS = {
    "purple":  "#7c3aed",
    "violet":  "#8b5cf6",
    "indigo":  "#6366f1",
    "blue":    "#3b82f6",
    "sky":     "#0ea5e9",
    "cyan":    "#06b6d4",
    "teal":    "#14b8a6",
    "green":   "#22c55e",
    "emerald": "#10b981",
    "lime":    "#84cc16",
    "yellow":  "#eab308",
    "amber":   "#f59e0b",
    "gold":    "#d4af37",
    "orange":  "#f97316",
    "red":     "#ef4444",
    "rose":    "#f43f5e",
    "pink":    "#ec4899",
    "fuchsia": "#d946ef",
    "brown":   "#8b5e34",
    "gray":    "#6b7280",
    "slate":   "#64748b",
}
SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

def shade_factor(shade):
    # 500 = base color. <500 lighten, >500 darken.
    return (500 - shade) / 500.0

def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def rgb_to_hex(rgb):
    return "#%02x%02x%02x" % tuple(max(0, min(255, int(round(c)))) for c in rgb)

def mix(rgb, target, amount):
    return tuple(c + (t - c) * amount for c, t in zip(rgb, target))

def shade_hex(base_hex, shade):
    rgb = hex_to_rgb(base_hex)
    f = shade_factor(shade)
    if f >= 0:
        return rgb_to_hex(mix(rgb, (255, 255, 255), f))
    else:
        return rgb_to_hex(mix(rgb, (0, 0, 0), -f))

# ---------------------------------------------------------------------------
# variables.css
# ---------------------------------------------------------------------------
def gen_variables():
    lines = [":root {", '  --mz-version: "1.0.0";']
    for name, base in COLORS.items():
        for shade in SHADES:
            lines.append(f"  --mz-{name}-{shade}: {shade_hex(base, shade)};")
        lines.append(f"  --mz-{name}: {base};")
    radii = {"none": "0", "xs": "2px", "sm": "4px", "md": "8px", "lg": "12px",
             "xl": "16px", "2xl": "24px", "3xl": "32px", "full": "9999px"}
    for k, v in radii.items():
        lines.append(f"  --mz-radius-{k}: {v};")
    shadows = {
        "xs": "0 1px 2px rgba(0,0,0,.06)",
        "sm": "0 1px 3px rgba(0,0,0,.12)",
        "md": "0 4px 8px rgba(0,0,0,.16)",
        "lg": "0 10px 20px rgba(0,0,0,.19)",
        "xl": "0 18px 36px rgba(0,0,0,.22)",
        "2xl": "0 28px 56px rgba(0,0,0,.26)",
        "inner": "inset 0 2px 6px rgba(0,0,0,.22)",
    }
    for k, v in shadows.items():
        lines.append(f"  --mz-shadow-{k}: {v};")
    durations = {"instant": "60ms", "fast": "150ms", "normal": "300ms",
                 "slow": "500ms", "slower": "800ms"}
    for k, v in durations.items():
        lines.append(f"  --mz-duration-{k}: {v};")
    lines.append("  --mz-ease: cubic-bezier(.4,0,.2,1);")
    lines.append("  --mz-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;")
    lines.append("}")
    return "\n".join(lines) + "\n"

# ---------------------------------------------------------------------------
# reset.css
# ---------------------------------------------------------------------------
def gen_reset():
    add("reset", ".mz-reset")
    return """/* MODZ CSS - minimal, non-destructive reset scoped so it never fights the host project */
.mz-reset, .mz-reset * {
  box-sizing: border-box;
}
[class^="mz-"], [class*=" mz-"] {
  box-sizing: border-box;
}
"""

# ---------------------------------------------------------------------------
# colors.css  (bg / text / border for every color x shade)
# ---------------------------------------------------------------------------
def gen_colors():
    out = ["/* MODZ CSS - color utilities */"]
    for name, base in COLORS.items():
        # base color (500-equivalent)
        out.append(f".mz-bg-{name} {{ background-color: var(--mz-{name}); }}")
        add("colors", f".mz-bg-{name}")
        out.append(f".mz-text-{name} {{ color: var(--mz-{name}); }}")
        add("colors", f".mz-text-{name}")
        out.append(f".mz-border-{name} {{ border-color: var(--mz-{name}); }}")
        add("colors", f".mz-border-{name}")
        for shade in SHADES:
            out.append(f".mz-bg-{name}-{shade} {{ background-color: var(--mz-{name}-{shade}); }}")
            add("colors", f".mz-bg-{name}-{shade}")
            out.append(f".mz-text-{name}-{shade} {{ color: var(--mz-{name}-{shade}); }}")
            add("colors", f".mz-text-{name}-{shade}")
            out.append(f".mz-border-{name}-{shade} {{ border-color: var(--mz-{name}-{shade}); }}")
            add("colors", f".mz-border-{name}-{shade}")
    for extra, val in [("white", "#ffffff"), ("black", "#000000"),
                        ("transparent", "transparent"), ("current", "currentColor")]:
        out.append(f".mz-bg-{extra} {{ background-color: {val}; }}")
        add("colors", f".mz-bg-{extra}")
        out.append(f".mz-text-{extra} {{ color: {val}; }}")
        add("colors", f".mz-text-{extra}")
        out.append(f".mz-border-{extra} {{ border-color: {val}; }}")
        add("colors", f".mz-border-{extra}")
    return "\n".join(out) + "\n"

# ---------------------------------------------------------------------------
# shapes.css
# ---------------------------------------------------------------------------
SHAPE_BASE_CSS = {
    "circle": "border-radius: 50%; aspect-ratio: 1 / 1; display: inline-flex; align-items:center; justify-content:center;",
    "square": "aspect-ratio: 1 / 1; display: inline-block;",
    "rectangle": "display: inline-block; width: 2em; height: 1.2em;",
    "rounded-rectangle": "display: inline-block; width: 2em; height: 1.2em; border-radius: 12px;",
    "pill": "display: inline-flex; align-items:center; justify-content:center; border-radius: 9999px; padding: 0.35em 1em;",
    "triangle": "width: 0; height: 0; border-left: 0.6em solid transparent; border-right: 0.6em solid transparent; border-bottom: 1em solid currentColor; background: none !important; display:inline-block;",
    "triangle-down": "width: 0; height: 0; border-left: 0.6em solid transparent; border-right: 0.6em solid transparent; border-top: 1em solid currentColor; background: none !important; display:inline-block;",
    "triangle-left": "width: 0; height: 0; border-top: 0.6em solid transparent; border-bottom: 0.6em solid transparent; border-right: 1em solid currentColor; background: none !important; display:inline-block;",
    "triangle-right": "width: 0; height: 0; border-top: 0.6em solid transparent; border-bottom: 0.6em solid transparent; border-left: 1em solid currentColor; background: none !important; display:inline-block;",
    "right-triangle": "width: 0; height: 0; border-bottom: 1em solid currentColor; border-right: 1em solid transparent; background: none !important; display:inline-block;",
    "diamond": "width: 1em; height: 1em; transform: rotate(45deg); display:inline-block;",
    "rhombus": "width: 1.4em; height: 1em; transform: skewX(-20deg); display:inline-block;",
    "parallelogram": "width: 1.6em; height: 1em; transform: skewX(-20deg); display:inline-block;",
    "trapezoid": "width: 1.4em; height: 0; border-bottom: 1em solid currentColor; border-left: 0.4em solid transparent; border-right: 0.4em solid transparent; background: none !important; display:inline-block;",
    "pentagon": "clip-path: polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%); width:1.4em; height:1.4em; display:inline-block;",
    "hexagon": "clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%); width:1.4em; height:1.4em; display:inline-block;",
    "heptagon": "clip-path: polygon(50% 0%, 90% 20%, 100% 60%, 75% 100%, 25% 100%, 0% 60%, 10% 20%); width:1.4em; height:1.4em; display:inline-block;",
    "octagon": "clip-path: polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%); width:1.4em; height:1.4em; display:inline-block;",
    "nonagon": "clip-path: polygon(50% 0%, 83% 12%, 100% 43%, 94% 78%, 68% 100%, 32% 100%, 6% 78%, 0% 43%, 17% 12%); width:1.4em; height:1.4em; display:inline-block;",
    "decagon": "clip-path: polygon(50% 0%, 79% 9%, 98% 35%, 98% 65%, 79% 91%, 50% 100%, 21% 91%, 2% 65%, 2% 35%, 21% 9%); width:1.4em; height:1.4em; display:inline-block;",
    "star": "clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%); width:1.4em; height:1.4em; display:inline-block;",
    "star-six": "clip-path: polygon(50% 0%,61% 25%,88% 12%,75% 39%,100% 50%,75% 61%,88% 88%,61% 75%,50% 100%,39% 75%,12% 88%,25% 61%,0% 50%,25% 39%,12% 12%,39% 25%); width:1.4em; height:1.4em; display:inline-block;",
    "cross": "clip-path: polygon(35% 0%,65% 0%,65% 35%,100% 35%,100% 65%,65% 65%,65% 100%,35% 100%,35% 65%,0% 65%,0% 35%,35% 35%); width:1.2em; height:1.2em; display:inline-block;",
    "plus": "clip-path: polygon(40% 0%,60% 0%,60% 40%,100% 40%,100% 60%,60% 60%,60% 100%,40% 100%,40% 60%,0% 60%,0% 40%,40% 40%); width:1.2em; height:1.2em; display:inline-block;",
    "arrow-right": "clip-path: polygon(0% 35%,60% 35%,60% 10%,100% 50%,60% 90%,60% 65%,0% 65%); width:1.6em; height:1.2em; display:inline-block;",
    "arrow-left": "clip-path: polygon(100% 35%,40% 35%,40% 10%,0% 50%,40% 90%,40% 65%,100% 65%); width:1.6em; height:1.2em; display:inline-block;",
    "arrow-up": "clip-path: polygon(35% 100%,35% 40%,10% 40%,50% 0%,90% 40%,65% 40%,65% 100%); width:1.2em; height:1.6em; display:inline-block;",
    "arrow-down": "clip-path: polygon(35% 0%,35% 60%,10% 60%,50% 100%,90% 60%,65% 60%,65% 0%); width:1.2em; height:1.6em; display:inline-block;",
    "chevron-right": "border-right: 0.25em solid currentColor; border-bottom: 0.25em solid currentColor; width:0.7em; height:0.7em; background:none !important; transform: rotate(-45deg); display:inline-block;",
    "chevron-left": "border-left: 0.25em solid currentColor; border-top: 0.25em solid currentColor; width:0.7em; height:0.7em; background:none !important; transform: rotate(-45deg); display:inline-block;",
    "chevron-up": "border-top: 0.25em solid currentColor; border-right: 0.25em solid currentColor; width:0.7em; height:0.7em; background:none !important; transform: rotate(-45deg); display:inline-block;",
    "chevron-down": "border-bottom: 0.25em solid currentColor; border-left: 0.25em solid currentColor; width:0.7em; height:0.7em; background:none !important; transform: rotate(-45deg); display:inline-block;",
    "heart": "clip-path: path('M12 21s-6.5-4.7-9.3-8.8C.6 9 1.4 5 5 3.7 7.4 2.8 9.8 3.7 12 6.4c2.2-2.7 4.6-3.6 7-2.7 3.6 1.3 4.4 5.3 2.3 8.5C18.5 16.3 12 21 12 21z'); width:1.4em; height:1.3em; display:inline-block; background:currentColor;",
    "moon": "border-radius: 50%; box-shadow: 0.35em -0.1em 0 0 currentColor inset; background: transparent !important; width:1.2em; height:1.2em; display:inline-block;",
    "semi-circle": "width: 1.4em; height: 0.7em; border-radius: 1.4em 1.4em 0 0; display:inline-block;",
    "quarter-circle": "width: 1em; height: 1em; border-radius: 100% 0 0 0; display:inline-block;",
    "ring": "border-radius: 50%; border: 0.25em solid currentColor; background: transparent !important; width:1.4em; height:1.4em; display:inline-block;",
    "donut": "border-radius: 50%; border: 0.4em solid currentColor; background: transparent !important; width:1.6em; height:1.6em; display:inline-block;",
    "oval": "border-radius: 50%; width: 1.8em; height: 1em; display:inline-block;",
    "capsule": "border-radius: 999px; width: 2em; height: 1em; display:inline-block;",
    "blob": "border-radius: 42% 58% 63% 37% / 41% 44% 56% 59%; width:1.6em; height:1.6em; display:inline-block;",
    "blob-alt": "border-radius: 63% 37% 30% 70% / 50% 45% 55% 50%; width:1.6em; height:1.6em; display:inline-block;",
    "egg": "border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%; width:1.2em; height:1.6em; display:inline-block;",
    "tear": "border-radius: 0% 50% 50% 50%; transform: rotate(45deg); width:1.4em; height:1.4em; display:inline-block;",
    "shield": "clip-path: polygon(50% 0%,100% 20%,100% 55%,50% 100%,0% 55%,0% 20%); width:1.3em; height:1.5em; display:inline-block;",
    "badge": "border-radius: 50%; width:1.4em; height:1.4em; display:inline-flex; align-items:center; justify-content:center; border: 2px solid currentColor;",
    "hexagon-badge": "clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%); width:1.6em; height:1.6em; display:inline-flex; align-items:center; justify-content:center;",
    "octagon-badge": "clip-path: polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%); width:1.6em; height:1.6em; display:inline-flex; align-items:center; justify-content:center;",
}
SIZES = {"xs": "0.75", "sm": "1", "md": "1.5", "lg": "2.25", "xl": "3.5"}

def gen_shapes():
    out = ["/* MODZ CSS - geometric shapes, CSS-only (clip-path / border tricks / transforms) */"]
    for shape, css in SHAPE_BASE_CSS.items():
        sel = f".mz-{shape}"
        out.append(f"{sel} {{ background-color: var(--mz-purple-500); {css} }}")
        add("shapes", sel)
        for size, em in SIZES.items():
            ssel = f".mz-{shape}-{size}"
            out.append(f"{ssel} {{ font-size: {em}em; }}")
            add("shapes", ssel)
    return "\n".join(out) + "\n"

# ---------------------------------------------------------------------------
# 3d.css
# ---------------------------------------------------------------------------
def gen_3d():
    out = ["/* MODZ CSS - 3D shapes/panels built with perspective + transform-style */",
           ".mz-perspective { perspective: 800px; }",
           ".mz-preserve-3d { transform-style: preserve-3d; }"]
    add("3d", ".mz-perspective"); add("3d", ".mz-preserve-3d")

    cube = """.mz-cube {
  position: relative;
  width: 3em; height: 3em;
  transform-style: preserve-3d;
  transform: rotateX(-20deg) rotateY(30deg);
  display: inline-block;
}
.mz-cube::before, .mz-cube::after {
  content: ""; position: absolute; inset: 0;
  background: var(--mz-purple-500); opacity: .85;
}
.mz-cube::before { transform: translateZ(1.5em); }
.mz-cube::after { transform: rotateY(90deg) translateZ(1.5em); }"""
    out.append(cube); add("3d", ".mz-cube")

    for size, scale in [("sm", 0.6), ("md", 1), ("lg", 1.6), ("xl", 2.2)]:
        sel = f".mz-cube-{size}"
        out.append(f"{sel} {{ transform: rotateX(-20deg) rotateY(30deg) scale({scale}); }}")
        add("3d", sel)
    out.append(".mz-cube-glow { filter: drop-shadow(0 0 12px var(--mz-purple-400)); }")
    add("3d", ".mz-cube-glow")

    misc = {
        "prism": "clip-path: polygon(50% 0%, 100% 100%, 0% 100%); transform: rotateX(15deg); width:2.4em; height:2.4em; background: var(--mz-blue-500); display:inline-block;",
        "cylinder": "border-radius: 50% / 12%; background: var(--mz-cyan-500); width:2.4em; height:3em; display:inline-block; box-shadow: 0 1.4em 0 -0.2em rgba(0,0,0,.25);",
        "cone": "clip-path: polygon(50% 0%, 100% 100%, 0% 100%); border-radius: 0 0 50% 50%; background: var(--mz-orange-500); width:2em; height:2.6em; display:inline-block;",
        "sphere": "border-radius: 50%; background: radial-gradient(circle at 30% 30%, #fff8, transparent 60%), var(--mz-green-500); width:2.6em; height:2.6em; display:inline-block;",
        "pyramid": "clip-path: polygon(50% 0%, 100% 100%, 0% 100%); background: linear-gradient(135deg, var(--mz-amber-400), var(--mz-amber-700)); width:2.4em; height:2.4em; display:inline-block;",
        "3d-card": "transform-style: preserve-3d; transition: transform var(--mz-duration-normal) var(--mz-ease); border-radius: var(--mz-radius-lg); box-shadow: var(--mz-shadow-lg); padding: 1.25em; background: #fff;",
        "3d-box": "transform: perspective(600px) rotateX(8deg) rotateY(-8deg); box-shadow: var(--mz-shadow-xl); border-radius: var(--mz-radius-md);",
        "3d-ring": "border-radius: 50%; border: 0.5em solid var(--mz-purple-500); border-right-color: transparent; transform: rotateX(55deg); width:3em; height:3em; display:inline-block;",
        "3d-button": "transform-style: preserve-3d; box-shadow: 0 6px 0 var(--mz-purple-800); transition: transform var(--mz-duration-fast) var(--mz-ease), box-shadow var(--mz-duration-fast) var(--mz-ease); border-radius: var(--mz-radius-md); padding: .6em 1.2em; background: var(--mz-purple-500); color:#fff; border:0;",
        "3d-panel": "transform: perspective(1000px) rotateY(-6deg); box-shadow: var(--mz-shadow-2xl); border-radius: var(--mz-radius-lg);",
    }
    for name, css in misc.items():
        sel = f".mz-{name}"
        out.append(f"{sel} {{ {css} }}")
        add("3d", sel)
        for size, scale in [("sm", 0.6), ("lg", 1.6)]:
            ssel = f".mz-{name}-{size}"
            out.append(f"{ssel} {{ transform: scale({scale}); }}")
            add("3d", ssel)
    out.append(".mz-3d-button:active { transform: translateY(4px); box-shadow: 0 2px 0 var(--mz-purple-800); }")
    return "\n".join(out) + "\n"

# ---------------------------------------------------------------------------
# glow.css
# ---------------------------------------------------------------------------
def gen_glow():
    out = ["/* MODZ CSS - glow / neon lighting effects */"]
    variants = {
        "glow": "box-shadow: 0 0 12px 2px var(--mz-purple-400);",
        "glow-soft": "box-shadow: 0 0 8px 0 rgba(124,58,237,.35);",
        "glow-strong": "box-shadow: 0 0 24px 6px var(--mz-purple-400);",
        "glow-neon": "box-shadow: 0 0 6px var(--mz-purple-400), 0 0 18px var(--mz-purple-500), 0 0 36px var(--mz-purple-600);",
        "glow-inner": "box-shadow: inset 0 0 14px 2px var(--mz-purple-400);",
        "glow-outer": "box-shadow: 0 0 20px 4px var(--mz-purple-400);",
        "glow-top": "box-shadow: 0 -8px 16px -4px var(--mz-purple-400);",
        "glow-bottom": "box-shadow: 0 8px 16px -4px var(--mz-purple-400);",
        "glow-left": "box-shadow: -8px 0 16px -4px var(--mz-purple-400);",
        "glow-right": "box-shadow: 8px 0 16px -4px var(--mz-purple-400);",
        "glow-border": "box-shadow: 0 0 0 2px var(--mz-purple-400), 0 0 10px 2px var(--mz-purple-400);",
        "glow-text": "text-shadow: 0 0 8px var(--mz-purple-400);",
        "glow-box": "box-shadow: 0 0 24px 4px var(--mz-purple-400);",
        "glow-shadow": "box-shadow: 0 4px 24px 4px var(--mz-purple-400);",
        "glow-double": "box-shadow: 0 0 10px var(--mz-purple-400), 0 0 30px var(--mz-purple-600);",
        "glow-multi": "box-shadow: 0 0 8px var(--mz-purple-400), 0 0 16px var(--mz-blue-400), 0 0 28px var(--mz-cyan-400);",
    }
    for name, css in variants.items():
        sel = f".mz-{name}"
        out.append(f"{sel} {{ {css} }}")
        add("glow", sel)

    glow_colors = ["purple", "blue", "cyan", "green", "red", "orange", "pink", "yellow", "white"]
    for c in glow_colors:
        out.append(f".mz-glow-{c} {{ box-shadow: 0 0 14px 3px var(--mz-{c}-400, {COLORS.get(c,'#fff')}); }}")
        add("glow", f".mz-glow-{c}")
        out.append(f".mz-text-glow-{c} {{ text-shadow: 0 0 8px var(--mz-{c}-400, {COLORS.get(c,'#fff')}); }}")
        add("glow", f".mz-text-glow-{c}")
        out.append(f".mz-border-glow-{c} {{ box-shadow: 0 0 0 2px var(--mz-{c}-400, {COLORS.get(c,'#fff')}), 0 0 10px 2px var(--mz-{c}-400, {COLORS.get(c,'#fff')}); }}")
        add("glow", f".mz-border-glow-{c}")
        out.append(f".mz-box-glow-{c} {{ box-shadow: 0 0 22px 4px var(--mz-{c}-400, {COLORS.get(c,'#fff')}); }}")
        add("glow", f".mz-box-glow-{c}")
    return "\n".join(out) + "\n"

# ---------------------------------------------------------------------------
# borders.css
# ---------------------------------------------------------------------------
def gen_borders():
    out = ["/* MODZ CSS - border styles */"]
    styles = ["solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset", "none"]
    for s in styles:
        sel = f".mz-border-{s}"
        out.append(f"{sel} {{ border-style: {s}; }}")
        add("borders", sel)
    widths = {"thin": "1px", "md": "2px", "thick": "4px", "xl": "6px"}
    for name, w in widths.items():
        sel = f".mz-border-{name}"
        out.append(f"{sel} {{ border-width: {w}; border-style: solid; }}")
        add("borders", sel)
    for side in ["top", "bottom", "left", "right"]:
        sel = f".mz-border-{side}"
        out.append(f"{sel} {{ border-{side}: 1px solid currentColor; }}")
        add("borders", sel)
        sel2 = f".mz-border-{side}-only"
        out.append(f"{sel2} {{ border: 0; border-{side}: 2px solid currentColor; }}")
        add("borders", sel2)
    specials = {
        "gradient": ".mz-border-gradient { border: 3px solid transparent; border-radius: var(--mz-radius-lg); background: linear-gradient(#fff,#fff) padding-box, linear-gradient(135deg, var(--mz-purple-500), var(--mz-cyan-500)) border-box; }",
        "animated": "@keyframes mz-border-spin { to { --mz-angle: 360deg; } }\n.mz-border-animated { border: 3px solid transparent; border-radius: var(--mz-radius-lg); background: linear-gradient(#fff,#fff) padding-box, conic-gradient(from var(--mz-angle,0deg), var(--mz-purple-500), var(--mz-cyan-500), var(--mz-purple-500)) border-box; animation: mz-border-spin 3s linear infinite; }",
        "neon": ".mz-border-neon { border: 2px solid var(--mz-cyan-400); box-shadow: 0 0 8px var(--mz-cyan-400), inset 0 0 8px var(--mz-cyan-400); }",
        "glow": ".mz-border-glow { border: 2px solid var(--mz-purple-400); box-shadow: 0 0 12px var(--mz-purple-400); }",
        "rainbow": ".mz-border-rainbow { border: 3px solid transparent; border-radius: var(--mz-radius-lg); background: linear-gradient(#fff,#fff) padding-box, linear-gradient(90deg,#ef4444,#f59e0b,#eab308,#22c55e,#06b6d4,#7c3aed) border-box; }",
        "corner": ".mz-border-corner { position: relative; border: 0; } .mz-border-corner::before { content:''; position:absolute; inset:0; border: 2px solid currentColor; border-radius: inherit; clip-path: polygon(0 0, 30% 0, 30% 8%, 8% 8%, 8% 30%, 0 30%, 0 0, 0 100%, 8% 100%, 8% 70%, 30% 70%, 30% 100%, 0 100%, 100% 100%, 100% 70%, 70% 70%, 70% 100%, 100% 100%, 100% 0, 70% 0, 70% 8%, 92% 8%, 92% 30%, 100% 30%); }",
        "partial": ".mz-border-partial { border-image: linear-gradient(90deg, currentColor 60%, transparent 60%) 1; border-style: solid; border-width: 2px; }",
    }
    for name, css in specials.items():
        out.append(css)
        sel = f".mz-border-{name}"
        add("borders", sel)
    return "\n".join(out) + "\n"

# ---------------------------------------------------------------------------
# radius.css
# ---------------------------------------------------------------------------
def gen_radius():
    out = ["/* MODZ CSS - border-radius system */"]
    scale = ["0", "xs", "sm", "md", "lg", "xl", "2xl", "3xl", "full"]
    for s in scale:
        sel = f".mz-radius-{s}"
        var = "0" if s == "0" else f"var(--mz-radius-{s})"
        out.append(f"{sel} {{ border-radius: {var}; }}")
        add("radius", sel)
    corners = {
        "top": "border-top-left-radius: var(--mz-radius-lg); border-top-right-radius: var(--mz-radius-lg);",
        "bottom": "border-bottom-left-radius: var(--mz-radius-lg); border-bottom-right-radius: var(--mz-radius-lg);",
        "left": "border-top-left-radius: var(--mz-radius-lg); border-bottom-left-radius: var(--mz-radius-lg);",
        "right": "border-top-right-radius: var(--mz-radius-lg); border-bottom-right-radius: var(--mz-radius-lg);",
        "top-left": "border-top-left-radius: var(--mz-radius-lg);",
        "top-right": "border-top-right-radius: var(--mz-radius-lg);",
        "bottom-left": "border-bottom-left-radius: var(--mz-radius-lg);",
        "bottom-right": "border-bottom-right-radius: var(--mz-radius-lg);",
    }
    for name, css in corners.items():
        sel = f".mz-radius-{name}"
        out.append(f"{sel} {{ {css} }}")
        add("radius", sel)
        for size in ["sm", "xl"]:
            css_sz = css.replace("var(--mz-radius-lg)", f"var(--mz-radius-{size})")
            sel_sz = f".mz-radius-{name}-{size}"
            out.append(f"{sel_sz} {{ {css_sz} }}")
            add("radius", sel_sz)
    return "\n".join(out) + "\n"

# ---------------------------------------------------------------------------
# shadows.css
# ---------------------------------------------------------------------------
def gen_shadows():
    out = ["/* MODZ CSS - shadow system */"]
    for s in ["xs", "sm", "md", "lg", "xl", "2xl", "inner"]:
        sel = f".mz-shadow-{s}"
        out.append(f"{sel} {{ box-shadow: var(--mz-shadow-{s}); }}")
        add("shadows", sel)
    specials = {
        "soft": "0 4px 20px rgba(0,0,0,.08)",
        "hard": "6px 6px 0 rgba(0,0,0,.9)",
        "dark": "0 10px 30px rgba(0,0,0,.6)",
        "none": "none",
    }
    for name, val in specials.items():
        sel = f".mz-shadow-{name}"
        out.append(f"{sel} {{ box-shadow: {val}; }}")
        add("shadows", sel)
    colors = ["purple", "blue", "cyan", "red", "green", "orange", "pink", "yellow"]
    for c in colors:
        sel = f".mz-shadow-{c}"
        out.append(f"{sel} {{ box-shadow: 0 10px 24px -6px var(--mz-{c}-500); }}")
        add("shadows", sel)
    return "\n".join(out) + "\n"

# ---------------------------------------------------------------------------
# glass.css
# ---------------------------------------------------------------------------
def gen_glass():
    out = ["/* MODZ CSS - glassmorphism (with graceful fallback for no backdrop-filter support) */"]
    variants = {
        "glass": "background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.25); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);",
        "glass-light": "background: rgba(255,255,255,.35); border: 1px solid rgba(255,255,255,.4); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);",
        "glass-dark": "background: rgba(15,15,20,.45); border: 1px solid rgba(255,255,255,.08); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); color:#fff;",
        "glass-soft": "background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.15); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);",
        "glass-strong": "background: rgba(255,255,255,.25); border: 1px solid rgba(255,255,255,.35); -webkit-backdrop-filter: blur(22px); backdrop-filter: blur(22px);",
        "glass-purple": "background: rgba(124,58,237,.18); border: 1px solid rgba(124,58,237,.35); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);",
        "glass-blue": "background: rgba(59,130,246,.18); border: 1px solid rgba(59,130,246,.35); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);",
        "glass-cyan": "background: rgba(6,182,212,.18); border: 1px solid rgba(6,182,212,.35); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);",
        "glass-border": "border: 1px solid rgba(255,255,255,.4);",
        "glass-glow": "box-shadow: 0 8px 32px rgba(31,38,135,.25);",
    }
    for name, css in variants.items():
        sel = f".mz-{name}"
        out.append(f"{sel} {{ {css} }}")
        add("glass", sel)
    out.append("@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {")
    out.append("  .mz-glass, .mz-glass-light, .mz-glass-dark, .mz-glass-soft, .mz-glass-strong, .mz-glass-purple, .mz-glass-blue, .mz-glass-cyan { background: rgba(255,255,255,.85); }")
    out.append("}")
    return "\n".join(out) + "\n"

# ---------------------------------------------------------------------------
# gradients.css
# ---------------------------------------------------------------------------
def gen_gradients():
    out = ["/* MODZ CSS - gradients: linear / radial / conic */"]
    pairs = {
        "purple": ("var(--mz-purple-400)", "var(--mz-purple-700)"),
        "blue": ("var(--mz-blue-400)", "var(--mz-blue-700)"),
        "cyan": ("var(--mz-cyan-400)", "var(--mz-cyan-700)"),
        "red": ("var(--mz-red-400)", "var(--mz-red-700)"),
        "green": ("var(--mz-green-400)", "var(--mz-green-700)"),
        "orange": ("var(--mz-orange-400)", "var(--mz-orange-700)"),
        "pink": ("var(--mz-pink-400)", "var(--mz-pink-700)"),
        "rainbow": ("#ef4444", "#7c3aed"),
    }
    out.append(".mz-gradient { background: linear-gradient(135deg, var(--mz-purple-400), var(--mz-cyan-500)); }")
    add("gradients", ".mz-gradient")
    for name, (a, b) in pairs.items():
        sel = f".mz-gradient-{name}"
        if name == "rainbow":
            out.append(f"{sel} {{ background: linear-gradient(90deg,#ef4444,#f59e0b,#eab308,#22c55e,#06b6d4,#7c3aed,#ec4899); }}")
        else:
            out.append(f"{sel} {{ background: linear-gradient(135deg, {a}, {b}); }}")
        add("gradients", sel)
    directions = {
        "to-top": "to top", "to-bottom": "to bottom", "to-left": "to left", "to-right": "to right",
        "to-top-left": "to top left", "to-top-right": "to top right",
        "to-bottom-left": "to bottom left", "to-bottom-right": "to bottom right",
    }
    for name, dir_val in directions.items():
        sel = f".mz-gradient-{name}"
        out.append(f"{sel} {{ background-image: linear-gradient({dir_val}, var(--mz-purple-400), var(--mz-cyan-500)); }}")
        add("gradients", sel)
    out.append(".mz-conic { background: conic-gradient(var(--mz-purple-400), var(--mz-cyan-500), var(--mz-purple-400)); }")
    add("gradients", ".mz-conic")
    out.append(".mz-conic-rainbow { background: conic-gradient(#ef4444,#f59e0b,#eab308,#22c55e,#06b6d4,#7c3aed,#ec4899,#ef4444); }")
    add("gradients", ".mz-conic-rainbow")
    out.append(".mz-radial { background: radial-gradient(circle, var(--mz-purple-400), var(--mz-cyan-700)); }")
    add("gradients", ".mz-radial")
    for c in ["purple", "blue", "cyan", "green", "red"]:
        sel = f".mz-radial-{c}"
        out.append(f"{sel} {{ background: radial-gradient(circle, var(--mz-{c}-300), var(--mz-{c}-700)); }}")
        add("gradients", sel)
    return "\n".join(out) + "\n"

# ---------------------------------------------------------------------------
# typography.css
# ---------------------------------------------------------------------------
def gen_typography():
    out = ["/* MODZ CSS - typography */"]
    sizes = {"xs": ".75rem", "sm": ".875rem", "md": "1rem", "lg": "1.125rem",
              "xl": "1.25rem", "2xl": "1.5rem", "3xl": "1.875rem", "4xl": "2.25rem",
              "5xl": "3rem", "6xl": "3.75rem", "7xl": "4.5rem"}
    for name, val in sizes.items():
        sel = f".mz-text-{name}"
        out.append(f"{sel} {{ font-size: {val}; }}")
        add("typography", sel)
    weights = {"thin": 100, "extralight": 200, "light": 300, "normal": 400,
               "medium": 500, "semibold": 600, "bold": 700, "extrabold": 800, "black": 900}
    for name, val in weights.items():
        sel = f".mz-font-{name}"
        out.append(f"{sel} {{ font-weight: {val}; }}")
        add("typography", sel)
    for name in ["left", "center", "right", "justify"]:
        sel = f".mz-text-{name}"
        out.append(f"{sel} {{ text-align: {name}; }}")
        add("typography", sel)
    transforms = {"uppercase": "uppercase", "lowercase": "lowercase", "capitalize": "capitalize", "normal-case": "none"}
    for name, val in transforms.items():
        sel = f".mz-text-{name}"
        out.append(f"{sel} {{ text-transform: {val}; }}")
        add("typography", sel)
    decorations = {"underline": "underline", "overline": "overline", "line-through": "line-through", "no-underline": "none"}
    for name, val in decorations.items():
        sel = f".mz-text-{name}"
        out.append(f"{sel} {{ text-decoration-line: {val}; }}")
        add("typography", sel)
    out.append(".mz-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }")
    add("typography", ".mz-truncate")
    for n in [2, 3, 4]:
        sel = f".mz-truncate-{n}"
        out.append(f"{sel} {{ display:-webkit-box; -webkit-line-clamp:{n}; -webkit-box-orient:vertical; overflow:hidden; }}")
        add("typography", sel)
    wraps = {"wrap": "normal", "nowrap": "nowrap", "balance": "balance", "pretty": "pretty"}
    for name, val in wraps.items():
        sel = f".mz-text-{name}" if name in ("nowrap",) else f".mz-text-wrap-{name}"
        prop = "white-space" if name == "nowrap" else "text-wrap"
        out.append(f"{sel} {{ {prop}: {val}; }}")
        add("typography", sel)
    tracking = {"tighter": "-.05em", "tight": "-.025em", "normal": "0", "wide": ".025em", "wider": ".05em", "widest": ".1em"}
    for name, val in tracking.items():
        sel = f".mz-tracking-{name}"
        out.append(f"{sel} {{ letter-spacing: {val}; }}")
        add("typography", sel)
    leading = {"none": "1", "tight": "1.2", "snug": "1.35", "normal": "1.5", "relaxed": "1.65", "loose": "2"}
    for name, val in leading.items():
        sel = f".mz-leading-{name}"
        out.append(f"{sel} {{ line-height: {val}; }}")
        add("typography", sel)
    effects = {
        "text-glow": "text-shadow: 0 0 8px currentColor;",
        "text-gradient": "background: linear-gradient(135deg, var(--mz-purple-500), var(--mz-cyan-500)); -webkit-background-clip: text; background-clip: text; color: transparent;",
        "text-shadow": "text-shadow: 2px 2px 4px rgba(0,0,0,.35);",
        "text-neon": "color: #fff; text-shadow: 0 0 6px var(--mz-cyan-400), 0 0 16px var(--mz-cyan-500), 0 0 32px var(--mz-cyan-600);",
    }
    for name, css in effects.items():
        sel = f".mz-{name}"
        out.append(f"{sel} {{ {css} }}")
        add("typography", sel)
    out.append(".mz-italic { font-style: italic; }")
    add("typography", ".mz-italic")
    out.append(".mz-not-italic { font-style: normal; }")
    add("typography", ".mz-not-italic")
    return "\n".join(out) + "\n"

# ---------------------------------------------------------------------------
# spacing.css (margin / padding, all directions, negative margins too)
# ---------------------------------------------------------------------------
SPACE_SCALE = {str(i): f"{i * 0.25}rem" for i in range(0, 21)}
SPACE_SCALE["px"] = "1px"
SPACE_SCALE["auto"] = "auto"

def gen_spacing():
    out = ["/* MODZ CSS - spacing (margin / padding) */"]
    sides = {
        "": ["margin", "padding"],
        "t": ["margin-top", "padding-top"],
        "b": ["margin-bottom", "padding-bottom"],
        "l": ["margin-left", "padding-left"],
        "r": ["margin-right", "padding-right"],
        "x": [["margin-left", "margin-right"], ["padding-left", "padding-right"]],
        "y": [["margin-top", "margin-bottom"], ["padding-top", "padding-bottom"]],
    }
    for side, props in sides.items():
        m_prop, p_prop = props[0], props[1]
        for key, val in SPACE_SCALE.items():
            if val == "auto" and side in ("t", "b"):
                continue
            m_sel = f".mz-m{side}-{key}"
            p_sel = f".mz-p{side}-{key}"
            if isinstance(m_prop, list):
                m_rule = " ".join(f"{p}: {val};" for p in m_prop)
                p_rule = " ".join(f"{p}: {val};" for p in p_prop)
            else:
                m_rule = f"{m_prop}: {val};"
                p_rule = f"{p_prop}: {val};"
            out.append(f"{m_sel} {{ {m_rule} }}")
            add("spacing", m_sel)
            if val != "auto":
                out.append(f"{p_sel} {{ {p_rule} }}")
                add("spacing", p_sel)
    # negative margins
    for key, val in SPACE_SCALE.items():
        if key in ("auto", "0"):
            continue
        sel = f".mz--m-{key}"
        out.append(f"{sel} {{ margin: -{val}; }}")
        add("spacing", sel)
    return "\n".join(out) + "\n"

# ---------------------------------------------------------------------------
# sizing.css (width / height)
# ---------------------------------------------------------------------------
def gen_sizing():
    out = ["/* MODZ CSS - width / height utilities */"]
    keywords = {"auto": "auto", "full": "100%", "screen": "100vw", "fit": "fit-content",
                "min": "min-content", "max": "max-content"}
    for name, val in keywords.items():
        sel = f".mz-w-{name}"
        out.append(f"{sel} {{ width: {val}; }}")
        add("sizing", sel)
    hkeywords = {"auto": "auto", "full": "100%", "screen": "100vh", "fit": "fit-content",
                 "min": "min-content", "max": "max-content"}
    for name, val in hkeywords.items():
        sel = f".mz-h-{name}"
        out.append(f"{sel} {{ height: {val}; }}")
        add("sizing", sel)
    fractions = {"1-2": "50%", "1-3": "33.3333%", "2-3": "66.6667%", "1-4": "25%",
                 "3-4": "75%", "1-5": "20%", "2-5": "40%", "3-5": "60%", "4-5": "80%", "1-6": "16.6667%"}
    for name, val in fractions.items():
        wsel = f".mz-w-{name}"
        out.append(f"{wsel} {{ width: {val}; }}")
        add("sizing", wsel)
        hsel = f".mz-h-{name}"
        out.append(f"{hsel} {{ height: {val}; }}")
        add("sizing", hsel)
    for i in range(0, 21):
        rem = f"{i * 0.25}rem"
        wsel = f".mz-w-{i}"
        out.append(f"{wsel} {{ width: {rem}; }}")
        add("sizing", wsel)
        hsel = f".mz-h-{i}"
        out.append(f"{hsel} {{ height: {rem}; }}")
        add("sizing", hsel)
    for name, val in {"min-w-0": "0", "min-w-full": "100%", "max-w-full": "100%",
                       "max-w-screen": "100vw", "min-h-0": "0", "min-h-full": "100%",
                       "max-h-full": "100%", "max-h-screen": "100vh"}.items():
        prop = "min-width" if name.startswith("min-w") else "max-width" if name.startswith("max-w") else "min-height" if name.startswith("min-h") else "max-height"
        sel = f".mz-{name}"
        out.append(f"{sel} {{ {prop}: {val}; }}")
        add("sizing", sel)
    return "\n".join(out) + "\n"

# ---------------------------------------------------------------------------
# position.css
# ---------------------------------------------------------------------------
def gen_position():
    out = ["/* MODZ CSS - position utilities */"]
    for p in ["static", "relative", "absolute", "fixed", "sticky"]:
        sel = f".mz-{p}"
        out.append(f"{sel} {{ position: {p}; }}")
        add("position", sel)
    offsets = {"0": "0", "px": "1px", "xs": ".25rem", "sm": ".5rem", "md": "1rem", "lg": "1.5rem", "xl": "2rem", "auto": "auto"}
    for side in ["top", "bottom", "left", "right", "inset"]:
        for name, val in offsets.items():
            sel = f".mz-{side}-{name}"
            if side == "inset":
                out.append(f"{sel} {{ top: {val}; right: {val}; bottom: {val}; left: {val}; }}")
            else:
                out.append(f"{sel} {{ {side}: {val}; }}")
            add("position", sel)
    for z in [0, 10, 20, 30, 40, 50]:
        sel = f".mz-z-{z}"
        out.append(f"{sel} {{ z-index: {z}; }}")
        add("position", sel)
    out.append(".mz-z-auto { z-index: auto; }")
    add("position", ".mz-z-auto")
    out.append(".mz-z-max { z-index: 2147483647; }")
    add("position", ".mz-z-max")
    return "\n".join(out) + "\n"

# ---------------------------------------------------------------------------
# display.css / overflow.css / opacity.css
# ---------------------------------------------------------------------------
def gen_display():
    out = ["/* MODZ CSS - display */"]
    # Note: flex/inline-flex/grid/inline-grid are defined once in flex.css / grid.css,
    # not duplicated here, to keep every class name unique across the library.
    for name, val in {"block": "block", "inline": "inline", "inline-block": "inline-block",
                       "hidden": "none",
                       "table": "table", "table-row": "table-row", "table-cell": "table-cell",
                       "contents": "contents", "flow-root": "flow-root"}.items():
        sel = f".mz-{name}"
        out.append(f"{sel} {{ display: {val}; }}")
        add("display", sel)
    return "\n".join(out) + "\n"

def gen_overflow():
    out = ["/* MODZ CSS - overflow */"]
    for name, val in {"auto": "auto", "hidden": "hidden", "visible": "visible", "scroll": "scroll"}.items():
        sel = f".mz-overflow-{name}"
        out.append(f"{sel} {{ overflow: {val}; }}")
        add("overflow", sel)
        xsel = f".mz-overflow-x-{name}"
        out.append(f"{xsel} {{ overflow-x: {val}; }}")
        add("overflow", xsel)
        ysel = f".mz-overflow-y-{name}"
        out.append(f"{ysel} {{ overflow-y: {val}; }}")
        add("overflow", ysel)
    return "\n".join(out) + "\n"

def gen_opacity():
    out = ["/* MODZ CSS - opacity */"]
    for i in range(0, 101, 5):
        sel = f".mz-opacity-{i}"
        out.append(f"{sel} {{ opacity: {i/100}; }}")
        add("opacity", sel)
    return "\n".join(out) + "\n"

# ---------------------------------------------------------------------------
# transforms.css / transitions.css
# ---------------------------------------------------------------------------
def gen_transforms():
    out = ["/* MODZ CSS - transforms */"]
    for deg in [0, 1, 2, 3, 6, 12, 45, 90, 135, 180, 270, -45, -90]:
        sel = f".mz-rotate-{str(deg).replace('-', 'neg-')}"
        out.append(f"{sel} {{ transform: rotate({deg}deg); }}")
        add("transforms", sel)
    for name, val in {"0": "0", "xs": ".75", "sm": ".9", "md": "1", "lg": "1.1", "xl": "1.25", "2xl": "1.5", "150": "1.5"}.items():
        sel = f".mz-scale-{name}"
        out.append(f"{sel} {{ transform: scale({val}); }}")
        add("transforms", sel)
        selx = f".mz-scale-x-{name}"
        out.append(f"{selx} {{ transform: scaleX({val}); }}")
        add("transforms", selx)
        sely = f".mz-scale-y-{name}"
        out.append(f"{sely} {{ transform: scaleY({val}); }}")
        add("transforms", sely)
    for name, val in {"up": "0 -.5rem", "down": "0 .5rem", "left": "-.5rem 0", "right": ".5rem 0",
                      "up-lg": "0 -2rem", "down-lg": "0 2rem", "left-lg": "-2rem 0", "right-lg": "2rem 0"}.items():
        sel = f".mz-translate-{name}"
        out.append(f"{sel} {{ transform: translate({val}); }}")
        add("transforms", sel)
    for name, val in {"x": "-12deg", "y": "-12deg", "x-lg": "-20deg", "y-lg": "-20deg"}.items():
        axis = "X" if name.startswith("x") else "Y"
        sel = f".mz-skew-{name}"
        out.append(f"{sel} {{ transform: skew{axis}({val}); }}")
        add("transforms", sel)
    out.append(".mz-flip-x { transform: scaleX(-1); }")
    add("transforms", ".mz-flip-x")
    out.append(".mz-flip-y { transform: scaleY(-1); }")
    add("transforms", ".mz-flip-y")
    out.append(".mz-transform-none { transform: none; }")
    add("transforms", ".mz-transform-none")
    for name, val in {"center": "center", "top": "top", "bottom": "bottom", "left": "left", "right": "right"}.items():
        sel = f".mz-origin-{name}"
        out.append(f"{sel} {{ transform-origin: {val}; }}")
        add("transforms", sel)
    return "\n".join(out) + "\n"

def gen_transitions():
    out = ["/* MODZ CSS - transitions */"]
    speeds = {"instant": "60ms", "fast": "150ms", "normal": "300ms", "slow": "500ms", "slower": "800ms"}
    props = {"": "all", "transform": "transform", "opacity": "opacity", "colors": "color, background-color, border-color",
             "shadow": "box-shadow", "filter": "filter"}
    out.append(".mz-transition { transition-property: all; transition-timing-function: var(--mz-ease); transition-duration: var(--mz-duration-normal); }")
    add("transitions", ".mz-transition")
    for sname, sval in speeds.items():
        sel = f".mz-duration-{sname}"
        out.append(f"{sel} {{ transition-duration: {sval}; animation-duration: {sval}; }}")
        add("transitions", sel)
    for pname, pval in props.items():
        if pname == "":
            continue
        sel = f".mz-transition-{pname}"
        out.append(f"{sel} {{ transition-property: {pval}; transition-timing-function: var(--mz-ease); transition-duration: var(--mz-duration-normal); }}")
        add("transitions", sel)
    for name, val in {"linear": "linear", "ease": "ease", "ease-in": "ease-in", "ease-out": "ease-out", "ease-in-out": "ease-in-out"}.items():
        sel = f".mz-ease-{name}"
        out.append(f"{sel} {{ transition-timing-function: {val}; }}")
        add("transitions", sel)
    out.append(".mz-transition-none { transition-property: none; }")
    add("transitions", ".mz-transition-none")
    return "\n".join(out) + "\n"

# ---------------------------------------------------------------------------
# animations.css
# ---------------------------------------------------------------------------
KEYFRAMES = {
    "fade": "from { opacity: 0; } to { opacity: 1; }",
    "fade-up": "from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); }",
    "fade-down": "from { opacity: 0; transform: translateY(-16px); } to { opacity: 1; transform: translateY(0); }",
    "fade-left": "from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); }",
    "fade-right": "from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: translateX(0); }",
    "zoom": "from { transform: scale(.9); opacity:.4; } to { transform: scale(1); opacity:1; }",
    "zoom-in": "from { transform: scale(.5); opacity:0; } to { transform: scale(1); opacity:1; }",
    "zoom-out": "from { transform: scale(1.5); opacity:0; } to { transform: scale(1); opacity:1; }",
    "slide": "from { transform: translateX(-100%); } to { transform: translateX(0); }",
    "slide-up": "from { transform: translateY(100%); } to { transform: translateY(0); }",
    "slide-down": "from { transform: translateY(-100%); } to { transform: translateY(0); }",
    "bounce": "0%,100% { transform: translateY(0); } 50% { transform: translateY(-25%); }",
    "pulse": "0%,100% { opacity:1; } 50% { opacity:.5; }",
    "shake": "0%,100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); }",
    "spin": "from { transform: rotate(0); } to { transform: rotate(360deg); }",
    "spin-reverse": "from { transform: rotate(360deg); } to { transform: rotate(0); }",
    "float": "0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); }",
    "hover-bob": "0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); }",
    "glow-pulse": "0%,100% { box-shadow: 0 0 6px var(--mz-purple-400); } 50% { box-shadow: 0 0 24px var(--mz-purple-400); }",
    "neon-flicker": "0%,19%,21%,23%,25%,54%,56%,100% { opacity:1; } 20%,24%,55% { opacity:.4; }",
    "blink": "0%,100% { opacity:1; } 50% { opacity:0; }",
    "heartbeat": "0%,100% { transform: scale(1); } 25% { transform: scale(1.15); } 40% { transform: scale(1); } 60% { transform: scale(1.1); }",
    "swing": "20% { transform: rotate(12deg); } 40% { transform: rotate(-8deg); } 60% { transform: rotate(4deg); } 80% { transform: rotate(-2deg); } 100% { transform: rotate(0); }",
    "wobble": "0%,100% { transform: translateX(0); } 15% { transform: translateX(-10px) rotate(-4deg); } 30% { transform: translateX(6px) rotate(3deg); } 45% { transform: translateX(-6px) rotate(-2deg); } 60% { transform: translateX(4px) rotate(1deg); }",
    "rubber": "0% { transform: scale(1); } 30% { transform: scaleX(1.25) scaleY(.75); } 50% { transform: scaleX(.75) scaleY(1.25); } 70% { transform: scaleX(1.15) scaleY(.85); } 100% { transform: scale(1); }",
    "flip": "from { transform: perspective(400px) rotateY(0); } to { transform: perspective(400px) rotateY(360deg); }",
    "flip-x": "from { transform: rotateX(0); } to { transform: rotateX(360deg); }",
    "rotate-slow": "from { transform: rotate(0); } to { transform: rotate(360deg); }",
    "blur-in": "from { filter: blur(8px); opacity:0; } to { filter: blur(0); opacity:1; }",
    "shimmer": "0% { background-position: -200% 0; } 100% { background-position: 200% 0; }",
    "skeleton": "0%,100% { opacity:.6; } 50% { opacity:1; }",
    "scanline": "0% { transform: translateY(-100%); } 100% { transform: translateY(100%); }",
    "aurora": "0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; }",
    "gradient-move": "0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; }",
}

def gen_animations():
    out = ["/* MODZ CSS - keyframe animations (pure CSS, no JS) */"]
    for name, body in KEYFRAMES.items():
        out.append(f"@keyframes mz-{name} {{ {body} }}")
    durations = {"fast": "600ms", "normal": "1.2s", "slow": "2.4s"}
    for name in KEYFRAMES:
        sel = f".mz-animate-{name}"
        out.append(f"{sel} {{ animation: mz-{name} 1.2s var(--mz-ease) both; }}")
        add("animations", sel)
    for name, val in durations.items():
        sel = f".mz-anim-duration-{name}"
        out.append(f"{sel} {{ animation-duration: {val}; }}")
        add("animations", sel)
    out.append(".mz-animate-infinite { animation-iteration-count: infinite; }")
    add("animations", ".mz-animate-infinite")
    out.append(".mz-animate-paused { animation-play-state: paused; }")
    add("animations", ".mz-animate-paused")
    out.append("@media (prefers-reduced-motion: reduce) {")
    out.append("  [class*='mz-animate-'] { animation-duration: .001ms !important; animation-iteration-count: 1 !important; }")
    out.append("}")
    return "\n".join(out) + "\n"

# ---------------------------------------------------------------------------
# hover.css
# ---------------------------------------------------------------------------
def gen_hover():
    out = ["/* MODZ CSS - hover effects (pure :hover, no JS) */"]
    variants = {
        "grow": "transform: scale(1.06);",
        "shrink": "transform: scale(.94);",
        "lift": "transform: translateY(-6px);",
        "sink": "transform: translateY(4px);",
        "glow": "box-shadow: 0 0 18px var(--mz-purple-400);",
        "shadow": "box-shadow: var(--mz-shadow-xl);",
        "rotate": "transform: rotate(6deg);",
        "rotate-reverse": "transform: rotate(-6deg);",
        "scale": "transform: scale(1.1);",
        "bright": "filter: brightness(1.15);",
        "dark": "filter: brightness(.85);",
        "blur": "filter: blur(2px);",
        "underline": "text-decoration: underline;",
        "opacity": "opacity: .75;",
        "float": "transform: translateY(-4px);",
    }
    for name, css in variants.items():
        sel = f".mz-hover-{name}"
        out.append(f"{sel} {{ transition: all var(--mz-duration-fast) var(--mz-ease); }}")
        out.append(f"{sel}:hover {{ {css} }}")
        add("hover", sel)
    return "\n".join(out) + "\n"

# ---------------------------------------------------------------------------
# filters.css
# ---------------------------------------------------------------------------
def gen_filters():
    out = ["/* MODZ CSS - CSS filter utilities */"]
    for name, val in {"none": "0px", "xs": "1px", "sm": "2px", "md": "4px", "lg": "8px", "xl": "16px", "2xl": "24px"}.items():
        sel = f".mz-blur-{name}"
        out.append(f"{sel} {{ filter: blur({val}); }}")
        add("filters", sel)
    for name, val in {"0": "0", "low": ".5", "normal": "1", "high": "1.5", "max": "2"}.items():
        sel = f".mz-bright-{name}" if name != "normal" else ".mz-bright"
        out.append(f"{sel} {{ filter: brightness({val}); }}")
        add("filters", sel)
    for name, val in {"0": "0", "low": ".5", "normal": "1", "high": "1.5", "max": "2"}.items():
        sel = f".mz-contrast-{name}" if name != "normal" else ".mz-contrast"
        out.append(f"{sel} {{ filter: contrast({val}); }}")
        add("filters", sel)
    for name, val in {"0": "0%", "50": "50%", "100": "100%"}.items():
        sel = f".mz-grayscale-{name}" if name != "100" else ".mz-grayscale"
        out.append(f"{sel} {{ filter: grayscale({val}); }}")
        add("filters", sel)
        sel2 = f".mz-sepia-{name}" if name != "100" else ".mz-sepia"
        out.append(f"{sel2} {{ filter: sepia({val}); }}")
        add("filters", sel2)
    for name, val in {"0": "0", "low": ".5", "normal": "1", "high": "2"}.items():
        sel = f".mz-saturate-{name}" if name != "normal" else ".mz-saturate"
        out.append(f"{sel} {{ filter: saturate({val}); }}")
        add("filters", sel)
    for name, val in {"0": "0%", "100": "100%"}.items():
        sel = f".mz-invert-{name}" if name != "100" else ".mz-invert"
        out.append(f"{sel} {{ filter: invert({val}); }}")
        add("filters", sel)
    out.append(".mz-hue-rotate-90 { filter: hue-rotate(90deg); }")
    add("filters", ".mz-hue-rotate-90")
    out.append(".mz-hue-rotate-180 { filter: hue-rotate(180deg); }")
    add("filters", ".mz-hue-rotate-180")
    out.append(".mz-backdrop-blur-sm { backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }")
    add("filters", ".mz-backdrop-blur-sm")
    out.append(".mz-backdrop-blur-md { backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }")
    add("filters", ".mz-backdrop-blur-md")
    out.append(".mz-backdrop-blur-lg { backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); }")
    add("filters", ".mz-backdrop-blur-lg")
    return "\n".join(out) + "\n"

# ---------------------------------------------------------------------------
# aspect / object-fit
# ---------------------------------------------------------------------------
def gen_aspect():
    out = ["/* MODZ CSS - aspect-ratio + object-fit */"]
    for name, val in {"square": "1 / 1", "video": "16 / 9", "4-3": "4 / 3", "3-2": "3 / 2",
                       "16-9": "16 / 9", "21-9": "21 / 9", "1-1": "1 / 1", "golden": "1.618 / 1"}.items():
        sel = f".mz-aspect-{name}"
        out.append(f"{sel} {{ aspect-ratio: {val}; }}")
        add("aspect", sel)
    for name, val in {"cover": "cover", "contain": "contain", "fill": "fill", "none": "none", "scale-down": "scale-down"}.items():
        sel = f".mz-object-{name}"
        out.append(f"{sel} {{ object-fit: {val}; }}")
        add("aspect", sel)
    for name, val in {"center": "center", "top": "top", "bottom": "bottom", "left": "left", "right": "right"}.items():
        sel = f".mz-object-{name}-pos" if name != "center" else ".mz-object-center"
        out.append(f"{sel} {{ object-position: {val}; }}")
        add("aspect", sel)
    return "\n".join(out) + "\n"

# ---------------------------------------------------------------------------
# flex.css / grid.css
# ---------------------------------------------------------------------------
def gen_flex():
    out = ["/* MODZ CSS - flexbox utilities */"]
    out.append(".mz-flex { display: flex; }")
    add("flex", ".mz-flex")
    out.append(".mz-inline-flex { display: inline-flex; }")
    add("flex", ".mz-inline-flex")
    for name, val in {"row": "row", "row-reverse": "row-reverse", "column": "column", "column-reverse": "column-reverse"}.items():
        sel = f".mz-flex-{name}"
        out.append(f"{sel} {{ flex-direction: {val}; }}")
        add("flex", sel)
    for name, val in {"wrap": "wrap", "nowrap": "nowrap", "wrap-reverse": "wrap-reverse"}.items():
        sel = f".mz-flex-{name}"
        out.append(f"{sel} {{ flex-wrap: {val}; }}")
        add("flex", sel)
    for name, val in {"start": "flex-start", "center": "center", "end": "flex-end", "stretch": "stretch", "baseline": "baseline"}.items():
        sel = f".mz-items-{name}"
        out.append(f"{sel} {{ align-items: {val}; }}")
        add("flex", sel)
    for name, val in {"start": "flex-start", "center": "center", "end": "flex-end", "between": "space-between", "around": "space-around", "evenly": "space-evenly"}.items():
        sel = f".mz-justify-{name}"
        out.append(f"{sel} {{ justify-content: {val}; }}")
        add("flex", sel)
    for name, val in {"start": "flex-start", "center": "center", "end": "flex-end", "stretch": "stretch"}.items():
        sel = f".mz-content-{name}"
        out.append(f"{sel} {{ align-content: {val}; }}")
        add("flex", sel)
    for name, val in {"1": "1 1 0%", "auto": "1 1 auto", "initial": "0 1 auto", "none": "none"}.items():
        sel = f".mz-flex-{name}"
        out.append(f"{sel} {{ flex: {val}; }}")
        add("flex", sel)
    for i in range(0, 13):
        sel = f".mz-gap-{i}"
        out.append(f"{sel} {{ gap: {i * 0.25}rem; }}")
        add("flex", sel)
        selx = f".mz-gap-x-{i}"
        out.append(f"{selx} {{ column-gap: {i * 0.25}rem; }}")
        add("flex", selx)
        sely = f".mz-gap-y-{i}"
        out.append(f"{sely} {{ row-gap: {i * 0.25}rem; }}")
        add("flex", sely)
    for i in range(0, 6):
        sel = f".mz-order-{i}"
        out.append(f"{sel} {{ order: {i}; }}")
        add("flex", sel)
    out.append(".mz-order-first { order: -9999; }")
    add("flex", ".mz-order-first")
    out.append(".mz-order-last { order: 9999; }")
    add("flex", ".mz-order-last")
    out.append(".mz-grow { flex-grow: 1; }")
    add("flex", ".mz-grow")
    out.append(".mz-grow-0 { flex-grow: 0; }")
    add("flex", ".mz-grow-0")
    out.append(".mz-shrink { flex-shrink: 1; }")
    add("flex", ".mz-shrink")
    out.append(".mz-shrink-0 { flex-shrink: 0; }")
    add("flex", ".mz-shrink-0")
    for name, val in {"start": "flex-start", "center": "center", "end": "flex-end", "stretch": "stretch"}.items():
        sel = f".mz-self-{name}"
        out.append(f"{sel} {{ align-self: {val}; }}")
        add("flex", sel)
    return "\n".join(out) + "\n"

def gen_grid():
    out = ["/* MODZ CSS - CSS grid utilities */"]
    out.append(".mz-grid { display: grid; }")
    add("grid", ".mz-grid")
    out.append(".mz-inline-grid { display: inline-grid; }")
    add("grid", ".mz-inline-grid")
    for i in range(1, 13):
        sel = f".mz-grid-{i}"
        out.append(f"{sel} {{ grid-template-columns: repeat({i}, minmax(0, 1fr)); }}")
        add("grid", sel)
        rsel = f".mz-grid-rows-{i}"
        out.append(f"{rsel} {{ grid-template-rows: repeat({i}, minmax(0, 1fr)); }}")
        add("grid", rsel)
    for i in list(range(1, 13)):
        sel = f".mz-col-span-{i}"
        out.append(f"{sel} {{ grid-column: span {i} / span {i}; }}")
        add("grid", sel)
        rsel = f".mz-row-span-{i}"
        out.append(f"{rsel} {{ grid-row: span {i} / span {i}; }}")
        add("grid", rsel)
    out.append(".mz-col-span-full { grid-column: 1 / -1; }")
    add("grid", ".mz-col-span-full")
    out.append(".mz-grid-auto { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }")
    add("grid", ".mz-grid-auto")
    out.append(".mz-grid-responsive { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }")
    add("grid", ".mz-grid-responsive")
    out.append(".mz-grid-center { place-items: center; }")
    add("grid", ".mz-grid-center")
    out.append(".mz-grid-dense { grid-auto-flow: dense; }")
    add("grid", ".mz-grid-dense")
    out.append(".mz-grid-flow-col { grid-auto-flow: column; }")
    add("grid", ".mz-grid-flow-col")
    out.append(".mz-grid-flow-row { grid-auto-flow: row; }")
    add("grid", ".mz-grid-flow-row")
    for name, val in {"start": "start", "center": "center", "end": "end", "stretch": "stretch"}.items():
        sel = f".mz-place-{name}"
        out.append(f"{sel} {{ place-items: {val}; }}")
        add("grid", sel)
    return "\n".join(out) + "\n"

# ---------------------------------------------------------------------------
# backgrounds.css
# ---------------------------------------------------------------------------
def gen_backgrounds():
    out = ["/* MODZ CSS - background patterns (pure CSS gradients, no images) */"]
    patterns = {
        "bg-grid": "background-image: linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px); background-size: 24px 24px; opacity: .2;",
        "bg-dots": "background-image: radial-gradient(currentColor 1.5px, transparent 1.5px); background-size: 16px 16px; opacity: .25;",
        "bg-lines": "background-image: repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 1px, transparent 12px); opacity: .2;",
        "bg-stripes": "background-image: repeating-linear-gradient(45deg, var(--mz-purple-400) 0 10px, var(--mz-purple-600) 10px 20px);",
        "bg-checker": "background-image: linear-gradient(45deg, #0001 25%, transparent 25%, transparent 75%, #0001 75%), linear-gradient(45deg, #0001 25%, transparent 25%, transparent 75%, #0001 75%); background-size: 24px 24px; background-position: 0 0, 12px 12px;",
        "bg-aurora": "background: linear-gradient(120deg, var(--mz-purple-400), var(--mz-cyan-400), var(--mz-emerald-400), var(--mz-purple-400)); background-size: 300% 300%; animation: mz-aurora 8s ease infinite;",
        "bg-mesh": "background-image: radial-gradient(at 20% 20%, var(--mz-purple-400) 0, transparent 50%), radial-gradient(at 80% 0%, var(--mz-cyan-400) 0, transparent 50%), radial-gradient(at 0% 90%, var(--mz-pink-400) 0, transparent 50%), radial-gradient(at 80% 100%, var(--mz-emerald-400) 0, transparent 50%);",
        "bg-glow": "background: radial-gradient(circle at center, var(--mz-purple-400), transparent 70%);",
        "bg-noise": "background-image: repeating-conic-gradient(from 0deg, rgba(0,0,0,.02) 0deg 2deg, transparent 2deg 4deg); ",
        "bg-scanlines": "background-image: repeating-linear-gradient(0deg, rgba(0,0,0,.08) 0 1px, transparent 1px 3px);",
    }
    for name, css in patterns.items():
        sel = f".mz-{name}"
        out.append(f"{sel} {{ {css} }}")
        add("backgrounds", sel)
    for name, val in {"cover": "cover", "contain": "contain", "auto": "auto"}.items():
        sel = f".mz-bg-{name}"
        out.append(f"{sel} {{ background-size: {val}; }}")
        add("backgrounds", sel)
    for name, val in {"no-repeat": "no-repeat", "repeat": "repeat", "repeat-x": "repeat-x", "repeat-y": "repeat-y"}.items():
        sel = f".mz-bg-{name}"
        out.append(f"{sel} {{ background-repeat: {val}; }}")
        add("backgrounds", sel)
    return "\n".join(out) + "\n"

# ---------------------------------------------------------------------------
# images.css
# ---------------------------------------------------------------------------
def gen_images():
    out = ["/* MODZ CSS - image utilities */"]
    variants = {
        "img-rounded": "border-radius: var(--mz-radius-lg);",
        "img-circle": "border-radius: 50%;",
        "img-glow": "box-shadow: 0 0 16px var(--mz-purple-400);",
        "img-shadow": "box-shadow: var(--mz-shadow-lg);",
        "img-grayscale": "filter: grayscale(1);",
        "img-sepia": "filter: sepia(1);",
        "img-blur": "filter: blur(4px);",
        "img-bordered": "border: 3px solid #fff; box-shadow: var(--mz-shadow-md);",
        "img-cover": "object-fit: cover; width: 100%; height: 100%;",
        "img-contain": "object-fit: contain;",
    }
    for name, css in variants.items():
        sel = f".mz-{name}"
        out.append(f"{sel} {{ {css} }}")
        add("images", sel)
    hover_variants = {
        "img-hover-zoom": "transform: scale(1.08);",
        "img-hover-dark": "filter: brightness(.7);",
        "img-hover-bright": "filter: brightness(1.2);",
        "img-hover-grayscale": "filter: grayscale(1);",
        "img-hover-blur": "filter: blur(3px);",
    }
    for name, css in hover_variants.items():
        sel = f".mz-{name}"
        out.append(f"{sel} {{ transition: all var(--mz-duration-normal) var(--mz-ease); overflow: hidden; }}")
        out.append(f"{sel}:hover {{ {css} }}")
        add("images", sel)
    return "\n".join(out) + "\n"

# ---------------------------------------------------------------------------
# effects.css (special advanced CSS-only effects)
# ---------------------------------------------------------------------------
def gen_effects():
    out = ["/* MODZ CSS - special advanced CSS-only effects */"]
    effects = {
        "neon": "color:#fff; text-shadow: 0 0 5px #fff, 0 0 15px var(--mz-cyan-400), 0 0 30px var(--mz-cyan-500), 0 0 60px var(--mz-cyan-600);",
        "aurora-text": "background: linear-gradient(120deg, var(--mz-purple-400), var(--mz-cyan-400), var(--mz-emerald-400)); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent; animation: mz-gradient-move 4s ease infinite;",
        "liquid": "border-radius: 42% 58% 63% 37% / 41% 44% 56% 59%; animation: mz-blob-morph 8s ease-in-out infinite;",
        "shimmer": "background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.5) 50%, rgba(255,255,255,0) 100%); background-size: 200% 100%; animation: mz-shimmer 1.6s linear infinite;",
        "skeleton": "background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 37%, #e5e7eb 63%); background-size: 400% 100%; animation: mz-shimmer 1.4s ease infinite; border-radius: var(--mz-radius-md); color: transparent;",
        "scanline": "position: relative; overflow: hidden;",
        "cyberpunk": "background: #0d0221; color: #0ff; text-shadow: 2px 0 #f0f, -2px 0 #0ff; border: 1px solid #f0f; box-shadow: 0 0 10px #f0f, inset 0 0 10px #0ff;",
        "holographic": "background: linear-gradient(120deg, #ff9a9e, #fad0c4, #fbc2eb, #a18cd1, #84fab0, #8fd3f4); background-size: 300% 300%; animation: mz-gradient-move 6s ease infinite;",
        "chrome": "background: linear-gradient(180deg, #eee 0%, #999 45%, #ccc 55%, #444 100%); -webkit-background-clip: text; background-clip: text; color: transparent;",
        "metallic": "background: linear-gradient(135deg, #d7d7d7, #8f8f8f 45%, #fafafa 55%, #6b6b6b); -webkit-background-clip: text; background-clip: text; color: transparent;",
        "frosted": "background: rgba(255,255,255,.25); -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,.3);",
        "retro": "background: #2b1055; color: #ffde59; font-weight: 700; text-shadow: 3px 3px 0 #ff5f6d; border: 3px solid #ffde59;",
        "terminal": "background: #0a0a0a; color: #33ff33; font-family: 'Courier New', monospace; border: 1px solid #33ff33; padding: 1em;",
        "matrix": "background: #000; color: #0f0; font-family: monospace; text-shadow: 0 0 6px #0f0;",
        "light-sweep": "position: relative; overflow: hidden;",
    }
    for name, css in effects.items():
        sel = f".mz-{name}"
        out.append(f"{sel} {{ {css} }}")
        add("effects", sel)
    out.append("@keyframes mz-blob-morph { 0%,100% { border-radius: 42% 58% 63% 37% / 41% 44% 56% 59%; } 50% { border-radius: 63% 37% 30% 70% / 50% 45% 55% 50%; } }")
    out.append(".mz-scanline::after { content:''; position:absolute; inset:0; background: linear-gradient(transparent, rgba(255,255,255,.15), transparent); animation: mz-scanline 3s linear infinite; }")
    out.append(".mz-light-sweep::after { content:''; position:absolute; top:0; left:-60%; width:40%; height:100%; background: linear-gradient(120deg, transparent, rgba(255,255,255,.5), transparent); animation: mz-sweep 2.4s ease infinite; }")
    out.append("@keyframes mz-sweep { 0% { left:-60%; } 100% { left:130%; } }")
    # stars background
    stars = ".mz-bg-stars { background-image: radial-gradient(1px 1px at 20px 30px, #fff, transparent), radial-gradient(1px 1px at 60px 90px, #fff, transparent), radial-gradient(1.5px 1.5px at 130px 40px, #fff, transparent), radial-gradient(1px 1px at 90px 150px, #fff, transparent); background-size: 200px 200px; background-color: #05050f; }"
    out.append(stars)
    add("effects", ".mz-bg-stars")
    return "\n".join(out) + "\n"

# ---------------------------------------------------------------------------
# responsive.css
# ---------------------------------------------------------------------------
BREAKPOINTS = {"sm": "640px", "md": "768px", "lg": "1024px", "xl": "1280px", "2xl": "1536px"}

def gen_responsive():
    out = ["/* MODZ CSS - responsive variants (min-width media queries) */"]
    utilities = {
        "hidden": "display: none;",
        "block": "display: block;",
        "flex": "display: flex;",
        "grid": "display: grid;",
        "inline-block": "display: inline-block;",
        "text-center": "text-align: center;",
        "text-left": "text-align: left;",
        "text-right": "text-align: right;",
        "grid-1": "grid-template-columns: repeat(1, minmax(0, 1fr));",
        "grid-2": "grid-template-columns: repeat(2, minmax(0, 1fr));",
        "grid-3": "grid-template-columns: repeat(3, minmax(0, 1fr));",
        "grid-4": "grid-template-columns: repeat(4, minmax(0, 1fr));",
        "grid-6": "grid-template-columns: repeat(6, minmax(0, 1fr));",
        "flex-row": "flex-direction: row;",
        "flex-column": "flex-direction: column;",
        "w-full": "width: 100%;",
        "w-auto": "width: auto;",
    }
    for bp, width in BREAKPOINTS.items():
        out.append(f"@media (min-width: {width}) {{")
        for name, css in utilities.items():
            sel = f".mz-{bp}-{name}"
            out.append(f"  {sel} {{ {css} }}")
            add("responsive", sel)
        out.append("}")
    return "\n".join(out) + "\n"

# ---------------------------------------------------------------------------
# theme.css (dark/light, CSS-only)
# ---------------------------------------------------------------------------
def gen_theme():
    out = ["/* MODZ CSS - light/dark theming, CSS only (data-attribute or prefers-color-scheme) */"]
    out.append(".mz-light { --mz-bg: #ffffff; --mz-fg: #0f172a; background-color: var(--mz-bg); color: var(--mz-fg); }")
    add("theme", ".mz-light")
    out.append(".mz-dark { --mz-bg: #0b0b12; --mz-fg: #f1f5f9; background-color: var(--mz-bg); color: var(--mz-fg); }")
    add("theme", ".mz-dark")
    out.append("@media (prefers-color-scheme: dark) {")
    out.append("  .mz-auto-theme { --mz-bg: #0b0b12; --mz-fg: #f1f5f9; background-color: var(--mz-bg); color: var(--mz-fg); }")
    out.append("}")
    out.append("@media (prefers-color-scheme: light) {")
    out.append("  .mz-auto-theme { --mz-bg: #ffffff; --mz-fg: #0f172a; background-color: var(--mz-bg); color: var(--mz-fg); }")
    out.append("}")
    add("theme", ".mz-auto-theme")
    out.append(".mz-theme-purple { --mz-accent: var(--mz-purple-500); }")
    add("theme", ".mz-theme-purple")
    out.append(".mz-theme-blue { --mz-accent: var(--mz-blue-500); }")
    add("theme", ".mz-theme-blue")
    out.append(".mz-theme-cyan { --mz-accent: var(--mz-cyan-500); }")
    add("theme", ".mz-theme-cyan")
    out.append(".mz-theme-green { --mz-accent: var(--mz-green-500); }")
    add("theme", ".mz-theme-green")
    return "\n".join(out) + "\n"

# ---------------------------------------------------------------------------
# accessibility.css (cursor, select, pointer-events, visibility, reduced motion)
# ---------------------------------------------------------------------------
def gen_accessibility():
    out = ["/* MODZ CSS - accessibility & interaction-state utilities */"]
    cursors = ["pointer", "default", "none", "grab", "grabbing", "zoom-in", "zoom-out",
               "not-allowed", "wait", "text", "move", "crosshair", "help"]
    for c in cursors:
        sel = f".mz-cursor-{c}"
        out.append(f"{sel} {{ cursor: {c}; }}")
        add("accessibility", sel)
    for name, val in {"none": "none", "text": "text", "all": "all", "auto": "auto"}.items():
        sel = f".mz-select-{name}"
        out.append(f"{sel} {{ -webkit-user-select: {val}; user-select: {val}; }}")
        add("accessibility", sel)
    for name, val in {"none": "none", "auto": "auto"}.items():
        sel = f".mz-pointer-{name}"
        out.append(f"{sel} {{ pointer-events: {val}; }}")
        add("accessibility", sel)
    out.append(".mz-visible { visibility: visible; }")
    add("accessibility", ".mz-visible")
    out.append(".mz-invisible { visibility: hidden; }")
    add("accessibility", ".mz-invisible")
    out.append(".mz-collapse { visibility: collapse; }")
    add("accessibility", ".mz-collapse")
    out.append(".mz-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }")
    add("accessibility", ".mz-sr-only")
    out.append(".mz-not-sr-only { position: static; width: auto; height: auto; padding: 0; margin: 0; overflow: visible; clip: auto; white-space: normal; }")
    add("accessibility", ".mz-not-sr-only")
    out.append(".mz-focus-ring:focus-visible { outline: 2px solid var(--mz-purple-500); outline-offset: 2px; }")
    add("accessibility", ".mz-focus-ring")
    out.append("@media (prefers-reduced-motion: reduce) {")
    out.append("  .mz-motion-safe-only { animation: none !important; transition: none !important; }")
    out.append("}")
    add("accessibility", ".mz-motion-safe-only")
    return "\n".join(out) + "\n"

# ---------------------------------------------------------------------------
# Build order + concatenation
# ---------------------------------------------------------------------------
SECTIONS = [
    ("reset.css", gen_reset),
    ("variables.css", gen_variables),
    ("colors.css", gen_colors),
    ("shapes.css", gen_shapes),
    ("3d.css", gen_3d),
    ("glow.css", gen_glow),
    ("borders.css", gen_borders),
    ("radius.css", gen_radius),
    ("shadows.css", gen_shadows),
    ("glass.css", gen_glass),
    ("gradients.css", gen_gradients),
    ("typography.css", gen_typography),
    ("spacing.css", gen_spacing),
    ("sizing.css", gen_sizing),
    ("flex.css", gen_flex),
    ("grid.css", gen_grid),
    ("position.css", gen_position),
    ("display.css", gen_display),
    ("overflow.css", gen_overflow),
    ("transforms.css", gen_transforms),
    ("transitions.css", gen_transitions),
    ("animations.css", gen_animations),
    ("hover.css", gen_hover),
    ("filters.css", gen_filters),
    ("backgrounds.css", gen_backgrounds),
    ("images.css", gen_images),
    ("effects.css", gen_effects),
    ("aspect.css", gen_aspect),
    ("opacity.css", gen_opacity),
    ("responsive.css", gen_responsive),
    ("accessibility.css", gen_accessibility),
    ("theme.css", gen_theme),
]

def build():
    combined = ["/*!\n * MODZ CSS v1.0.0\n * A pure CSS, zero-JavaScript, zero-dependency utility + effects library.\n * https://modz-styles.vercel.app/modz.css\n * All classes are prefixed with `mz-` to avoid collisions.\n */\n"]
    for fname, fn in SECTIONS:
        content = fn()
        with open(os.path.join(SRC, fname), "w") as f:
            f.write(content)
        combined.append(f"/* ===== {fname} ===== */\n" + content)
    full = "\n".join(combined)
    with open(os.path.join(SRC, "modz.css"), "w") as f:
        f.write(full)
    with open(os.path.join(DIST, "modz.css"), "w") as f:
        f.write(full)

    # ---- minify (comment/whitespace strip; safe & simple, no external deps) ----
    minified = full
    minified = re.sub(r"/\*(?!!)[\s\S]*?\*/", "", minified)   # strip comments (keep /*! banner)
    banner_match = re.search(r"/\*!.*?\*/", full, re.S)
    banner = banner_match.group(0) if banner_match else ""
    minified = re.sub(r"/\*!.*?\*/", "", minified, flags=re.S)
    minified = re.sub(r"\s+", " ", minified)
    minified = re.sub(r"\s*([{}:;,])\s*", r"\1", minified)
    minified = re.sub(r";}", "}", minified)
    minified = minified.strip()
    minified = banner + "\n" + minified + "\n"
    with open(os.path.join(DIST, "modz.min.css"), "w") as f:
        f.write(minified)

    # dedupe check + count
    selectors = [s for s, _ in manifest]
    unique = set(selectors)
    dupes = len(selectors) - len(unique)

    with open(os.path.join(ROOT, "class-manifest.json"), "w") as f:
        json.dump([{"selector": s, "category": c} for s, c in manifest], f, indent=1)

    print(f"Total class entries counted: {len(selectors)}")
    print(f"Unique classes: {len(unique)}")
    print(f"Duplicate entries: {dupes}")
    print(f"dist/modz.css size: {os.path.getsize(os.path.join(DIST,'modz.css'))} bytes")
    print(f"dist/modz.min.css size: {os.path.getsize(os.path.join(DIST,'modz.min.css'))} bytes")

if __name__ == "__main__":
    build()
