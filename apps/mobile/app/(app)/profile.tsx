import { useAuth } from "@clerk/clerk-expo";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  LogOut,
  Mail,
  Trash2,
  UserCheck,
} from "lucide-react-native";
import { useCallback, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { DatePickerField } from "@/components/DatePickerField";
import { FormInput } from "@/components/FormInput";
import { GradientButton } from "@/components/GradientButton";
import {
  useCurrentUser,
  useDeleteAccount,
  useUpdateProfile,
} from "@/lib/hooks/use-user";

const ROLE_LABELS: Record<string, string> = {
  manager: "Gestor",
  instructor: "Instrutor",
  student: "Aluno",
};

type ProfileForm = {
  name: string;
  phone: string | null;
  instagram: string | null;
  birthDate: string | null;
};

export default function ProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { signOut } = useAuth();

  const { data: user } = useCurrentUser();
  const updateProfile = useUpdateProfile();
  const deleteAccount = useDeleteAccount();

  const defaultValues = useMemo<ProfileForm>(
    () => ({
      name: user?.name ?? "",
      phone: user?.phone ?? null,
      instagram: user?.instagram ?? null,
      birthDate: user?.birthDate ?? null,
    }),
    [user?.birthDate, user?.instagram, user?.name, user?.phone],
  );

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileForm>({
    values: defaultValues,
  });

  const onSave = handleSubmit((data) => {
    updateProfile.mutate(data);
  });

  const handleLogout = useCallback(async () => {
    queryClient.clear();
    await signOut();
  }, [queryClient, signOut]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      "Excluir conta",
      "Tem certeza? Esta ação é irreversível. Todos os seus dados serão removidos.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => deleteAccount.mutate(),
        },
      ],
    );
  }, [deleteAccount]);

  if (!user) return null;

  const avatarLetter = (user.name?.charAt(0) || "?").toUpperCase();
  const roleLabel = ROLE_LABELS[user.activeRole ?? ""] ?? user.activeRole ?? "";

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top", "bottom"]}>
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
            <View className="flex-row items-center justify-between">
              <Pressable
                onPress={() => router.back()}
                className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface"
              >
                <ChevronLeft size={20} color="#FFFFFF" />
              </Pressable>
              <Text className="font-poppins-bold text-lg text-primary">
                Meu perfil
              </Text>
              <View className="h-10 w-10" />
            </View>

            <View className="items-center" style={{ gap: 12 }}>
              <Avatar
                variant="user"
                imageUrl={user.profileImageUrl}
                fallbackLetter={avatarLetter}
                size={80}
              />
              <Text className="font-poppins-bold text-xl text-primary">
                {user.name}
              </Text>
              {roleLabel ? (
                <View
                  className="rounded-full"
                  style={{
                    backgroundColor: "#A078E820",
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    className="font-poppins-semibold text-[13px]"
                    style={{ color: "#A078E8" }}
                  >
                    {roleLabel}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text className="font-poppins-bold text-base text-primary">
              Informações pessoais
            </Text>

            <View
              className="rounded-2xl border border-surface-border bg-surface"
              style={{ padding: 16, gap: 16 }}
            >
              <Controller
                control={control}
                name="name"
                rules={{
                  required: "Informe seu nome",
                  minLength: { value: 2, message: "Mínimo 2 caracteres" },
                  maxLength: { value: 100, message: "Máximo 100 caracteres" },
                }}
                render={({ field: { onChange, value } }) => (
                  <FormInput
                    label="Nome"
                    value={value}
                    onChangeText={onChange}
                    error={errors.name?.message}
                    placeholder="Seu nome"
                  />
                )}
              />
              <Controller
                control={control}
                name="phone"
                rules={{
                  maxLength: { value: 20, message: "Máximo 20 caracteres" },
                }}
                render={({ field: { onChange, value } }) => (
                  <FormInput
                    label="Telefone"
                    value={value ?? ""}
                    onChangeText={(t) => onChange(t || null)}
                    error={errors.phone?.message}
                    placeholder="(11) 99999-9999"
                    keyboardType="phone-pad"
                  />
                )}
              />
              <Controller
                control={control}
                name="instagram"
                rules={{
                  maxLength: { value: 30, message: "Máximo 30 caracteres" },
                }}
                render={({ field: { onChange, value } }) => (
                  <FormInput
                    label="Instagram"
                    value={value ?? ""}
                    onChangeText={(t) => onChange(t || null)}
                    error={errors.instagram?.message}
                    placeholder="@seuusuario"
                    autoCapitalize="none"
                  />
                )}
              />
              <Controller
                control={control}
                name="birthDate"
                render={({ field: { onChange, value } }) => (
                  <DatePickerField
                    label="Data de nascimento"
                    value={value}
                    onChange={onChange}
                    error={errors.birthDate?.message}
                  />
                )}
              />
            </View>

            <View className="overflow-hidden rounded-2xl border border-surface-border bg-surface">
              <View
                className="flex-row items-center"
                style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}
              >
                <Mail size={18} color="#525252" />
                <View className="min-w-0 flex-1" style={{ gap: 2 }}>
                  <Text className="font-poppins text-xs text-muted">
                    Email (somente leitura)
                  </Text>
                  <Text className="font-poppins text-sm text-primary">
                    {user.email}
                  </Text>
                </View>
                <Lock size={14} color="#525252" />
              </View>
              <View className="h-px w-full bg-surface-border" />
              <View
                className="flex-row items-center"
                style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}
              >
                <UserCheck size={18} color="#525252" />
                <View className="min-w-0 flex-1" style={{ gap: 2 }}>
                  <Text className="font-poppins text-xs text-muted">
                    Função (somente leitura)
                  </Text>
                  <Text className="font-poppins text-sm text-primary">
                    {roleLabel}
                  </Text>
                </View>
                <Lock size={14} color="#525252" />
              </View>
            </View>

            <GradientButton
              label="Salvar alterações"
              onPress={onSave}
              disabled={!isDirty}
              loading={updateProfile.isPending}
            />

            <View className="overflow-hidden rounded-2xl border border-surface-border bg-surface">
              <Pressable
                onPress={handleLogout}
                className="flex-row items-center"
                style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}
              >
                <LogOut size={18} color="#ABABAB" />
                <Text className="min-w-0 flex-1 font-poppins-medium text-sm text-muted">
                  Sair da conta
                </Text>
                <ChevronRight size={18} color="#525252" />
              </Pressable>
              <View className="h-px w-full bg-surface-border" />
              <Pressable
                onPress={handleDeleteAccount}
                className="flex-row items-center"
                style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}
              >
                <Trash2 size={18} color="#EF4444" />
                <Text
                  className="min-w-0 flex-1 font-poppins-medium text-sm"
                  style={{ color: "#EF4444" }}
                >
                  Excluir minha conta
                </Text>
                <ChevronRight size={18} color="#525252" />
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

