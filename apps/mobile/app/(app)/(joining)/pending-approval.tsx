import { SignOutButton } from "@/components/SignOutButton";
import { useCancelMembership } from "@/lib/hooks/use-membership";
import { useCurrentUser } from "@/lib/hooks/use-user";
import { useRouter } from "expo-router";
import { Clock3 } from "lucide-react-native";
import { Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#ABABAB";

export default function PendingApprovalScreen() {
  const { data: user } = useCurrentUser();
  const router = useRouter();
  const cancelMembership = useCancelMembership();

  const academyName = user?.activeMembership?.academyName ?? "Alliance Centro";
  const isStudent = user?.activeRole === "student";

  const subtitle = isStudent
    ? `Sua solicitação para entrar em ${academyName} foi enviada. O gestor da academia irá avaliar seu pedido para liberar seu acesso como aluno.`
    : `Sua solicitação para entrar em ${academyName} foi enviada. O gestor da academia irá avaliar seu pedido.`;

  const handleCancelMembership = () => {
    Alert.alert(
      "Cancelar solicitação",
      "Deseja realmente cancelar sua solicitação de entrada?",
      [
        { text: "Não", style: "cancel" },
        {
          text: "Sim, cancelar",
          style: "destructive",
          onPress: () => {
            cancelMembership.mutate(undefined, {
              onSuccess: () => {
                router.replace("/(app)/(joining)/search-academy");
              },
              onError: () => {
                Alert.alert("Erro", "Não foi possível cancelar a solicitação. Tente novamente.");
              },
            });
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background py-4" edges={["top", "bottom"]}>
      <View className="flex-1" style={{ paddingHorizontal: 24, paddingTop: 8, gap: 24 }}>
        <View className="flex-1" />

        <View className="items-center" style={{ gap: 24 }}>
          <View className="h-24 w-24 items-center justify-center rounded-full bg-accent-translucent">
            <Clock3 size={30} color="#A078E8" />
          </View>

          <View className="items-center" style={{ gap: 12 }}>
            <Text className="font-poppins-bold text-[30px] leading-[42px] text-primary text-center">
              Aguardando aprovação
            </Text>
            <Text
              className="text-center font-poppins text-sm"
              style={{ color: TEXT_SECONDARY, lineHeight: 22 }}
            >
              {subtitle}
            </Text>
          </View>

          <View
            className="flex-row items-center gap-2 rounded-full px-4 py-1.5"
            style={{ backgroundColor: "#FFD60A15", borderColor: "#FFD60A40", borderWidth: 1 }}
          >
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: "#FFD60A" }} />
            <Text className="font-poppins-medium text-xs" style={{ color: "#FFD60A" }}>
              Pendente
            </Text>
          </View>
        </View>

        <View className="flex-1" />

        <View style={{ gap: 4 }}>
          <Pressable
            onPress={handleCancelMembership}
            disabled={cancelMembership.isPending}
            className="items-center justify-center rounded-xl border border-surface-border bg-surface py-3.5"
          >
            <Text className="font-poppins-semibold text-sm" style={{ color: "#FF453A" }}>
              Cancelar solicitação
            </Text>
          </Pressable>

          {/* Signing out leaves the request pending — cancelling is the destructive path. */}
          <SignOutButton disabled={cancelMembership.isPending} />
        </View>
      </View>
    </SafeAreaView>
  );
}
