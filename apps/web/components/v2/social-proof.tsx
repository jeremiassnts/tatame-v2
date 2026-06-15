import Image from "next/image";

export function SocialProof() {
  const academies = [
    { name: "Fighter's BJJ", logo: null },
    { name: "Academia 2", logo: null },
  ];

  return (
    <section className="px-6 py-12 md:px-20">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-8">
        <p className="text-base font-medium text-text-secondary">
          Academias que já usam o Tatame
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {academies.map((academy) => (
            <div
              key={academy.name}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-6 py-4"
            >
              {academy.logo ? (
                <Image
                  src={academy.logo}
                  alt={academy.name}
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/[0.125]">
                  <span className="font-[family-name:var(--font-sora)] text-sm font-bold text-primary">
                    {academy.name.charAt(0)}
                  </span>
                </div>
              )}
              <span className="font-[family-name:var(--font-sora)] text-base font-semibold text-white">
                {academy.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
