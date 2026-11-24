import { CATEGORIES, CATEGORY_ICON } from "@/lib/categories";
import type { Dict } from "@/i18n/dictionaries";

/** Выбор категории чипами (радиокнопки, без JS). */
export default function CategoryPicker({ t, defaultValue = "food" }: { t: Dict["cat"]; defaultValue?: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CATEGORIES.map((c) => (
        <label key={c} className="cursor-pointer">
          <input type="radio" name="category" value={c} defaultChecked={c === defaultValue} className="peer sr-only" />
          <span className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm ring-1 ring-slate-200 peer-checked:bg-emerald-600 peer-checked:text-white peer-checked:ring-emerald-600">
            {CATEGORY_ICON[c]} {t[c]}
          </span>
        </label>
      ))}
    </div>
  );
}
