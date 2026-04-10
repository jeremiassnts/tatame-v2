import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de Uso — Tatame",
  description: "Termos de Uso da plataforma Tatame.",
};

const sections = [
  {
    title: "1. Aceitação dos termos",
    content:
      "Ao acessar e utilizar a plataforma Tatame, você concorda com estes Termos de Uso e com nossa Política de Privacidade. Se você não concordar com qualquer parte destes termos, não utilize o serviço. O uso continuado da plataforma constitui aceitação de quaisquer alterações feitas a estes termos.",
  },
  {
    title: "2. Descrição do serviço",
    content:
      "O Tatame é uma plataforma de gestão para academias de artes marciais que oferece ferramentas de controle de alunos, agenda de aulas, check-in de presença, gestão financeira e graduações. O serviço é oferecido através de aplicativo móvel e painel web, mediante assinatura mensal ou anual.",
  },
  {
    title: "3. Cadastro e conta",
    content:
      "Para utilizar o Tatame, você deve criar uma conta fornecendo informações verdadeiras e completas. Você é responsável por manter a confidencialidade das suas credenciais de acesso e por todas as atividades realizadas sob sua conta. Notifique-nos imediatamente caso suspeite de uso não autorizado.",
  },
  {
    title: "4. Planos e pagamentos",
    content:
      'Os preços dos planos estão disponíveis em nosso site e podem ser alterados com aviso prévio de 30 dias. A cobrança é recorrente conforme o ciclo escolhido (mensal ou anual). O cancelamento pode ser feito a qualquer momento, mantendo o acesso até o final do período já pago. Não realizamos reembolsos proporcionais.',
  },
  {
    title: "5. Uso aceitável",
    content:
      "Você concorda em utilizar o Tatame apenas para fins legítimos relacionados à gestão da sua academia. É proibido: utilizar o serviço para atividades ilegais, tentar acessar dados de outros usuários, realizar engenharia reversa da plataforma, transmitir vírus ou código malicioso, e revender ou sublicenciar o acesso ao serviço.",
  },
  {
    title: "6. Propriedade intelectual",
    content:
      "Todo o conteúdo da plataforma Tatame, incluindo design, código, marcas e textos, é de propriedade exclusiva do Tatame ou de seus licenciadores. Os dados inseridos por você na plataforma permanecem de sua propriedade. Concedemos a você uma licença limitada, não exclusiva e revogável para uso da plataforma conforme estes termos.",
  },
  {
    title: "7. Limitação de responsabilidade",
    content:
      'O Tatame é fornecido "como está". Não garantimos que o serviço será ininterrupto ou livre de erros. Em nenhuma hipótese seremos responsáveis por danos indiretos, incidentais ou consequenciais decorrentes do uso da plataforma. Nossa responsabilidade total está limitada ao valor pago por você nos últimos 12 meses.',
  },
  {
    title: "8. Contato",
    content:
      "Para dúvidas sobre estes termos, entre em contato pelo e-mail contato@tatame.app ou pelo nosso canal de suporte dentro da plataforma.",
  },
];

export default function Termos() {
  return (
    <main className="px-6 py-16 md:px-20 md:py-20">
      <div className="mx-auto max-w-[800px]">
        {/* Header */}
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-center font-[family-name:var(--font-sora)] text-[30px] font-extrabold tracking-[-1.5px] text-white md:text-[40px]">
            Termos de Uso
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
  );
}
