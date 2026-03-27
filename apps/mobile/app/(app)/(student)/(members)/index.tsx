import { MembersListContent } from "@/components/MembersListContent";

const STUDENT_TABS = [
  { key: "all", label: "Todos" },
  { key: "instructor", label: "Instrutores" },
  { key: "student", label: "Alunos" },
];

export default function StudentMembersScreen() {
  return <MembersListContent tabs={STUDENT_TABS} />;
}
