import { Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ClassForm, type ClassFormData } from "@/components/ClassForm";
import { ApiError } from "@/lib/api";
import { useAcademyContext } from "@/lib/academy-context";
import { useCreateClass } from "@/lib/hooks/use-classes";
import { useMembers } from "@/lib/hooks/use-membership";

export default function ManagerCreateClass() {
  const router = useRouter();
  const { academyId } = useAcademyContext();
  const createClass = useCreateClass();
  const { data: members } = useMembers(academyId, {
    role: "instructor",
    status: "active",
  });

  const instructors = (members ?? []).map((m) => ({
    id: m.userId,
    name: m.userName,
  }));

  const handleSubmit = async (data: ClassFormData) => {
    const daysToCreate = [
      ...new Set([data.dayOfWeek, ...(data.extraDays ?? [])]),
    ];

    try {
      for (const day of daysToCreate) {
        await createClass.mutateAsync({
          instructorId: data.instructorId,
          name: data.name,
          description: data.description || null,
          dayOfWeek: day,
          startTime: data.startTime,
          endTime: data.endTime,
          capacity: data.capacity,
        });
      }
      router.back();
    } catch (e) {
      const message =
        e instanceof ApiError ? e.message : "Não foi possível criar a aula";
      Alert.alert("Erro", message);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ClassForm
        mode="create"
        canSelectInstructor
        instructors={instructors}
        onSubmit={handleSubmit}
        isSubmitting={createClass.isPending}
      />
    </SafeAreaView>
  );
}
