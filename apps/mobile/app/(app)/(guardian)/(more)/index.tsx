import { Avatar } from "@/components/Avatar";
import { useCurrentUser } from "@/lib/hooks/use-user";
import { useAuth } from "@clerk/clerk-expo";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  Bell,
  ChevronRight,
  Megaphone,
  Users,
} from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#8A8A8A";
const TEXT_MUTED = "#525252";
const ACCENT = "#A078E8";

type MenuItemProps = {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
};

function MenuItem({ icon, title, subtitle, onPress }: MenuItemProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center rounded-[14px] border border-surface-border bg-surface"
      style={{ padding: 16, gap: 14 }}
    >
      <View
        className="items-center justify-center rounded-[10px]"
        style={{ width: 40, height: 40, backgroundColor: "#A078E820" }}
      >
        {icon}
      </View>
      <View className="min-w-0 flex-1" style={{ gap: 2 }}>
        <Text className="font-poppins-medium text-sm text-primary">{title}</Text>
        <Text
          className="font-poppins text-xs"
          style={{ color: TEXT_SECONDARY }}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      </View>
      <ChevronRight size={16} color={TEXT_MUTED} />
    </Pressable>
  );
}

export default function GuardianMoreScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();

  const avatarLetter = (me?.name || "?").charAt(0).toUpperCase();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32, gap: 24 }}
      >
        <Text
          className="font-poppins-bold text-primary"
          style={{ fontSize: 22, letterSpacing: -0.5 }}
        >
          Mais
        </Text>

        {/* Profile card */}
        <Pressable
          onPress={() => router.push("/(app)/profile")}
          className="flex-row items-center rounded-2xl border border-surface-border bg-surface"
          style={{ padding: 16, gap: 14 }}
        >
          <Avatar
            variant="user"
            imageUrl={me?.profileImageUrl}
            fallbackLetter={avatarLetter}
          />
          <View className="min-w-0 flex-1" style={{ gap: 2 }}>
            <Text className="font-poppins-semibold text-base text-primary">
              {me?.name ?? ""}
            </Text>
            <Text
              className="font-poppins text-xs"
              style={{ color: ACCENT }}
            >
              Ver perfil
            </Text>
          </View>
          <ChevronRight size={16} color={TEXT_MUTED} />
        </Pressable>

        {/* Menu items */}
        <View style={{ gap: 10 }}>
          <MenuItem
            icon={<Megaphone size={18} color={ACCENT} />}
            title="Avisos"
            subtitle="Veja os avisos da academia"
            onPress={() => router.push("/(app)/(guardian)/(announcements)")}
          />
          <MenuItem
            icon={<Users size={18} color={ACCENT} />}
            title="Dependentes"
            subtitle="Gerencie seus dependentes"
            onPress={() => router.push("/(app)/(guardian)/(dependents)")}
          />
          <MenuItem
            icon={<Bell size={18} color={ACCENT} />}
            title="Notificações"
            subtitle="Gerencie suas notificações"
            onPress={() => router.push("/(app)/notification-preferences")}
          />
        </View>

        {/* Sign out */}
        <Pressable
          onPress={async () => {
            queryClient.clear();
            await signOut();
            router.replace("/(auth)");
          }}
          className="items-center rounded-[14px] border"
          style={{ padding: 16, borderColor: "#FF453A40" }}
        >
          <Text
            className="font-poppins-semibold text-sm"
            style={{ color: "#FF453A" }}
          >
            Sair da conta
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
