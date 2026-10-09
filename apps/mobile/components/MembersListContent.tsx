import { FilterTabs } from "@/components/FilterTabs";
import { InviteHeaderActions } from "@/components/InviteHeaderActions";
import { InviteRoleSheet } from "@/components/InviteRoleSheet";
import { MemberCard } from "@/components/MemberCard";
import { useAcademyContext } from "@/lib/academy-context";
import { useInviteShare } from "@/lib/hooks/use-invite-share";
import { useMembers } from "@/lib/hooks/use-membership";
import { useRouter } from "expo-router";
import { ArrowLeft, Search } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_MUTED = "#525252";

const DEFAULT_TABS: { key: string; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "instructor", label: "Instrutores" },
  { key: "student", label: "Alunos" },
  { key: "guardian", label: "Responsáveis" },
  { key: "pending", label: "Pendentes" },
];

type MemberFilters = { role?: string; status?: string; q?: string };
type MemberWithGraduation = {
  id: string;
  userName: string;
  role: string;
  status: string;
  userProfileImageUrl: string | null;
  currentBelt: string | null;
  currentStripes: number | null;
  guardianName?: string | null;
  guardianMembershipId?: string | null;
};

type MembersListContentProps = {
  title?: string;
  showBackButton?: boolean;
  allowMemberDetails?: boolean;
  getMemberDetailHref?: (membershipId: string) => string;
  getDependentDetailHref?: (dependentId: string, guardianName?: string | null, guardianMembershipId?: string | null) => string;
  tabs?: { key: string; label: string }[];
  /**
   * Manager-only. This component backs the instructor and student member lists
   * too, and neither of them may offer an invite, so the actions are opt-in
   * rather than opt-out: a new consumer gets no invite button by default.
   */
  showInviteActions?: boolean;
  /** Applied after API results (e.g. hide managers on instructor list). */
  additionalFilter?: (m: MemberWithGraduation) => boolean;
};

export function MembersListContent({
  title = "Membros",
  showBackButton = false,
  allowMemberDetails = false,
  getMemberDetailHref,
  getDependentDetailHref,
  tabs = DEFAULT_TABS,
  showInviteActions = false,
  additionalFilter,
}: MembersListContentProps) {
  const router = useRouter();
  const invite = useInviteShare();
  const { academyId } = useAcademyContext();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filters = useMemo<MemberFilters>(() => {
    const next: MemberFilters = {};

    if (activeTab === "instructor") next.role = "instructor";
    else if (activeTab === "student") next.role = "student";
    else if (activeTab === "guardian") next.role = "guardian";
    else if (activeTab === "dependent") next.role = "dependent";
    else if (activeTab === "pending") next.status = "pending";

    if (searchQuery.trim().length >= 2) {
      next.q = searchQuery.trim();
    }

    return next;
  }, [activeTab, searchQuery]);

  const { data: members, isPending } = useMembers(academyId, filters);
  const membersWithGraduation = (members ?? []) as MemberWithGraduation[];
  const visibleMembers = useMemo(
    () =>
      additionalFilter
        ? membersWithGraduation.filter(additionalFilter)
        : membersWithGraduation,
    [membersWithGraduation, additionalFilter],
  );
  const canOpenMember = allowMemberDetails && typeof getMemberDetailHref === "function";

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
      <View className="flex-1 px-6" style={{ paddingTop: 8, gap: 16 }}>
        <View className="flex-row items-center justify-between">
          {showBackButton ? (
            <Pressable
              onPress={() => router.back()}
              className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface"
            >
              <ArrowLeft size={18} color="#FFFFFF" />
            </Pressable>
          ) : (
            <View className="h-10 w-10" />
          )}

          <Text className="font-poppins-bold text-lg text-primary">{title}</Text>

          {/* The two actions are wider than the 40px the title is centred
              against, so the spacer stays for every consumer that has none. */}
          {showInviteActions ? (
            <InviteHeaderActions
              onInvitePress={invite.openPicker}
              onShareAppPress={invite.shareApp}
            />
          ) : (
            <View className="h-10 w-10" />
          )}
        </View>

        <View className="flex-row items-center gap-2.5 rounded-xl border border-surface-border bg-surface px-4">
          <Search size={18} color={TEXT_MUTED} />
          <TextInput
            className="min-w-0 flex-1 font-poppins text-sm text-primary"
            placeholder="Buscar membro..."
            placeholderTextColor={TEXT_MUTED}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            style={{ height: 48 }}
          />
        </View>

        <FilterTabs tabs={tabs} activeKey={activeTab} onSelect={setActiveTab} />

        {isPending ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#A078E8" />
          </View>
        ) : (
          <FlatList
            data={visibleMembers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <MemberCard
                name={item.userName}
                role={item.role}
                status={item.status}
                profileImageUrl={item.userProfileImageUrl}
                belt={item.currentBelt}
                stripes={item.currentStripes}
                subtitle={
                  item.role === "dependent" && item.guardianName
                    ? `Resp: ${item.guardianName}`
                    : null
                }
                onPress={
                  canOpenMember
                    ? () => {
                        if (item.role === "dependent" && getDependentDetailHref) {
                          router.push(getDependentDetailHref(item.id, item.guardianName, item.guardianMembershipId));
                        } else {
                          router.push(getMemberDetailHref(item.id));
                        }
                      }
                    : undefined
                }
              />
            )}
            ListEmptyComponent={
              <View className="items-center py-12">
                <Text className="font-poppins text-sm" style={{ color: TEXT_MUTED }}>
                  Nenhum membro encontrado
                </Text>
              </View>
            }
          />
        )}
      </View>

      {showInviteActions ? (
        <InviteRoleSheet
          visible={invite.pickerVisible}
          onClose={invite.closePicker}
          onSelect={invite.selectRole}
        />
      ) : null}
    </SafeAreaView>
  );
}
