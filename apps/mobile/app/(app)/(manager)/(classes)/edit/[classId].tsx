import { ActivityIndicator, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ClassForm, type ClassFormData } from "@/components/ClassForm";
import { useAcademyContext } from "@/lib/academy-context";
import { useClass, useUpdateClass } from "@/lib/hooks/use-classes";
import { useMembers } from "@/lib/hooks/use-membership";

function formatTime(t: string) {
  const parts = t.split(":");
  const h = parts[0] ?? "0";
  const m = parts[1] ?? "00";
  return `${h.padStart(2, "0")}:${m}`;
}

function paramToId(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (Array.isArray(value) && typeof value[0] === "string" && value[0].length > 0)
    return value[0];
  return undefined;
}

export default function ManagerEditClass() {
  const { classId: rawClassId } = useLocalSearchParams<{ classId: string }>();
  const classId = paramToId(rawClassId);
  const router = useRouter();
  const { academyId } = useAcademyContext();
  const { data: cls, isLoading, isError } = useClass(classId ?? "");
  const updateClass = useUpdateClass(classId ?? "");
  const { data: members } = useMembers(academyId, {
    role: "instructor",
    status: "active",
  });

  if (!classId) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="font-poppins text-sm text-muted">Aula não encontrada</Text>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  if (isError || !cls) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="font-poppins text-sm text-muted">
          Não foi possível carregar esta aula
        </Text>
      </SafeAreaView>
    );
  }

  const instructors = (members ?? []).map((m) => ({
    id: m.userId,
    name: m.userName,
  }));

  const handleSubmit = (data: ClassFormData) => {
    updateClass.mutate(
      {
        name: data.name,
        description: data.description || null,
        instructorId: data.instructorId,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        capacity: data.capacity,
      },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ClassForm
        mode="edit"
        canSelectInstructor
        instructors={instructors}
        initialData={{
          name: cls.name,
          description: cls.description ?? "",
          instructorId: cls.instructorId,
          dayOfWeek: cls.dayOfWeek,
          startTime: formatTime(cls.startTime),
          endTime: formatTime(cls.endTime),
          capacity: cls.capacity,
        }}
        onSubmit={handleSubmit}
        isSubmitting={updateClass.isPending}
      />
    </SafeAreaView>
  );
}
