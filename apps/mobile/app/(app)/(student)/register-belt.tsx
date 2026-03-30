import { BackButton } from "@/components/BackButton";
import { GradientButton } from "@/components/GradientButton";
import { useRegisterBelt } from "@/lib/hooks/use-graduation";
import type { RegisterInitialBeltBody } from "@tatame/validators";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Award, Check } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Belt = RegisterInitialBeltBody["belt"];

const BELTS: { value: Belt; label: string; color: string }[] = [
  { value: "white", label: "Branca", color: "#E0E0E0" },
  { value: "blue", label: "Azul", color: "#2196F3" },
  { value: "purple", label: "Roxa", color: "#9C27B0" },
  { value: "brown", label: "Marrom", color: "#795548" },
  { value: "black", label: "Preta", color: "#212121" },
];

/** Alinhado a `MAX_STRIPES_BY_BELT` em `@tatame/config` (preta: até 10 graus). */
const MAX_STRIPES_BY_BELT: Record<Belt, number> = {
  white: 4,
  blue: 4,
  purple: 4,
  brown: 4,
  black: 10,
};

export default function RegisterBelt() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const registerBelt = useRegisterBelt();
  const [selectedBelt, setSelectedBelt] = useState<Belt | null>(null);
  const [selectedStripes, setSelectedStripes] = useState(0);

  const maxStripes = selectedBelt ? MAX_STRIPES_BY_BELT[selectedBelt] : 4;
  const stripeOptions = useMemo(
    () => Array.from({ length: maxStripes + 1 }, (_, i) => i),
    [maxStripes],
  );

  useEffect(() => {
    if (!selectedBelt) return;
    const max = MAX_STRIPES_BY_BELT[selectedBelt];
    setSelectedStripes((s) => (s > max ? max : s));
  }, [selectedBelt]);

  const handleBack = () => {
    if (returnTo === "manager") {
      router.replace("/(app)/(manager)/(home)");
      return;
    }
    if (returnTo === "instructor") {
      router.replace("/(app)/(instructor)/(home)");
      return;
    }
    router.back();
  };

  const handleConfirm = () => {
    if (!selectedBelt) return;
    registerBelt.mutate(
      { belt: selectedBelt, stripes: selectedStripes },
      {
        onSuccess: () => {
          if (returnTo === "manager") {
            router.replace("/(app)/(manager)/(home)");
          } else if (returnTo === "instructor") {
            router.replace("/(app)/(instructor)/(home)");
          } else {
            router.replace("/(app)/(student)/(home)");
          }
        }
      },
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
      <View className="flex-row items-center justify-between px-6 pb-2 pt-2">
        <BackButton onPress={handleBack} />
        <Text className="font-poppins-bold text-lg text-primary">Registrar faixa</Text>
        <View className="h-10 w-10" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24, gap: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center" style={{ gap: 8 }}>
          <View className="h-20 w-20 items-center justify-center rounded-full bg-accent-translucent">
            <Award size={36} color="#A078E8" />
          </View>
          <Text className="font-poppins-bold text-xl text-primary text-center">
            Qual é sua faixa atual?
          </Text>
          <Text className="font-poppins text-sm text-muted text-center" style={{ lineHeight: 21 }}>
            Selecione sua faixa e graus atuais. Após o registro, apenas seu instrutor ou gestor poderão
            alterar.
          </Text>
        </View>

        <View className="overflow-hidden rounded-2xl border border-surface-border bg-surface">
          <View className="px-4 pb-2 pt-4">
            <Text className="font-poppins-semibold text-[13px] text-muted">Faixa</Text>
          </View>
          {BELTS.map((belt, index) => {
            const isSelected = selectedBelt === belt.value;
            return (
              <View key={belt.value}>
                {index > 0 ? <View className="mx-4 h-px bg-surface-border" /> : null}
                <Pressable
                  onPress={() => setSelectedBelt(belt.value)}
                  className={`flex-row items-center gap-3 px-4 py-3.5 ${isSelected ? "bg-accent-translucent" : ""}`}
                >
                  <View
                    className="h-6 w-6 rounded-full border-2"
                    style={{
                      backgroundColor: belt.color,
                      borderColor: isSelected
                        ? "#A078E8"
                        : belt.value === "black"
                          ? "rgba(255, 255, 255, 0.2)"
                          : "#3A3A3A",
                    }}
                  />
                  <Text className="flex-1 font-poppins-medium text-sm text-primary">{belt.label}</Text>
                  {isSelected ? <Check size={18} color="#A078E8" /> : null}
                </Pressable>
              </View>
            );
          })}
        </View>

        <View
          className="rounded-2xl border border-surface-border bg-surface"
          style={{ padding: 16, gap: 12 }}
        >
          <Text className="font-poppins-semibold text-[13px] text-muted">Graus</Text>
          <View className="flex-row flex-wrap items-center justify-center" style={{ gap: 8 }}>
            {stripeOptions.map((s) => {
              const isSelected = selectedStripes === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => setSelectedStripes(s)}
                  className={`h-11 w-11 items-center justify-center rounded-lg border ${isSelected ? "border-accent bg-accent" : "border-surface-border bg-surface"
                    }`}
                >
                  <Text
                    className={`font-poppins-bold text-base ${isSelected ? "text-white" : "text-primary"
                      }`}
                  >
                    {s}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View className="px-6 pb-6">
        <GradientButton
          label="Confirmar faixa"
          onPress={handleConfirm}
          disabled={!selectedBelt}
          loading={registerBelt.isPending}
        />
      </View>
    </SafeAreaView>
  );
}
