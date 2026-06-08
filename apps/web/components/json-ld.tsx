export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Tatame",
    url: "https://apptatame.com.br",
    logo: "https://apptatame.com.br/icon.png",
    contactPoint: {
      "@type": "ContactPoint",
      email: "contato@tatame.app",
      contactType: "customer service",
      availableLanguage: "Portuguese",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function SoftwareApplicationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Tatame",
    applicationCategory: "BusinessApplication",
    operatingSystem: "iOS, Android",
    description:
      "Plataforma de gestão para academias de Jiu-Jitsu. Gerencie turmas, presenças, graduações e pagamentos.",
    offers: {
      "@type": "Offer",
      price: "49.00",
      priceCurrency: "BRL",
      description: "Plano Pro — 30 dias grátis",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function FaqJsonLd({
  items,
}: {
  items: { question: string; answer: string }[];
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
