"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { adminFetch } from "@/lib/api";

export async function confirmTransfer(paymentIds: string[], academyId: string) {
  const { getToken } = await auth();
  const token = (await getToken()) ?? "";

  await adminFetch<{ updated: number }>("/payments/transfer", token, {
    method: "PATCH",
    body: JSON.stringify({ paymentIds }),
  });

  revalidatePath(`/admin/academies/${academyId}`);
  revalidatePath("/admin");
}
