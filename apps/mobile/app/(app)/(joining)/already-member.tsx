import { useCurrentUser } from "@/lib/hooks/use-user";
import { useRouter } from "expo-router";
import { ShieldCheck } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#ABABAB";

/**
 * Where an invite to a second academy ends.
 *
 * `membership.service.ts` answers 409 to a request from someone who already has
 * an active membership, so this is the same rule the API enforces — said before
 * the request is made rather than as an alert after it. The gatekeeper has
 * already cleared the invite by the time this renders: the person has to leave
 * their academy first, and the invite link works for anyone any number of
 * times, so they can simply open it again afterwards.
 *
 * No leave button here on purpose. Leaving is destructive and it already lives
 * where it belongs, behind its own confirmation in `components/AcademyInfo.tsx`.
 */
export default function AlreadyMemberScreen() {
  const { data: user } = useCurrentUser();
  const router = useRouter();

  const academyName = user?.activeMembership?.academyName;

  return (
    <SafeAreaView className="flex-1 bg-background py-4" edges={["top", "bottom"]}>
      <View className="flex-1" style={{ paddingHorizontal: 24, paddingTop: 8, gap: 24 }}>
        <View className="flex-1" />

        <View className="items-center" style={{ gap: 24 }}>
          <View className="h-24 w-24 items-center justify-center rounded-full bg-accent-translucent">
            <ShieldCheck size={30} color="#A078E8" />
          </View>

          <View className="items-center" style={{ gap: 12 }}>
            <Text className="text-center font-poppins-bold text-[30px] leading-[42px] text-primary">
              Você já faz parte de uma academia
            </Text>
            <Text
              className="text-center font-poppins text-sm"
              style={{ color: TEXT_SECONDARY, lineHeight: 22 }}
            >
              {academyName
                ? `Você é membro da ${academyName}. Para entrar em outra academia, saia da atual primeiro e abra o link do convite novamente.`
                : "Para entrar em outra academia, saia da atual primeiro e abra o link do convite novamente."}
            </Text>
          </View>
        </View>

        <View className="flex-1" />

        <Pressable
          onPress={() => router.replace("/(app)")}
          className="items-center justify-center rounded-xl bg-accent py-3.5"
        >
          <Text className="font-poppins-semibold text-sm text-white">
            Ir para o início
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
