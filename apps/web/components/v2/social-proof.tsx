export function SocialProof() {
  const academies = [
    { name: "Fighter's BJJ" },
    { name: "Academia 2" },
  ];

  return (
    <section className="border-t border-border px-6 py-10 md:px-20">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-6">
        <p className="text-sm font-medium text-text-muted">
          Academias que já usam o Tatame
        </p>
        <div className="flex items-center gap-8">
          {academies.map((academy) => (
            <span
              key={academy.name}
              className="font-[family-name:var(--font-sora)] text-lg font-semibold text-white"
            >
              {academy.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
