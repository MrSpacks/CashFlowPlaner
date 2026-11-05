/** Скелет экрана — показывается сразу при переходе, пока сервер готовит страницу. */
export default function Loading() {
  return (
    <div className="space-y-3 px-4 pt-6" aria-busy="true">
      <div className="cfp-skeleton h-8 w-40" />
      <div className="cfp-skeleton h-4 w-64" />
      <div className="cfp-skeleton mt-4 h-28 w-full" />
      <div className="cfp-skeleton h-28 w-full" />
      <div className="cfp-skeleton h-28 w-full" />
    </div>
  );
}
