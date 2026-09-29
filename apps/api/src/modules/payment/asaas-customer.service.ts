import type { AsaasClient } from "../../lib/asaas.js";
import { HttpError } from "../../lib/http-error.js";
import type { IUserRepository } from "../user/user.repository.js";

/**
 * The student as Asaas knows them.
 *
 * Asaas keys a charge to a customer, so before any charge exists the student
 * has to exist there too. The id is stored on `users.asaas_customer_id` and
 * reused forever after — which is the whole reason the document is only ever
 * asked for once.
 *
 * **The document is not stored here.** Asaas creates a customer with a name
 * alone but refuses to charge one without a CPF/CNPJ ("Para criar esta cobrança
 * é necessário preencher o CPF ou CNPJ do cliente", sandbox, 2026-09-29), so it
 * is required to create — typed by the student on the payment screen, sent
 * straight through, and kept only by Asaas. This is the same decision the
 * design took for the manager's onboarding form: the platform stores no
 * document.
 */

/** Injected so unit tests never reach the network. `AsaasClient` satisfies it. */
export interface AsaasRootClientFactory {
  root(): AsaasClient;
}

export interface EnsureAsaasCustomerInput {
  /**
   * Required only when the customer has to be created. A student who already
   * has one — or whose orphaned customer is recovered below — is never asked.
   */
  cpfCnpj?: string;
}

function normalizeDocument(cpfCnpj: string | undefined): string | undefined {
  const digits = (cpfCnpj ?? "").replace(/\D/g, "");
  return digits.length > 0 ? digits : undefined;
}

export class AsaasCustomerService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly asaas: AsaasRootClientFactory,
  ) {}

  /** The Asaas customer id for this student, creating one if necessary. */
  async ensureCustomer(
    userId: string,
    input: EnsureAsaasCustomerInput = {},
  ): Promise<string> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new HttpError(404, "Usuário não encontrado");
    if (user.asaasCustomerId) return user.asaasCustomerId;

    const client = this.asaas.root();

    // The charge that created the customer may have failed before the id was
    // written. Creating a second customer would work, but it scatters one
    // student's charges across two of them at Asaas for no reason. Costs one
    // GET, and only ever on a student's first charge.
    const existing = await client.findCustomerByExternalReference(userId);
    if (existing) {
      await this.userRepo.updateAsaasCustomerId(userId, existing.id);
      return existing.id;
    }

    const cpfCnpj = normalizeDocument(input.cpfCnpj);
    if (!cpfCnpj) {
      throw new HttpError(
        400,
        "Informe o CPF ou CNPJ para gerar a cobrança",
        { code: "CPF_REQUIRED" },
      );
    }

    const customer = await client.createCustomer({
      name: user.name,
      email: user.email,
      cpfCnpj,
      // Our own id, so the recovery lookup above has something to find.
      externalReference: userId,
      // The app already notifies the student and e-mails the confirmation from
      // the payment webhook; Asaas billing the same student in parallel, in
      // wording we do not control, is noise.
      notificationDisabled: true,
    });

    await this.userRepo.updateAsaasCustomerId(userId, customer.id);
    return customer.id;
  }
}
