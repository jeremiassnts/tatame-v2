import { BackButton } from "@/components/BackButton";
import { Avatar } from "@/components/Avatar";
import { useAcademyContext } from "@/lib/academy-context";
import { useAcademy } from "@/lib/hooks/use-academy";
import { Calendar, Mail, MapPin, Phone, ShieldCheck } from "lucide-react-native";
import type { ComponentType } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type AcademyInfoProps = {
  onLeave: () => void;
  isLeaving: boolean;
  memberSince: Date | null;
};

const TEXT_DIMMED = "#525252";

function ReadOnlyField({
  label,
  value,
  Icon,
}: {
  label: string;
  value: string | null;
  Icon?: ComponentType<{ size: number; color: string }>;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text className="font-poppins-medium text-[13px] text-muted">{label}</Text>
      <View className="h-[52px] flex-row items-center gap-2.5 rounded-xl border border-surface-border bg-surface px-4">
        {Icon ? <Icon size={18} color={TEXT_DIMMED} /> : null}
        <Text className="flex-1 font-poppins text-[14px] text-primary">
          {value || "Não informado"}
        </Text>
      </View>
    </View>
  );
}

function formatMemberDate(date: Date | null): string {
  if (!date) return "Data não informada";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatFoundedDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
}

export function AcademyInfo({ onLeave, isLeaving, memberSince }: AcademyInfoProps) {
  const { academyId } = useAcademyContext();
  const { data: academy, isLoading } = useAcademy(academyId);

  const handleLeavePress = () => {
    Alert.alert(
      "Sair da academia",
      "Ao sair, você perderá acesso às aulas e recursos desta academia. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Sair", style: "destructive", onPress: onLeave },
      ],
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 px-6 pt-2" style={{ gap: 8 }}>
        {/* Nav Row */}
        <View className="flex-row items-center justify-between">
          <BackButton />
          <Text
            className="font-poppins-bold text-primary"
            style={{ fontSize: 18, letterSpacing: -0.3 }}
          >
            Academia
          </Text>
          <View className="h-10 w-10" />
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24, gap: 24 }}
        >
          {/* Logo Section */}
          <View className="items-center" style={{ gap: 12 }}>
            <Avatar variant="brand" imageUrl={academy?.logoUrl} size={88} />
            <Text className="font-poppins text-[13px] text-muted">
              Somente visualização
            </Text>
          </View>

          {/* Form Fields */}
          <View style={{ gap: 16 }}>
            <ReadOnlyField label="Nome" value={academy?.name ?? null} />
            <ReadOnlyField label="Endereço" value={academy?.address ?? null} Icon={MapPin} />
            <ReadOnlyField label="E-mail" value={academy?.contactEmail ?? null} Icon={Mail} />
            <ReadOnlyField label="Telefone" value={academy?.contactPhone ?? null} Icon={Phone} />
            <ReadOnlyField
              label="Fundada em"
              value={formatFoundedDate(academy?.foundedAt ?? null)}
              Icon={Calendar}
            />
          </View>

          {/* Member Card */}
          <View
            className="flex-row items-center rounded-2xl border border-surface-border bg-surface"
            style={{ gap: 12, padding: 14, paddingHorizontal: 16 }}
          >
            <View
              className="h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: "rgba(160,120,232,0.125)" }}
            >
              <ShieldCheck size={20} color="#A078E8" />
            </View>
            <View style={{ gap: 4 }}>
              <Text className="font-poppins-semibold text-[14px] text-primary">
                Membro ativo
              </Text>
              <Text className="font-poppins text-[13px] text-muted">
                Desde {formatMemberDate(memberSince)}
              </Text>
            </View>
          </View>

          {/* Leave Warning */}
          <View
            className="rounded-[10px]"
            style={{ backgroundColor: "#242424", gap: 4, padding: 10, paddingHorizontal: 12 }}
          >
            <Text className="font-poppins-semibold text-[12px] text-primary">
              Atenção
            </Text>
            <Text className="font-poppins text-[12px] text-muted">
              Ao sair, você perderá acesso às aulas e recursos desta academia.
            </Text>
          </View>

          {/* Leave Button */}
          <Pressable
            onPress={handleLeavePress}
            disabled={isLeaving}
            className="h-14 items-center justify-center rounded-xl"
            style={{ backgroundColor: "#D64B4B" }}
          >
            {isLeaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="font-poppins-semibold text-base text-white">
                Sair da academia
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
