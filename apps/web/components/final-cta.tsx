import Image from "next/image";
import { AnimateOnScroll } from "./animate-on-scroll";

function PlayStoreIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302a1 1 0 0 1 0 1.38l-2.302 2.302L15.396 13l2.302-2.492zM5.864 3.458L16.8 9.79l-2.302 2.303-8.635-8.635z" />
    </svg>
  );
}

export function FinalCta() {
  return (
    <section id="download" className="px-6 py-16 md:px-20 md:py-[100px]">
      <div className="mx-auto max-w-[1440px]">
        <AnimateOnScroll>
          <div className="flex flex-col items-center gap-8 rounded-3xl border border-primary/20 bg-gradient-to-b from-[#1A1030] to-[#2D1B4E] px-6 py-12 md:p-20">
            <h2 className="max-w-[700px] text-center font-[family-name:var(--font-sora)] text-[30px] font-extrabold leading-[1.2] tracking-[-1.5px] text-white md:text-[40px]">
              Pronto para transformar sua academia?
            </h2>
            <p className="max-w-[600px] text-center text-base leading-relaxed text-text-secondary md:text-lg md:leading-relaxed">
              Comece gratuitamente e veja a diferença em poucos dias. Sem cartão
              de crédito.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <a
                target="_blank"
                href="https://ios.apptatame.com.br"
                className="flex items-center gap-3 rounded-xl bg-white px-7 py-3.5 text-background transition-opacity hover:opacity-90"
              >
                <Image src="/apple.svg" alt="Apple" width={20} height={20} />
                <div className="flex flex-col">
                  <span className="text-[10px] leading-none">Baixar na</span>
                  <span className="text-sm font-semibold leading-tight">
                    App Store
                  </span>
                </div>
              </a>
              <a
                target="_blank"
                href="https://android.app.tatame.com.br"
                className="flex items-center gap-3 rounded-xl bg-white px-7 py-3.5 text-background transition-opacity hover:opacity-90"
              >
                <Image src="/google.svg" alt="Google Play" width={20} height={20} />
                <div className="flex flex-col">
                  <span className="text-[10px] leading-none">
                    Disponível no
                  </span>
                  <span className="text-sm font-semibold leading-tight">
                    Google Play
                  </span>
                </div>
              </a>
            </div>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
