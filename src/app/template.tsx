/** Пересоздаётся при каждом переходе — даёт мягкое появление страницы (см. .cfp-page в globals.css). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="cfp-page">{children}</div>;
}
