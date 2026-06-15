const advantages = [
  {
    title: "Chega de caderninho",
    description:
      "Substitua papel, planilhas e grupos de WhatsApp por um sistema feito pra sua academia.",
  },
  {
    title: "Tudo em um lugar só",
    description:
      "Agenda, financeiro, graduações e membros em um único app. Sem precisar de 5 ferramentas diferentes.",
  },
  {
    title: "Seus alunos também usam",
    description:
      "Alunos fazem check-in, acompanham graduações e pagam pelo app. Menos trabalho pra você.",
  },
  {
    title: "Pronto pra usar em minutos",
    description:
      "Sem treinamento, sem integração complicada. Crie sua conta e comece a gerenciar hoje.",
  },
];

function ImagePlaceholder({ label }: { label: string }) {
  return (
    <div className="flex aspect-video w-full items-center justify-center rounded-2xl border-2 border-dashed border-border-light bg-background">
      <span className="text-sm text-text-muted">{label}</span>
    </div>
  );
}

export function Advantages() {
  return (
    <section className="px-6 py-16 md:px-20 md:py-[100px]">
      <div className="mx-auto max-w-[1440px]">
        {/* Section header */}
        <div className="mb-16 flex flex-col items-center gap-4">
          <h2 className="text-center font-[family-name:var(--font-sora)] text-[30px] font-extrabold tracking-[-1.5px] text-white md:text-[44px]">
            Por que escolher o Tatame
          </h2>
          <p className="max-w-[600px] text-center text-base leading-relaxed text-text-secondary md:text-lg">
            Feito por quem entende a rotina de uma academia de Jiu-Jitsu.
          </p>
        </div>

        {/* 2x2 grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {advantages.map((item, index) => (
            <div
              key={item.title}
              className="flex flex-col gap-6 rounded-[20px] border border-border bg-surface p-8"
            >
              <h3 className="font-[family-name:var(--font-sora)] text-xl font-bold text-white">
                {item.title}
              </h3>
              <p className="text-[15px] leading-relaxed text-text-secondary">
                {item.description}
              </p>
              <ImagePlaceholder label={`Imagem vantagem ${index + 1}`} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
