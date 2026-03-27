import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import {
  useBlockMembership,
  useMemberDetail,
} from "@/lib/hooks/use-membership";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  AtSign,
  Ban,
  Calendar,
  Mail,
  Phone,
} from "lucide-react-native";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#ABABAB";
const TEXT_MUTED = "#525252";
const SEPARATOR = "#2A2A2A";

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateLong(value: Date | string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDateShort(value: Date | string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
  });
}

export default function MemberDetailScreen() {
  const { membershipId } = useLocalSearchParams<{ membershipId: string }>();
  const router = useRouter();

  const { data: member, isPending } = useMemberDetail(membershipId);
  const blockMutation = useBlockMembership();

  const handleBlock = () => {
    if (!membershipId) return;

    Alert.alert(
      "Bloquear membro",
      `Deseja realmente bloquear ${member?.userName ?? "este membro"}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Bloquear",
          style: "destructive",
          onPress: () => {
            blockMutation.mutate(membershipId, {
              onSuccess: () => router.back(),
            });
          },
        },
      ],
    );
  };

  if (isPending || !member) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  const letter = (member.userName || "?").charAt(0).toUpperCase();

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
          <Text className="font-poppins-bold text-lg text-primary">Detalhes</Text>
          <View className="h-10 w-10" />
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 18, paddingBottom: 24 }}
        >
          <View className="items-center" style={{ gap: 12 }}>
            <Avatar
              variant="user"
              imageUrl={member.userProfileImageUrl}
              fallbackLetter={letter}
              size={80}
            />
            <Text className="font-poppins-bold text-[30px] text-primary">
              {member.userName}
            </Text>
            <View className="flex-row items-center gap-2">
              <Badge variant="role" value={member.role} />
              <Badge variant="status" value={member.status} />
            </View>
          </View>

          <View
            className="overflow-hidden rounded-2xl border border-surface-border bg-surface"
          >
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <Mail size={16} color={TEXT_MUTED} />
              <Text className="font-poppins text-sm text-primary">{member.userEmail}</Text>
            </View>
            <View className="h-px" style={{ backgroundColor: SEPARATOR }} />
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <Phone size={16} color={TEXT_MUTED} />
              <Text className="font-poppins text-sm text-primary">
                {member.userPhone ?? "—"}
              </Text>
            </View>
            <View className="h-px" style={{ backgroundColor: SEPARATOR }} />
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <AtSign size={16} color={TEXT_MUTED} />
              <Text className="font-poppins text-sm text-primary">
                {member.userInstagram ?? "—"}
              </Text>
            </View>
            <View className="h-px" style={{ backgroundColor: SEPARATOR }} />
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <Calendar size={16} color={TEXT_MUTED} />
              <Text className="font-poppins text-sm text-primary">
                {member.userBirthDate ?? "—"}
              </Text>
            </View>
          </View>

          <Text className="font-poppins-semibold text-sm" style={{ color: TEXT_SECONDARY }}>
            Histórico de associação
          </Text>

          <View className="overflow-hidden rounded-2xl border border-surface-border bg-surface">
            {member.history.map((entry, index) => {
              const isCurrent = index === 0 && entry.status === "active";
              const joinedLabel = formatDateLong(entry.joinedAt ?? entry.createdAt);
              const periodLabel = `${formatDateShort(entry.joinedAt ?? entry.createdAt)} — ${formatDateShort(entry.leftAt)}`;

              return (
                <View key={entry.id}>
                  <View className="flex-row items-center justify-between px-4 py-3.5">
                    <View className="min-w-0 flex-1" style={{ gap: 2 }}>
                      <Text
                        className="font-poppins text-xs"
                        style={{ color: isCurrent ? TEXT_SECONDARY : TEXT_MUTED }}
                      >
                        {isCurrent ? "Membro desde" : "Associação anterior"}
                      </Text>
                      <Text className="font-poppins-semibold text-sm text-primary">
                        {isCurrent ? joinedLabel : periodLabel}
                      </Text>
                    </View>
                    <Badge variant="status" value={entry.status} />
                  </View>
                  {index < member.history.length - 1 ? (
                    <View className="h-px" style={{ backgroundColor: SEPARATOR }} />
                  ) : null}
                </View>
              );
            })}
          </View>
        </ScrollView>

        {member.status === "active" && member.role !== "manager" ? (
          <Pressable
            onPress={handleBlock}
            disabled={blockMutation.isPending}
            className="mb-6 flex-row items-center justify-center gap-2 rounded-xl border py-3.5"
            style={{ backgroundColor: "#1A0A0A", borderColor: "#FF453A40" }}
          >
            <Ban size={16} color="#FF453A" />
            <Text className="font-poppins-semibold text-sm" style={{ color: "#FF453A" }}>
              Bloquear membro
            </Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
