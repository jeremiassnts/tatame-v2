"use client";

import { ChevronDown } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { FaqJsonLd } from "../json-ld";
import { event as trackEvent } from "@/lib/gtag";

const faqItems = [
  {
    question: "Como funciona o período de teste?",
    answer:
      "Você usa o plano Pro completo por 30 dias, sem pagar nada. Se não gostar, é só cancelar — sem multa, sem burocracia.",
  },
  {
    question: "O app funciona no celular?",
    answer:
      "Sim. O Tatame é um app nativo, feito para funcionar direto no celular. Disponível no Google Play e na App Store.",
  },
  {
    question: "Posso migrar dados de outro sistema?",
    answer:
      "Ainda não temos migração automática, mas nosso time pode ajudar caso a caso. Fale conosco pelo WhatsApp e a gente resolve junto.",
  },
  {
    question: "Preciso de conhecimento técnico para usar?",
    answer:
      "Não. Se você sabe usar WhatsApp, sabe usar o Tatame. A interface foi feita para ser simples desde o primeiro acesso.",
  },
  {
    question: "Meus alunos podem pagar diretamente no app?",
    answer:
      "Sim. O aluno paga pelo app via Pix ou cartão, e o valor cai direto na sua conta através da chave Pix cadastrada.",
  },
];

function FaqItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <div className="h-px w-full bg-border" />
      <div className="py-6">
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="text-base font-semibold text-white md:text-lg">
            {question}
          </span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 transition-transform duration-300 ${
              isOpen ? "rotate-180 text-primary" : "text-text-muted"
            }`}
          />
        </button>
        <div
          className={`grid transition-all duration-300 ease-out ${
            isOpen
              ? "mt-4 grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <p className="text-base leading-[1.7] text-text-secondary">
              {answer}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export function FaqV2() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section id="duvidas" className="px-6 py-16 md:px-20 md:py-[100px]">
      <FaqJsonLd items={faqItems} />
      <div className="mx-auto max-w-[1440px]">
        <div className="flex flex-col items-center gap-16">
          {/* Header */}
          <div className="flex max-w-[700px] flex-col items-center gap-4">
            <h2 className="text-center font-[family-name:var(--font-sora)] text-[30px] font-extrabold tracking-[-1.5px] text-white md:text-[40px]">
              Perguntas frequentes
            </h2>
            <p className="text-center text-base leading-relaxed text-text-secondary md:text-lg md:leading-relaxed">
              O que donos de academia perguntam antes de começar.
            </p>
          </div>

          {/* FAQ List */}
          <div className="w-full max-w-[800px]">
            {faqItems.map((item, index) => (
              <FaqItem
                key={item.question}
                question={item.question}
                answer={item.answer}
                isOpen={openIndex === index}
                onToggle={() =>
                  setOpenIndex(openIndex === index ? -1 : index)
                }
              />
            ))}
            <div className="h-px w-full bg-border" />
          </div>

          {/* WhatsApp CTA */}
          <div className="flex flex-col items-center gap-5">
            <p className="text-base text-text-secondary">Ainda tem dúvidas?</p>
            <a
              href="https://wa.me/5579988566945?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20o%20app%20Tatame"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent("cta_whatsapp_click")}
              className="flex items-center gap-2.5 rounded-[14px] bg-whatsapp px-7 py-3.5 text-base font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Image src="/whatsapp.svg" alt="WhatsApp" width={20} height={20} />
              Fale conosco pelo WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
