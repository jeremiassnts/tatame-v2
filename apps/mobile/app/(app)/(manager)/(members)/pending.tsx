import { PendingRequestCard } from "@/components/PendingRequestCard";
import { useAcademyContext } from "@/lib/academy-context";
import {
  useApproveMembership,
  usePendingRequests,
  useRejectMembership,
} from "@/lib/hooks/use-membership";
import { queryClient } from "@/lib/query-client";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#ABABAB";
const TEXT_MUTED = "#525252";

function toDateLabel(value: Date | string) {
  if (value instanceof Date) return value.toISOString();
  return value;
}

export default function PendingRequestsScreen() {
  const router = useRouter();
  const { academyId } = useAcademyContext();
  const { data: pending, isPending } = usePendingRequests(academyId);
  const approveMutation = useApproveMembership();
  const rejectMutation = useRejectMembership();

  async function approveMembership(membershipId: string) {
    await approveMutation.mutateAsync(membershipId);
    onMembershipChange();
  }

  async function rejectMembership(membershipId: string) {
    await rejectMutation.mutateAsync(membershipId);
    onMembershipChange();
  }

  function onMembershipChange() {
    void queryClient.invalidateQueries({ queryKey: ["pending-requests"] });
    void queryClient.invalidateQueries({ queryKey: ["members"] });
    void queryClient.invalidateQueries({ queryKey: ["academy-stats"] });
  }

  const count = pending?.length ?? 0;
  const isMutating = approveMutation.isPending || rejectMutation.isPending;

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
      <View className="flex-1" style={{ paddingHorizontal: 24, paddingTop: 8, gap: 16 }}>
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface"
          >
            <ArrowLeft size={18} color="#FFFFFF" />
          </Pressable>
          <Text className="font-poppins-bold text-lg text-primary">
            Solicitações pendentes
          </Text>
          <View className="h-10 w-10" />
        </View>

        {count > 0 && <Text className="font-poppins text-sm" style={{ color: TEXT_SECONDARY }}>
          {count} solicitaç{count === 1 ? "ão" : "ões"} pendente{count === 1 ? "" : "s"}
        </Text>}

        {isPending ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#A078E8" />
          </View>
        ) : (
          <FlatList
            data={pending ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: 14, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <PendingRequestCard
                name={item.userName}
                role={item.role}
                createdAt={toDateLabel(item.createdAt)}
                onApprove={() => approveMembership(item.id)}
                onReject={() => rejectMembership(item.id)}
                isLoading={isMutating}
              />
            )}
            ListEmptyComponent={
              <View className="items-center py-12">
                <Text className="font-poppins text-sm" style={{ color: TEXT_MUTED }}>
                  Nenhuma solicitação pendente
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
