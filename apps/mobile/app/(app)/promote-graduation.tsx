import { useCallback, useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowUpRight, ChevronLeft } from "lucide-react-native";
import { BELT_ORDER, MAX_STRIPES_BY_BELT } from "@tatame/config";
import type { Belt } from "@tatame/types";

import { Avatar } from "@/components/Avatar";
import { ModalSelect } from "@/components/ModalSelect";
import {
  useGraduationHistory,
  usePromoteGraduation,
} from "@/lib/hooks/use-graduation";
import { useMemberDetail } from "@/lib/hooks/use-membership";

const BELT_LABELS: Record<string, string> = {
  white: "Faixa branca",
  blue: "Faixa azul",
  purple: "Faixa roxa",
  brown: "Faixa marrom",
  black: "Faixa preta",
};

const BELT_LABELS_SHORT: Record<string, string> = {
  white: "Branca",
  blue: "Azul",
  purple: "Roxa",
  brown: "Marrom",
  black: "Preta",
};

const ROLE_TITLE: Record<string, string> = {
  student: "Promover aluno",
  instructor: "Promover instrutor",
};

const promotionFormSchema = z.object({
  belt: z.string().min(1),
  stripes: z.number().int().min(0),
  notes: z.string().max(2000).nullable(),
});

type PromotionForm = z.infer<typeof promotionFormSchema>;

function useRouteParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function PromoteGraduationScreen() {
  const raw = useLocalSearchParams<{ userId?: string; membershipId?: string }>();
  const userId = useRouteParam(raw.userId);
  const membershipId = useRouteParam(raw.membershipId);
  const router = useRouter();

  const { data: member, isPending: memberPending } =
    useMemberDetail(membershipId);
  const { data: graduationData, isPending: gradPending } =
    useGraduationHistory(userId);
  const promoteMutation = usePromoteGraduation();

  const history = graduationData?.items ?? [];
  const currentBelt = history.find((g) => g.isCurrent);

  // Determine next logical belt
  const nextBelt = useMemo(() => {
    if (!currentBelt) return "";
    const idx = BELT_ORDER.indexOf(currentBelt.belt as Belt);
    if (idx < BELT_ORDER.length - 1) return BELT_ORDER[idx + 1]!;
    return currentBelt.belt;
  }, [currentBelt]);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { isValid },
  } = useForm<PromotionForm>({
    resolver: zodResolver(promotionFormSchema),
    defaultValues: { belt: "", stripes: 0, notes: null },
  });

  // Set default belt once data loads
  useEffect(() => {
    if (nextBelt) {
      setValue("belt", nextBelt);
    }
  }, [nextBelt, setValue]);

  const selectedBelt = watch("belt");

  // Reset stripes when belt changes
  useEffect(() => {
    setValue("stripes", 0);
  }, [selectedBelt, setValue]);

  const maxStripes = selectedBelt
    ? MAX_STRIPES_BY_BELT[selectedBelt as Belt] ?? 4
    : 4;

  const beltOptions = BELT_ORDER.map((b: Belt) => ({
    value: b,
    label: BELT_LABELS[b] ?? b,
  }));

  const stripesOptions = Array.from({ length: maxStripes + 1 }, (_, i) => ({
    value: String(i),
    label: String(i),
  }));

  const onSubmit = handleSubmit((data) => {
    if (!userId) return;
    promoteMutation.mutate(
      {
        userId,
        belt: data.belt,
        stripes: data.stripes,
        notes: data.notes || null,
      },
      { onSuccess: () => router.back() },
    );
  });

  const formatHistoryTitle = useCallback(
    (item: (typeof history)[number], index: number) => {
      const date = new Date(item.promotedAt).toLocaleDateString("pt-BR");
      const prev = history[index + 1];
      if (!prev) {
        return `${date} · ${BELT_LABELS_SHORT[item.belt] ?? item.belt} ${item.stripes}`;
      }
      return `${date} · ${BELT_LABELS_SHORT[prev.belt] ?? prev.belt} ${prev.stripes} → ${BELT_LABELS_SHORT[item.belt] ?? item.belt} ${item.stripes}`;
    },
    [history],
  );

  if (memberPending || gradPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  if (!member) return null;

  const title = ROLE_TITLE[member.role] ?? "Promover membro";
  const avatarLetter = (member.userName?.charAt(0) || "?").toUpperCase();
  const currentBeltLabel = currentBelt
    ? `Faixa ${BELT_LABELS_SHORT[currentBelt.belt]?.toLowerCase() ?? currentBelt.belt} · ${currentBelt.stripes} graus atuais`
    : "Nenhuma graduação registrada";

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          <View style={{ paddingHorizontal: 24, paddingTop: 8, gap: 20 }}>
            {/* Nav Row */}
            <View className="flex-row items-center justify-between">
              <Pressable
                onPress={() => router.back()}
                className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface"
              >
                <ChevronLeft size={20} color="#FFFFFF" />
              </Pressable>
              <Text className="font-poppins-bold text-lg text-primary">
                {title}
              </Text>
              <View className="h-10 w-10" />
            </View>

            {/* Member Card */}
            <View
              className="rounded-2xl border border-surface-border bg-surface"
              style={{ padding: 16, gap: 14 }}
            >
              <View className="flex-row items-center" style={{ gap: 12 }}>
                <Avatar
                  variant="user"
                  imageUrl={member.userProfileImageUrl}
                  fallbackLetter={avatarLetter}
                  size={42}
                />
                <View className="min-w-0 flex-1" style={{ gap: 2 }}>
                  <Text className="font-poppins-semibold text-base text-primary">
                    {member.userName}
                  </Text>
                  <Text className="font-poppins-medium text-xs text-muted">
                    {currentBeltLabel}
                  </Text>
                </View>
              </View>

              <View
                className="flex-row items-center rounded-[10px]"
                style={{
                  backgroundColor: "#A078E815",
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  gap: 8,
                }}
              >
                <View
                  className="rounded-full"
                  style={{
                    width: 10,
                    height: 10,
                    backgroundColor: currentBelt ? "#7E57C2" : "#525252",
                  }}
                />
                <Text className="font-poppins-medium text-xs text-muted">
                  {currentBelt
                    ? "Graduação atual registrada e pronta para promoção"
                    : "Nenhuma graduação registrada"}
                </Text>
              </View>
            </View>

            {/* Promotion Form */}
            {currentBelt ? (
              <View
                className="rounded-2xl border border-surface-border bg-surface"
                style={{ padding: 16, gap: 12 }}
              >
                <Text className="font-poppins-semibold text-sm text-muted">
                  Nova promoção
                </Text>

                <View style={{ gap: 6 }}>
                  <Text className="font-poppins-semibold text-[13px] text-primary">
                    Nova faixa
                  </Text>
                  <Controller
                    control={control}
                    name="belt"
                    render={({ field: { value, onChange } }) => (
                      <ModalSelect
                        value={value}
                        onChange={onChange}
                        options={beltOptions}
                        placeholder="Selecionar faixa"
                      />
                    )}
                  />
                </View>

                <View style={{ gap: 6 }}>
                  <Text className="font-poppins-semibold text-[13px] text-primary">
                    Novos graus
                  </Text>
                  <Controller
                    control={control}
                    name="stripes"
                    render={({ field: { value, onChange } }) => (
                      <ModalSelect
                        value={String(value)}
                        onChange={(v) => onChange(Number(v))}
                        options={stripesOptions}
                        placeholder="0"
                      />
                    )}
                  />
                </View>

                <View style={{ gap: 6 }}>
                  <Text className="font-poppins-semibold text-[13px] text-primary">
                    Notas (opcional)
                  </Text>
                  <Controller
                    control={control}
                    name="notes"
                    render={({ field: { value, onChange } }) => (
                      <TextInput
                        className="rounded-[10px] border border-surface-border font-poppins text-[13px] text-primary"
                        style={{
                          backgroundColor: "#121212",
                          height: 88,
                          padding: 12,
                          textAlignVertical: "top",
                        }}
                        placeholder="Ex.: evolução consistente nas últimas semanas."
                        placeholderTextColor="#525252"
                        multiline
                        value={value ?? ""}
                        onChangeText={(t) => onChange(t || null)}
                      />
                    )}
                  />
                </View>

                <Pressable
                  onPress={onSubmit}
                  disabled={!isValid || promoteMutation.isPending}
                  className="flex-row items-center justify-center rounded-xl"
                  style={{
                    backgroundColor:
                      !isValid || promoteMutation.isPending
                        ? "#3A3A3A"
                        : "#A078E8",
                    height: 56,
                    gap: 8,
                  }}
                >
                  {promoteMutation.isPending ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <ArrowUpRight size={20} color="#FFFFFF" />
                      <Text className="font-poppins-semibold text-base text-white">
                        Promover com confirmação
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : null}

            {/* History */}
            <Text className="font-poppins-semibold text-sm text-muted">
              Histórico de promoções
            </Text>

            <View style={{ gap: 10 }}>
              {history.length === 0 ? (
                <View className="items-center rounded-[14px] border border-surface-border bg-surface py-8">
                  <Text className="font-poppins text-sm" style={{ color: "#525252" }}>
                    Nenhuma promoção registrada
                  </Text>
                </View>
              ) : (
                history.map((item, index) => (
                  <View
                    key={item.id}
                    className="rounded-xl border border-surface-border bg-surface"
                    style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 3 }}
                  >
                    <Text className="font-poppins-semibold text-[13px] text-primary">
                      {formatHistoryTitle(item, index)}
                    </Text>
                    <Text className="font-poppins-medium text-[11px] text-muted">
                      Promovido por {item.promotedByName}
                      {item.notes ? ` · ${item.notes}` : ""}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
