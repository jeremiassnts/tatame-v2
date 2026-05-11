import Image from "next/image";
import { Rocket } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-[#0C0C0C]">
      {/* Header */}
      <header className="flex h-20 items-center px-6 md:px-20">
        <div className="flex items-center gap-3">
          <Image src="/icon.png" alt="Tatame" width={25} height={25} />
          <span className="font-[family-name:var(--font-sora)] text-[22px] font-bold tracking-tight text-white">
            TATAME
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center gap-8 px-6 md:gap-10 md:px-20">
        {/* Badge */}
        <div className="flex items-center gap-2 rounded-full bg-[#A078E820] px-5 py-2 md:gap-2">
          <Rocket size={14} className="text-[#A078E8] md:h-4 md:w-4" />
          <span className="text-[11px] font-bold tracking-[2px] text-[#A078E8] md:text-xs">
            EM BREVE
          </span>
        </div>

        {/* Text */}
        <div className="flex flex-col items-center gap-4 md:gap-5">
          <h1 className="max-w-[700px] text-center font-[family-name:var(--font-sora)] text-4xl font-extrabold leading-[1.1] tracking-[-1.5px] text-white md:text-[56px] md:tracking-[-2px]">
            Algo incrível está{"\n"}a caminho
          </h1>
          <p className="max-w-[700px] text-center text-[15px] leading-[1.5] text-[#ABABAB] md:text-lg md:leading-[1.6]">
            Estamos construindo a plataforma completa para gestão de academias
            de Jiu-Jitsu. Cadastre-se para ser notificado quando lançarmos.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="flex items-center justify-center border-t border-[#2A2A2A] px-6 py-4 md:px-20 md:py-5">
        <span className="text-[10px] text-[#525252] md:text-xs">
          © 2026 Tatame. Todos os direitos reservados.
        </span>
      </footer>
    </main>
  );
}
