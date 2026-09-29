/**
 * CPF/CNPJ masking, shared by the payout-account onboarding and the Pix
 * payment screen. Extracted when the second caller appeared — a mask copied
 * into two files drifts, and this one is the difference between a document
 * Asaas accepts and one it rejects.
 */

export const onlyDigits = (value: string) => value.replace(/\D/g, "");

export const CPF_DIGITS = 11;
export const CNPJ_DIGITS = 14;

export function formatCpf(digits: string): string {
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

export function formatCnpj(digits: string): string {
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}
