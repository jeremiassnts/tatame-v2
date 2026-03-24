import { useMutation } from "@tanstack/react-query";
import { useApi } from "@/lib/api";

export function useUploadImage() {
  const api = useApi();

  return useMutation({
    mutationFn: (file: { uri: string; type: string; name: string }) =>
      api.uploadImage(file),
  });
}
