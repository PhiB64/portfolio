export function SectionTitle({ kicker, title }) {
  return (
    <div className="mb-8">
      <p className="text-sm font-medium tracking-wide text-slate-300">
        {kicker}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        {title}
      </h2>
    </div>
  );
}
