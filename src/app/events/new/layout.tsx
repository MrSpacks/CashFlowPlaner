/** На компьютере формы и списки — в удобной узкой колонке. */
export default function NarrowLayout({ children }: { children: React.ReactNode }) {
  return <div className="lg:max-w-2xl">{children}</div>;
}
