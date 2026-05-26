import { useMembers } from "@/lib/hooks/use-membership";
import {
  useCustomNotificationQuota,
  useSendCustomNotification,
} from "@/lib/hooks/use-notifications";
import { useCurrentUser } from "@/lib/hooks/use-user";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Check, Info, Send, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type RecipientFilter = "all" | "students" | "instructors";

type FormData = {
  title: string;
  body: string;
};

const RECIPIENT_CHIPS: { value: RecipientFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "students", label: "Alunos" },
  { value: "instructors", label: "Instrutores" },
];

const TITLE_MAX = 200;
const BODY_MAX = 1000;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "";
  if (parts.length === 1) return (parts[0]?.[0] ?? "").toUpperCase();
  return (
    (parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")
  ).toUpperCase();
}

function getRoleLabel(role: string): string {
  switch (role) {
    case "student":
      return "Aluno";
    case "instructor":
      return "Instrutor";
    case "manager":
      return "Gestor";
    default:
      return role;
  }
}

export default function CreateNotificationScreen() {
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const academyId = user?.activeAcademy?.id ?? "";
  const currentUserId = user?.id ?? "";
  const { data: quota, isLoading: quotaLoading } =
    useCustomNotificationQuota();
  const sendNotification = useSendCustomNotification();

  const [recipientFilter, setRecipientFilter] =
    useState<RecipientFilter>("all");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    new Set(),
  );

  // Fetch members for recipient selection and count
  const { data: members, isLoading: membersLoading } = useMembers(academyId, {
    status: "active",
  });

  // Exclude current user and sort alphabetically
  const activeMembers = useMemo(() => {
    const list = (members ?? []).filter((m) => m.userId !== currentUserId);
    return list.sort((a, b) => a.userName.localeCompare(b.userName));
  }, [members, currentUserId]);

  const { control, handleSubmit, watch } = useForm<FormData>({
    defaultValues: { title: "", body: "" },
  });

  const titleValue = watch("title");
  const bodyValue = watch("body");

  const remaining = quota?.remaining ?? 0;

  // Filter members visible in the list based on the selected chip
  const visibleMembers = useMemo(() => {
    if (recipientFilter === "students")
      return activeMembers.filter((m) => m.role === "student");
    if (recipientFilter === "instructors")
      return activeMembers.filter((m) => m.role === "instructor");
    return activeMembers; // "all"
  }, [activeMembers, recipientFilter]);

  // Compute recipient count for confirmation
  const recipientCount = selectedUserIds.size > 0
    ? selectedUserIds.size
    : visibleMembers.length;

  const isFormValid =
    titleValue.trim().length > 0 &&
    bodyValue.trim().length > 0 &&
    remaining > 0 &&
    recipientCount > 0;

  const allVisibleSelected =
    visibleMembers.length > 0 &&
    visibleMembers.every((m) => selectedUserIds.has(m.userId));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(visibleMembers.map((m) => m.userId)));
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const onSubmit = (data: FormData) => {
    // Determine the actual filter to send to the API
    const hasCustomSelection = selectedUserIds.size > 0;
    const apiFilter = hasCustomSelection ? "specific" as const : recipientFilter;

    Alert.alert(
      "Confirmar envio",
      `Enviar notificação para ${recipientCount} ${recipientCount === 1 ? "membro" : "membros"}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Enviar",
          onPress: async () => {
            try {
              await sendNotification.mutateAsync({
                title: data.title.trim(),
                body: data.body.trim(),
                recipientFilter: apiFilter,
                specificUserIds:
                  apiFilter === "specific"
                    ? Array.from(selectedUserIds)
                    : undefined,
              });
              Alert.alert("Sucesso", "Notificação enviada com sucesso!", [
                { text: "OK", onPress: () => router.back() },
              ]);
            } catch {
              Alert.alert(
                "Erro",
                "Não foi possível enviar a notificação. Tente novamente.",
              );
            }
          },
        },
      ],
    );
  };

  // Reset selection when switching filter
  useEffect(() => {
    setSelectedUserIds(new Set());
  }, [recipientFilter]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <View className="flex-1" style={{ paddingHorizontal: 24 }}>
          {/* Header */}
          <View
            className="flex-row items-center justify-between"
            style={{ paddingTop: 8, paddingBottom: 16 }}
          >
            <Pressable
              onPress={() => router.back()}
              className="items-center justify-center rounded-xl border border-surface-border bg-surface"
              style={{ width: 40, height: 40 }}
            >
              <X size={20} color="#FFFFFF" />
            </Pressable>
            <Text
              style={{
                fontFamily: "Poppins_700Bold",
                fontSize: 18,
                color: "#FFFFFF",
              }}
            >
              Nova Notificação
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 20, paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Quota Badge */}
            <View
              className="flex-row items-center"
              style={{
                backgroundColor: "rgba(160,120,232,0.125)",
                borderRadius: 10,
                paddingVertical: 10,
                paddingHorizontal: 14,
                gap: 8,
              }}
            >
              <Info size={16} color="#A078E8" />
              <Text
                style={{
                  fontFamily: "Poppins_500Medium",
                  fontSize: 12,
                  color: "#A078E8",
                  flex: 1,
                }}
              >
                {quotaLoading
                  ? "Carregando..."
                  : `${remaining} de 5 notificações restantes hoje`}
              </Text>
            </View>

            {/* Title Field */}
            <View style={{ gap: 6 }}>
              <Text
                style={{
                  fontFamily: "Poppins_600SemiBold",
                  fontSize: 13,
                  color: "#ABABAB",
                }}
              >
                Título
              </Text>
              <Controller
                control={control}
                name="title"
                rules={{ required: true, maxLength: TITLE_MAX }}
                render={({ field: { onChange, value } }) => (
                  <View
                    className="border border-surface-border bg-surface"
                    style={{
                      height: 48,
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      justifyContent: "center",
                    }}
                  >
                    <TextInput
                      value={value}
                      onChangeText={(t) =>
                        onChange(t.slice(0, TITLE_MAX))
                      }
                      placeholder="Ex: Aviso importante"
                      placeholderTextColor="#525252"
                      maxLength={TITLE_MAX}
                      style={{
                        fontFamily: "Poppins_400Regular",
                        fontSize: 15,
                        color: "#FFFFFF",
                      }}
                    />
                  </View>
                )}
              />
              <Text
                style={{
                  fontFamily: "Poppins_400Regular",
                  fontSize: 11,
                  color: "#525252",
                  textAlign: "right",
                }}
              >
                {titleValue.length}/{TITLE_MAX}
              </Text>
            </View>

            {/* Body Field */}
            <View style={{ gap: 6 }}>
              <Text
                style={{
                  fontFamily: "Poppins_600SemiBold",
                  fontSize: 13,
                  color: "#ABABAB",
                }}
              >
                Mensagem
              </Text>
              <Controller
                control={control}
                name="body"
                rules={{ required: true, maxLength: BODY_MAX }}
                render={({ field: { onChange, value } }) => (
                  <View
                    className="border border-surface-border bg-surface"
                    style={{
                      height: 120,
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                    }}
                  >
                    <TextInput
                      value={value}
                      onChangeText={(t) =>
                        onChange(t.slice(0, BODY_MAX))
                      }
                      placeholder="Escreva sua mensagem aqui..."
                      placeholderTextColor="#525252"
                      maxLength={BODY_MAX}
                      multiline
                      textAlignVertical="top"
                      style={{
                        flex: 1,
                        fontFamily: "Poppins_400Regular",
                        fontSize: 15,
                        color: "#FFFFFF",
                      }}
                    />
                  </View>
                )}
              />
              <Text
                style={{
                  fontFamily: "Poppins_400Regular",
                  fontSize: 11,
                  color: "#525252",
                  textAlign: "right",
                }}
              >
                {bodyValue.length}/{BODY_MAX}
              </Text>
            </View>

            {/* Recipients */}
            <View style={{ gap: 10 }}>
              <Text
                style={{
                  fontFamily: "Poppins_600SemiBold",
                  fontSize: 13,
                  color: "#ABABAB",
                }}
              >
                Destinatários
              </Text>

              {/* Chips Row */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {RECIPIENT_CHIPS.map((chip) => {
                  const isActive = recipientFilter === chip.value;
                  return (
                    <Pressable
                      key={chip.value}
                      onPress={() => setRecipientFilter(chip.value)}
                    >
                      {isActive ? (
                        <LinearGradient
                          colors={["#A078E8", "#7C5CBF"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={{
                            height: 32,
                            borderRadius: 20,
                            paddingHorizontal: 14,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "Poppins_600SemiBold",
                              fontSize: 12,
                              color: "#FFFFFF",
                            }}
                          >
                            {chip.label}
                          </Text>
                        </LinearGradient>
                      ) : (
                        <View
                          className="border border-surface-border bg-surface"
                          style={{
                            height: 32,
                            borderRadius: 20,
                            paddingHorizontal: 14,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "Poppins_500Medium",
                              fontSize: 12,
                              color: "#ABABAB",
                            }}
                          >
                            {chip.label}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Select All Row */}
              <Pressable
                onPress={toggleSelectAll}
                className="flex-row items-center"
                style={{ gap: 10 }}
              >
                <Checkbox checked={allVisibleSelected} />
                <Text
                  style={{
                    fontFamily: "Poppins_500Medium",
                    fontSize: 14,
                    color: "#FFFFFF",
                    flex: 1,
                  }}
                >
                  Selecionar todos
                </Text>
                <Text
                  style={{
                    fontFamily: "Poppins_400Regular",
                    fontSize: 12,
                    color: "#ABABAB",
                  }}
                >
                  {visibleMembers.length} membros
                </Text>
              </Pressable>

              {/* Members List */}
              <View
                className="border border-surface-border bg-surface"
                style={{ borderRadius: 12, overflow: "hidden" }}
              >
                {visibleMembers.map((member, index) => (
                  <Pressable
                    key={member.userId}
                    onPress={() => toggleUser(member.userId)}
                    className="flex-row items-center"
                    style={{
                      height: 48,
                      paddingHorizontal: 14,
                      gap: 10,
                      borderTopWidth: index > 0 ? 1 : 0,
                      borderTopColor: "#2A2A2A",
                    }}
                  >
                    <Checkbox checked={selectedUserIds.has(member.userId)} />
                    {/* Avatar */}
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: "rgba(160,120,232,0.125)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Poppins_400Regular",
                          fontSize: 11,
                          color: "#A078E8",
                        }}
                      >
                        {getInitials(member.userName)}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontFamily: "Poppins_400Regular",
                        fontSize: 14,
                        color: "#FFFFFF",
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {member.userName}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Poppins_400Regular",
                        fontSize: 11,
                        color: "#ABABAB",
                      }}
                    >
                      {getRoleLabel(member.role)}
                    </Text>
                  </Pressable>
                ))}
                {membersLoading && (
                  <View
                    style={{
                      height: 48,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ActivityIndicator size="small" color="#A078E8" />
                  </View>
                )}
                {!membersLoading && visibleMembers.length === 0 && (
                  <View
                    style={{
                      height: 48,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Poppins_400Regular",
                        fontSize: 13,
                        color: "#525252",
                      }}
                    >
                      Nenhum membro encontrado
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Send Button */}
          <View style={{ paddingBottom: 16, paddingTop: 8 }}>
            <Pressable
              onPress={handleSubmit(onSubmit)}
              disabled={!isFormValid || sendNotification.isPending}
              style={{ opacity: !isFormValid ? 0.5 : 1 }}
            >
              <LinearGradient
                colors={
                  !isFormValid || sendNotification.isPending
                    ? ["#3A3A3A", "#3A3A3A"]
                    : ["#A078E8", "#7C5CBF"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  height: 52,
                  borderRadius: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                }}
              >
                {sendNotification.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Send size={18} color="#FFFFFF" />
                    <Text
                      style={{
                        fontFamily: "Poppins_700Bold",
                        fontSize: 16,
                        color: "#FFFFFF",
                      }}
                    >
                      Enviar Notificação
                    </Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  if (checked) {
    return (
      <LinearGradient
        colors={["#A078E8", "#7C5CBF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Check size={14} color="#FFFFFF" strokeWidth={3} />
      </LinearGradient>
    );
  }

  return (
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: "#2A2A2A",
        backgroundColor: "#1A1A1A",
      }}
    />
  );
}
