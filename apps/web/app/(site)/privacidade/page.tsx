import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description:
    "Política de Privacidade da plataforma Tatame — como coletamos, usamos e protegemos seus dados.",
  alternates: { canonical: "/privacidade" },
};

const sections = [
  {
    title: "1. Informações que coletamos",
    content:
      "Coletamos informações que você fornece diretamente ao criar sua conta e utilizar o Tatame, incluindo: nome, e-mail, telefone, dados da academia, informações de alunos (nome, faixa, dados de contato) e dados de pagamento. Também coletamos automaticamente informações de uso, como páginas acessadas, horários de acesso e tipo de dispositivo.",
  },
  {
    title: "2. Como usamos suas informações",
    content:
      "Utilizamos suas informações para: operar e manter a plataforma, processar pagamentos e assinaturas, enviar notificações relacionadas ao serviço, melhorar a experiência do usuário com base em padrões de uso, fornecer suporte ao cliente e garantir a segurança da plataforma.",
  },
  {
    title: "3. Compartilhamento de dados",
    content:
      "Não vendemos ou alugamos suas informações pessoais a terceiros. Podemos compartilhar dados com provedores de serviço que auxiliam na operação da plataforma, quando exigido por lei ou ordem judicial, e em caso de fusão, aquisição ou venda de ativos, com aviso prévio.",
  },
  {
    title: "4. Armazenamento e segurança",
    content:
      "Seus dados são armazenados em servidores seguros com criptografia em trânsito e em repouso. Implementamos medidas técnicas e organizacionais para proteger suas informações contra acesso não autorizado, alteração, divulgação ou destruição. Realizamos backups regulares e monitoramento contínuo da infraestrutura.",
  },
  {
    title: "5. Seus direitos",
    content:
      "De acordo com a LGPD, você tem direito a: acessar seus dados pessoais, corrigir dados incompletos ou desatualizados, solicitar a exclusão dos seus dados, revogar o consentimento a qualquer momento e solicitar a portabilidade dos dados. Para exercer esses direitos, entre em contato pelo e-mail contato@tatame.app.",
  },
  {
    title: "6. Cookies e rastreamento",
    content:
      "Utilizamos cookies essenciais para o funcionamento da plataforma e cookies analíticos para entender como você utiliza o serviço. Você pode gerenciar suas preferências de cookies a qualquer momento nas configurações do navegador. Não utilizamos cookies para publicidade direcionada.",
  },
  {
    title: "7. Contato",
    content:
      "Para dúvidas sobre esta política ou sobre o tratamento dos seus dados, entre em contato conosco pelo e-mail contato@tatame.app ou pelo nosso canal de suporte dentro da plataforma.",
  },
];

export default function Privacidade() {
  return (
    <>
    <Header />
    <main className="px-6 py-16 md:px-20 md:py-20">
      <div className="mx-auto max-w-[800px]">
        {/* Header */}
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-center font-[family-name:var(--font-sora)] text-[30px] font-extrabold tracking-[-1.5px] text-white md:text-[40px]">
            Política de Privacidade
          </h1>
          <p className="text-sm text-text-muted">
            Última atualização: 06 de abril de 2026
          </p>
        </div>

        {/* Divider */}
        <div className="my-12 h-px w-full bg-border" />

        {/* Sections */}
        <div className="flex flex-col gap-12">
          {sections.map((section) => (
            <div key={section.title} className="flex flex-col gap-3">
              <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold text-white md:text-[22px]">
                {section.title}
              </h2>
              <p className="text-base leading-[1.8] text-text-secondary">
                {section.content}
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
    <Footer />
    </>
  );
}
