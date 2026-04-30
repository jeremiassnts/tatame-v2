export function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays === 1) return "1 dia atrás";
  if (diffDays < 30) return `${diffDays} dias atrás`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "1 mês atrás";
  return `${diffMonths} meses atrás`;
}

export function formatAbsoluteDate(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate();
  const months = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${day} de ${month}, ${year} às ${hours}:${minutes}`;
}
