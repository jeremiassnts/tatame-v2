/**
 * The API's failures, in a module that imports nothing.
 *
 * Split out of `lib/api.ts` by TAT-191 so that code deciding *what to say*
 * about a failure can be proven without it. `lib/api.ts` imports
 * `@clerk/clerk-expo` for `useApi`, which imports `react-native`, which cannot
 * load in `apps/mobile`'s `environment: "node"` test harness - so an
 * `instanceof ApiError` check reached through that file is a check no test can
 * run. `lib/api.ts` re-exports this, and every existing
 * `import { ApiError } from "@/lib/api"` is unchanged.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    /**
     * The API's `error` field. When the failure carries a code the server puts
     * the code here, which is why call sites match on it — `PLAN_LIMIT_*`,
     * `PAYOUT_ACCOUNT_REQUIRED`. It is an identifier, not something to show.
     */
    message: string,
    /**
     * The API's human sentence, when it sent one. A coded failure overwrites
     * `message` with its code, so without this the prose is simply lost — and
     * for Asaas that prose is the whole value: it says which field the Receita
     * refused, in Portuguese, and no wording invented here can replace it.
     */
    public readonly detail?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
