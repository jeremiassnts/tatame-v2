import { ClassForm, type ClassFormData } from "@/components/ClassForm";
import { ApiError } from "@/lib/api";
import { useCreateClass } from "@/lib/hooks/use-classes";
import { useCurrentUser } from "@/lib/hooks/use-user";
import { useRouter } from "expo-router";
import { Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function InstructorCreateClass() {
  const router = useRouter();
  const createClass = useCreateClass();
  const { data: me } = useCurrentUser();

  const handleSubmit = async (data: ClassFormData) => {
    const daysToCreate = [
      ...new Set([data.dayOfWeek, ...(data.extraDays ?? [])]),
    ];

    try {
      for (const day of daysToCreate) {
        await createClass.mutateAsync({
          instructorId: me!.id,
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
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
      <ClassForm
        mode="create"
        canSelectInstructor={false}
        currentInstructorName={me?.name}
        onSubmit={handleSubmit}
        isSubmitting={createClass.isPending}
      />
    </SafeAreaView>
  );
}
