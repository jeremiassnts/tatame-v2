import { MembersListContent } from "@/components/MembersListContent";

export default function MembersListScreen() {
  return (
    <MembersListContent
      showBackButton
      allowMemberDetails
      getMemberDetailHref={(membershipId) =>
        `/(app)/(manager)/(members)/${membershipId}`
      }
    />
  );
}
