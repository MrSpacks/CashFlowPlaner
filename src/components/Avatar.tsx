const COLORS = ["bg-emerald-500", "bg-sky-500", "bg-amber-500", "bg-rose-500", "bg-pink-500", "bg-slate-400"];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function colorFor(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

/** Аватарка: фото или цветной кружок с инициалами. */
export default function Avatar({
  name,
  src,
  seed,
  size = 40,
  className = "",
}: {
  name: string;
  src?: string | null;
  seed?: string;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} width={size} height={size} style={style} className={`shrink-0 rounded-full object-cover ${className}`} />;
  }
  return (
    <span
      style={style}
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${colorFor(seed ?? name)} ${className}`}
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}
