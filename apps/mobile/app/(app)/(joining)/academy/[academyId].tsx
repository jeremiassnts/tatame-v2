import { Avatar } from "@/components/Avatar";
import { useAcademy } from "@/lib/hooks/use-academy";
import { useRequestMembership } from "@/lib/hooks/use-membership";
import { useCurrentUser } from "@/lib/hooks/use-user";
import {
  describeAcademyLoadError,
  describeMembershipRequestError,
} from "@/lib/membership-errors";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Mail, MapPin, Phone } from "lucide-react-native";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#ABABAB";
const TEXT_MUTED = "#525252";
const SEPARATOR = "#2A2A2A";

export default function AcademyDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ academyId: string | string[] }>();
  const academyId = Array.isArray(params.academyId)
    ? params.academyId[0]
    : params.academyId;
  const router = useRouter();

  const {
    data: academy,
    isPending,
    isError,
    error,
    refetch,
  } = useAcademy(academyId ?? "");
  const { data: user } = useCurrentUser();
  const requestMembership = useRequestMembership();

  const handleRequestMembership = () => {
    if (!academyId) return;

    requestMembership.mutate(academyId, {
      onSuccess: () => {
        // Always the app root. `useRequestMembership` has already refetched
        // `/users/me`, so `(app)/index.tsx` sees the new membership and picks
        // between pending-approval and the role home — the one file that owns
        // that choice.
        router.replace("/(app)");
      },
      onError: (requestError) => {
        Alert.alert(
          "Erro",
          describeMembershipRequestError(
            requestError,
            Boolean(user?.activeMembership),
          ),
        );
      },
    });
  };

  if (!academyId) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="font-poppins text-sm" style={{ color: TEXT_MUTED }}>
          Academia inválida.
        </Text>
      </SafeAreaView>
    );
  }

  // Before TAT-191 this screen rendered the activity indicator forever on a
  // failed load, which is where an invite with a stale academy id ended up.
  if (isError) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-background"
        edges={["top", "bottom"]}
      >
        <View className="items-center px-6" style={{ gap: 20 }}>
          <Text
            className="text-center font-poppins text-sm"
            style={{ color: TEXT_SECONDARY, lineHeight: 22 }}
          >
            {describeAcademyLoadError(error)}
          </Text>

          <View className="w-full" style={{ gap: 10 }}>
            <Pressable
              onPress={() => void refetch()}
              className="items-center justify-center rounded-xl bg-accent py-3.5"
            >
              <Text className="font-poppins-semibold text-sm text-white">
                Tentar novamente
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.replace("/(app)/(joining)/search-academy")}
              className="items-center justify-center rounded-xl border border-surface-border bg-surface py-3.5"
            >
              <Text className="font-poppins-semibold text-sm text-primary">
                Buscar outra academia
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (isPending || !academy) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top", "bottom"]}>
      <View
        className="flex-1"
        style={{
          paddingHorizontal: 24,
          paddingTop: 8,
          gap: 16,
          // Garante que o botão de ação não fique atrás da gesture bar / comandos do sistema.
          paddingBottom: Math.max(insets.bottom, 24),
        }}
      >
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface"
          >
            <ArrowLeft size={18} color="#FFFFFF" />
          </Pressable>
          <Text
            className="font-poppins-bold text-primary"
            style={{ fontSize: 18, letterSpacing: -0.3 }}
          >
            Detalhes da academia
          </Text>
          <View className="h-10 w-10" />
        </View>

        <View className="flex-1" style={{ gap: 24 }}>
          <View className="items-center" style={{ gap: 12 }}>
            <Avatar variant="brand" imageUrl={academy.logoUrl} size={80} />
            <Text className="font-poppins-bold text-primary" style={{ fontSize: 24, letterSpacing: -0.3 }}>{academy.name}</Text>
            <Text className="font-poppins text-sm" style={{ color: TEXT_SECONDARY }}>
              {academy.address ?? "Endereço não informado"}
            </Text>
          </View>

          <View className="overflow-hidden rounded-2xl border border-surface-border bg-surface">
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <MapPin size={16} color={TEXT_MUTED} />
              <Text className="font-poppins text-sm text-primary">
                {academy.address ?? "Endereço não informado"}
              </Text>
            </View>
            <View className="h-px" style={{ backgroundColor: SEPARATOR }} />
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <Mail size={16} color={TEXT_MUTED} />
              <Text className="font-poppins text-sm text-primary">
                {academy.contactEmail ?? "Contato não informado"}
              </Text>
            </View>
            <View className="h-px" style={{ backgroundColor: SEPARATOR }} />
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <Phone size={16} color={TEXT_MUTED} />
              <Text className="font-poppins text-sm text-primary">
                {academy.contactPhone ?? "Contato não informado"}
              </Text>
            </View>
          </View>

          <View className="flex-1" />

          <Pressable
            onPress={handleRequestMembership}
            disabled={requestMembership.isPending}
            className="items-center justify-center rounded-xl bg-accent py-3.5"
          >
            {requestMembership.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="font-poppins-semibold text-sm text-white">
                Solicitar entrada
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
