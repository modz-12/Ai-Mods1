#!/usr/bin/env python3
import json, re, os

ROOT = "."
css = open(os.path.join(ROOT, "dist", "modz.css")).read()
manifest = json.load(open(os.path.join(ROOT, "class-manifest.json")))

# Map every ".mz-xxxx { ... }" occurrence (top-level or inside a media block) to its rule body.
pattern = re.compile(r'(\.(?:mz|--mz)[\w-]*(?:,\s*\.(?:mz|--mz)[\w-]*)*)\s*\{([^{}]*)\}')
rule_map = {}
for m in pattern.finditer(css):
    selectors_part = m.group(1)
    body = m.group(2).strip()
    body = re.sub(r'\s+', ' ', body)
    for sel in selectors_part.split(','):
        sel = sel.strip()
        if sel not in rule_map:
            rule_map[sel] = body
        else:
            rule_map[sel] += "; " + body

entries = []
seen = set()
for item in manifest:
    sel = item["selector"]
    if sel in seen:
        continue
    seen.add(sel)
    cls = sel.lstrip(".")
    css_rule = rule_map.get(sel, "")
    entries.append({
        "class": cls,
        "category": item["category"],
        "css": css_rule
    })

# category display metadata
CATEGORY_LABELS = {
    "colors": "الألوان (Colors)",
    "shapes": "الأشكال الهندسية (Shapes)",
    "3d": "أشكال 3D",
    "glow": "الإضاءة والتوهج (Glow)",
    "borders": "الحدود (Borders)",
    "radius": "الاستدارة (Radius)",
    "shadows": "الظلال (Shadows)",
    "glass": "زجاجية (Glassmorphism)",
    "gradients": "التدرجات (Gradients)",
    "typography": "الطباعة (Typography)",
    "spacing": "المسافات (Spacing)",
    "sizing": "الأبعاد (Width/Height)",
    "flex": "Flexbox",
    "grid": "Grid",
    "position": "الموضع (Position)",
    "display": "العرض (Display)",
    "overflow": "Overflow",
    "transforms": "التحويلات (Transforms)",
    "transitions": "الانتقالات (Transitions)",
    "animations": "الحركات (Animations)",
    "hover": "تأثيرات Hover",
    "filters": "الفلاتر (Filters)",
    "backgrounds": "الخلفيات (Backgrounds)",
    "images": "الصور (Images)",
    "effects": "تأثيرات خاصة (Special Effects)",
    "aspect": "أبعاد الصورة (Aspect / Object-fit)",
    "opacity": "الشفافية (Opacity)",
    "responsive": "متجاوب (Responsive)",
    "accessibility": "إتاحة الوصول (Accessibility)",
    "theme": "الثيمات (Dark/Light Theme)",
    "reset": "Reset أساسي",
}

counts = {}
for e in entries:
    counts[e["category"]] = counts.get(e["category"], 0) + 1

categories = [{"id": k, "label": CATEGORY_LABELS.get(k, k), "count": v} for k, v in counts.items()]
categories.sort(key=lambda c: -c["count"])

out = {"total": len(entries), "categories": categories, "classes": entries}
with open(os.path.join(ROOT, "public", "docs-data.json"), "w") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

print("Total documented classes:", len(entries))
print("Categories:", len(categories))
