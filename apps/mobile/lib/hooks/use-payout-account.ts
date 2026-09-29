import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreatePayoutAccountBody,
  UploadPayoutDocumentBody,
} from "@tatame/validators";
import { ApiError, useApi } from "@/lib/api";

/**
 * The academy's Asaas receiving account.
 *
 * Every route here is manager-only and derives the academy from the session,
 * so nothing in this file takes an academy id.
 */

export type PayoutAccountStatus =
  | "pending"
  | "awaiting_documents"
  | "under_review"
  | "approved"
  | "rejected"
  | "suspended";

/**
 * The account as the API exposes it — the whole row minus the sealed API key.
 * Timestamps arrive as ISO strings because they crossed JSON.
 */
export type PayoutAccount = {
  id: string;
  academyId: string;
  provider: string;
  externalAccountId: string;
  walletId: string;
  status: PayoutAccountStatus;
  /** The four areas Asaas reviews independently, as it reports them. */
  generalStatus: string | null;
  commercialInfoStatus: string | null;
  documentStatus: string | null;
  bankAccountInfoStatus: string | null;
  /** Set when Asaas refuses API uploads and the manager must finish on the web. */
  onboardingUrl: string | null;
  rejectionReason: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * A pending document group. `canUploadInApp` is not cosmetic: Asaas rejects an
 * API upload for any group carrying an `onboardingUrl`, so it is the difference
 * between showing a file picker and showing a link.
 */
export type PayoutAccountDocumentGroup = {
  id: string;
  status: string;
  type: string;
  title: string;
  description: string;
  onboardingUrl: string | null;
  canUploadInApp: boolean;
  documents: { id: string; status: string }[];
};

export type PayoutAccountDocuments = {
  rejectReasons: string | null;
  groups: PayoutAccountDocumentGroup[];
};

/** The Asaas rates the plan screen needs to explain what actually arrives. */
export type PayoutAccountFees = {
  pix: {
    fixedFee: number;
    percentageFee: number;
    minFee: number;
    maxFee: number;
    /** Pix credits that cost nothing each month, and how many are used. */
    monthlyFreeCredits: number;
    freeCreditsUsed: number;
  };
  creditCard: {
    operationFee: number;
    percentage: number;
    /** Card money is not immediate; the plan screen has to say how long. */
    daysToReceive: number;
  };
  fetchedAt: string;
};

export type CreatePayoutAccountInput = CreatePayoutAccountBody;

export type PayoutDocumentType = UploadPayoutDocumentBody["type"];

/** In React Native a picked file is this shape, never a web `File`. */
export type PayoutDocumentFile = {
  uri: string;
  name: string;
  type: string;
};

/**
 * Error codes the screens branch on. The API puts `details.code` into the
 * response `error` field, so they arrive as `ApiError.message`.
 */
export const PAYOUT_ACCOUNT_REQUIRED = "PAYOUT_ACCOUNT_REQUIRED";
export const FEES_UNAVAILABLE = "FEES_UNAVAILABLE";

/** Reads the code out of an unknown error without hiding anything else. */
export function isPayoutErrorCode(error: unknown, code: string): boolean {
  return error instanceof ApiError && error.message === code;
}

const accountKey = ["payout-account"];
const documentsKey = ["payout-account", "documents"];
const feesKey = ["payout-account", "fees"];

export function usePayoutAccount() {
  const api = useApi();

  return useQuery({
    queryKey: accountKey,
    queryFn: () =>
      api.get<{ account: PayoutAccount | null }>("/payout-account"),
    select: (data) => data.account,
  });
}

export function useCreatePayoutAccount() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreatePayoutAccountInput) =>
      api.post<{ account: PayoutAccount }>("/payout-account", body),
    onSuccess: (data) => {
      /*
        Written, not just invalidated. The dashboard card reads this same query
        to decide whether to offer onboarding, so by the time a manager reaches
        this form the cache already holds `account: null`. Invalidating marks
        that stale but keeps serving it until a refetch lands — and the
        documents screen we navigate to next redirects straight back here when
        it reads no account, landing the manager on an empty form seconds after
        Asaas e-mailed them about the account they just opened.

        The response carries the account that was created, so there is nothing
        to wait for.
      */
      queryClient.setQueryData(accountKey, data);
      // Exact, so a fresh account does not also refetch the fees — they are
      // platform-wide and a 503 there is not worth re-triggering here.
      queryClient.invalidateQueries({ queryKey: accountKey, exact: true });
      queryClient.invalidateQueries({ queryKey: documentsKey });
    },
  });
}

/**
 * Re-reads the live status from Asaas and persists it.
 *
 * A mutation rather than a query even though the route is a GET: it is fired at
 * chosen moments — pull to refresh, and once when the documents screen opens on
 * an account still mid-flight — it changes server state, and the codebase has no
 * manually-refetched query pattern. A disabled query would also fight the
 * 5-minute default `staleTime` on every mount.
 */
export function useRefreshPayoutAccountStatus() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      api.get<{ account: PayoutAccount }>("/payout-account/status"),
    onSuccess: (data) => {
      queryClient.setQueryData(accountKey, data);
      // A status move usually means the pending document groups changed too.
      queryClient.invalidateQueries({ queryKey: documentsKey });
    },
  });
}

export function usePayoutAccountDocuments(opts?: { enabled?: boolean }) {
  const api = useApi();

  return useQuery({
    queryKey: documentsKey,
    enabled: opts?.enabled ?? true,
    queryFn: () => api.get<PayoutAccountDocuments>("/payout-account/documents"),
  });
}

export function useUploadPayoutDocument() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      groupId,
      type,
      file,
    }: {
      groupId: string;
      type: PayoutDocumentType;
      file: PayoutDocumentFile;
    }) => {
      const formData = new FormData();
      formData.append("type", type);
      // React Native's FormData takes this object as the file part; the cast is
      // what `api.uploadImage` does for the same reason.
      formData.append("documentFile", {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as unknown as Blob);

      return api.post<{ document: { id: string; status: string } }>(
        `/payout-account/documents/${groupId}`,
        formData,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentsKey });
      // An accepted document can move the account to under_review.
      queryClient.invalidateQueries({ queryKey: accountKey, exact: true });
    },
  });
}

/** The server caches the rates for 12 hours, so there is nothing to gain by asking sooner. */
const FEES_STALE_TIME = 1000 * 60 * 60 * 12;

/**
 * The Asaas rates.
 *
 * Allowed to fail: the API answers 503 `FEES_UNAVAILABLE` when Asaas is
 * unreachable and the plan screen has to keep working without the numbers. So
 * a deliberate API answer is never retried — only a transport failure gets a
 * second chance — and the error is left on the query for the caller to read.
 */
export function usePayoutAccountFees(opts?: { enabled?: boolean }) {
  const api = useApi();

  return useQuery({
    queryKey: feesKey,
    enabled: opts?.enabled ?? true,
    queryFn: () => api.get<PayoutAccountFees>("/payout-account/fees"),
    staleTime: FEES_STALE_TIME,
    retry: (failureCount, error) => {
      if (error instanceof ApiError) return false;
      return failureCount < 1;
    },
  });
}
