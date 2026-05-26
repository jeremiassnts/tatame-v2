const PT_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function formatAnnouncementDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDate().toString().padStart(2, "0");
  const month = PT_MONTHS[d.getMonth()] ?? "";
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

export function formatShortAnnouncementDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDate().toString().padStart(2, "0");
  const month = PT_MONTHS[d.getMonth()] ?? "";
  return `${day} ${month}`;
}
