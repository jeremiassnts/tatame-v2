import { revalidatePath } from "next/cache";
import { adminFetch } from "@/lib/api";

export async function confirmTransfer(paymentIds: string[]): Promise<void> {
  await adminFetch<{ updated: number }>("/payments/transfer", {
    method: "PATCH",
    body: JSON.stringify({ paymentIds }),
  });
  revalidatePath("/admin");
}
