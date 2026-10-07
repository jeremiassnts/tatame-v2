"use client";

import { ChevronDown } from "lucide-react";
import Image from "next/image";
import * as motion from "motion/react-client";
import { useState } from "react";
import { FaqJsonLd } from "../json-ld";
import { event as trackEvent } from "@/lib/gtag";
import { fadeUp, transition } from "@/lib/animations";

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
      "Sim. O aluno paga a mensalidade pelo app via Pix e o valor cai na conta de recebimento da sua academia, descontada a tarifa da transação. Você saca para a sua conta bancária quando quiser. O Tatame não retém nada do que o seu aluno paga.",
  },
  {
    question: "Preciso fazer algum cadastro para receber os pagamentos dos alunos?",
    answer:
      "Sim. O Tatame abre para você uma conta de recebimento no Asaas, nosso parceiro de pagamentos. Você informa os dados da academia, envia os documentos pelo Asaas e, assim que a conta é aprovada, seus alunos já podem pagar pelo app. Enquanto a aprovação não sai, você registra os pagamentos manualmente e nada deixa de ser controlado.",
  },
];

function FaqItem({
  question,
  answer,
  isOpen,
  onToggle,
  id,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
  id: string;
}) {
  return (
    <>
      <div className="h-px w-full bg-border" />
      <div className="py-6">
        <button
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={`faq-panel-${id}`}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="text-base font-semibold text-white md:text-lg">
            {question}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`h-5 w-5 shrink-0 transition-transform duration-300 ${
              isOpen ? "rotate-180 text-primary" : "text-text-muted"
            }`}
          />
        </button>
        <div
          id={`faq-panel-${id}`}
          role="region"
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
          <motion.div
            className="flex max-w-[700px] flex-col items-center gap-4"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ margin: "-80px" }}
            transition={transition}
          >
            <h2 className="text-center font-sora text-[30px] font-extrabold tracking-[-1.5px] text-white md:text-[40px]">
              Perguntas frequentes
            </h2>
            <p className="text-center text-base leading-relaxed text-text-secondary md:text-lg md:leading-relaxed">
              O que donos de academia perguntam antes de começar.
            </p>
          </motion.div>

          {/* FAQ List */}
          <motion.div
            className="w-full max-w-[800px]"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ margin: "-80px" }}
            transition={{ ...transition, delay: 0.15 }}
          >
            {faqItems.map((item, index) => (
              <FaqItem
                key={item.question}
                id={String(index)}
                question={item.question}
                answer={item.answer}
                isOpen={openIndex === index}
                onToggle={() =>
                  setOpenIndex(openIndex === index ? -1 : index)
                }
              />
            ))}
            <div className="h-px w-full bg-border" />
          </motion.div>

          {/* WhatsApp CTA */}
          <motion.div
            className="flex flex-col items-center gap-5"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ margin: "-80px" }}
            transition={{ ...transition, delay: 0.3 }}
          >
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
          </motion.div>
        </div>
      </div>
    </section>
  );
}
