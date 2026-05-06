import Constants from "expo-constants";
import { Lock } from "lucide-react-native";
import { Linking, Modal, Pressable, Text, View } from "react-native";

const PORTAL_URL =
  Constants.expoConfig?.extra?.managerPortalUrl ?? "https://tatame.app/conta";

type PlanLimitModalProps = {
  visible: boolean;
  onClose: () => void;
  message: string;
};

export function PlanLimitModal({ visible, onClose, message }: PlanLimitModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-center px-6">
        <Pressable className="absolute inset-0 bg-black/60" onPress={onClose} />
        <View
          className="rounded-2xl border border-surface-border bg-surface"
          style={{ padding: 24, gap: 16, alignItems: "center" }}
        >
          <View
            className="items-center justify-center rounded-full"
            style={{ width: 56, height: 56, backgroundColor: "#A078E820" }}
          >
            <Lock size={24} color="#A078E8" />
          </View>
          <Text className="font-poppins-bold text-lg text-primary text-center">
            Limite atingido
          </Text>
          <Text className="font-poppins text-sm text-muted text-center">
            {message}
          </Text>
          <Pressable
            onPress={() => {
              onClose();
              Linking.openURL(PORTAL_URL);
            }}
            className="w-full items-center rounded-xl bg-accent"
            style={{ paddingVertical: 14 }}
          >
            <Text className="font-poppins-semibold text-sm text-white">
              Gerenciar conta
            </Text>
          </Pressable>
          <Pressable onPress={onClose}>
            <Text className="font-poppins text-sm text-muted">Fechar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export const PLAN_LIMIT_MESSAGES: Record<string, string> = {
  PLAN_LIMIT_STUDENTS: "Voce atingiu o numero maximo de alunos para sua conta.",
  PLAN_LIMIT_INSTRUCTORS: "Voce atingiu o numero maximo de instrutores para sua conta.",
  PLAN_LIMIT_CLASSES: "Voce atingiu o numero maximo de aulas por dia para sua conta.",
  PLAN_LIMIT_PLANS: "Voce atingiu o numero maximo de planos para sua conta.",
  PLAN_LIMIT_PAYMENTS: "Pagamentos automaticos nao estao disponiveis para sua conta.",
};
