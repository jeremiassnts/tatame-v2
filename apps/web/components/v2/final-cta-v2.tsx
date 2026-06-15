import { ButtonColorful } from "../ui/button-colorful";

export function FinalCtaV2() {
  return (
    <section className="px-6 py-16 md:px-20 md:py-[100px]">
      <div className="mx-auto max-w-[1440px]">
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-[#110B1E] px-6 py-12 md:px-20 md:py-20">
          {/* Purple glow on the right */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-[500px] w-[500px] rounded-full bg-primary/25 blur-[120px]" />

          <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            {/* Left: text + CTA */}
            <div className="flex flex-col gap-6 md:max-w-[50%]">
              <h2 className="font-[family-name:var(--font-sora)] text-[30px] font-extrabold leading-[1.2] tracking-[-1.5px] text-white md:text-[40px]">
                Sua academia merece mais do que uma planilha
              </h2>
              <p className="max-w-[480px] text-base leading-relaxed text-[#d6d6d6] md:text-lg md:leading-relaxed">
                Teste o Tatame por 30 dias sem pagar nada. Cancele quando quiser.
              </p>
              <ButtonColorful
                href="#precos"
                eventName="cta_final_click"
                label="Criar minha academia grátis"
                className="w-fit"
              />
            </div>

            {/* Right: placeholder for app screenshot */}
            <div className="hidden md:block md:w-[45%]">
              <div className="aspect-[3/4] w-full max-w-[320px] ml-auto rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
