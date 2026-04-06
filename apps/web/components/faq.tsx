"use client";

import { useState } from "react";
import { ChevronDown, MessageCircle } from "lucide-react";
import { AnimateOnScroll } from "./animate-on-scroll";

const faqItems = [
  {
    question: "Como funciona o período gratuito?",
    answer:
      "Você pode usar todas as funcionalidades do Tatame por 14 dias sem compromisso. Não pedimos cartão de crédito — basta criar sua conta, cadastrar sua academia e começar a usar. Ao final do período, escolha o plano que melhor se encaixa.",
  },
  {
    question: "Quantos alunos posso cadastrar?",
    answer:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
  },
  {
    question: "O app funciona no celular?",
    answer:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
  },
  {
    question: "Posso migrar dados de outro sistema?",
    answer:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
  },
  {
    question: "Como funciona o suporte?",
    answer:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
  },
  {
    question: "Preciso de conhecimento técnico para usar?",
    answer:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
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

export function Faq() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="px-6 py-16 md:px-20 md:py-[100px]">
      <div className="mx-auto max-w-[1440px]">
        <AnimateOnScroll className="flex flex-col items-center gap-16">
          {/* Header */}
          <div className="flex max-w-[700px] flex-col items-center gap-4">
            <h2 className="text-center font-[family-name:var(--font-sora)] text-[30px] font-extrabold tracking-[-1.5px] text-white md:text-[40px]">
              Perguntas frequentes
            </h2>
            <p className="text-center text-base leading-relaxed text-text-secondary md:text-lg md:leading-relaxed">
              Tire suas dúvidas sobre o Tatame e como ele pode ajudar sua
              academia.
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
              className="flex items-center gap-2.5 rounded-[14px] bg-whatsapp px-7 py-3.5 text-base font-semibold text-white transition-opacity hover:opacity-90"
            >
              <MessageCircle className="h-5 w-5" />
              Fale conosco pelo WhatsApp
            </a>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
