import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-error";
import {
  describeAcademyLoadError,
  describeMembershipRequestError,
} from "@/lib/membership-errors";

/** The sentences the API actually sends, copied from `membership.service.ts`. */
const API_409_ELSEWHERE =
  "You already have an active academy membership; leave before joining another";
const API_409_PENDING = "You already have a pending request for this academy";
const API_403 = "Cannot request again for this academy until a manager unblocks you";
const API_404 = "Academy not found";

const ACADEMY_SCREEN = new URL(
  "../app/(app)/(joining)/academy/[academyId].tsx",
  import.meta.url,
).pathname;

describe("the membership request failure", () => {
  it("explains a blocked or rejected academy", () => {
    expect(
      describeMembershipRequestError(new ApiError(403, API_403), false),
    ).toBe(
      "Você não pode solicitar entrada nesta academia novamente até que um gestor libere seu acesso.",
    );
  });

  it("tells a member of another academy to leave it first", () => {
    expect(
      describeMembershipRequestError(new ApiError(409, API_409_ELSEWHERE), true),
    ).toBe("Você já faz parte de uma academia. Saia da atual antes de entrar em outra.");
  });

  it("tells someone their request is already in", () => {
    // Same status, different sentence, and the split comes from `/users/me`
    // rather than from the English text - which would break the moment someone
    // rewords it on the server.
    expect(
      describeMembershipRequestError(new ApiError(409, API_409_PENDING), false),
    ).toBe("Você já tem uma solicitação pendente nesta academia.");
  });

  it("treats an unknown academy and a malformed id the same way", () => {
    // From where the person is standing both mean the link points nowhere.
    for (const status of [400, 404]) {
      expect(
        describeMembershipRequestError(new ApiError(status, API_404), false),
        String(status),
      ).toBe("Academia não encontrada. Peça um link de convite novo ao gestor.");
    }
  });

  it("falls back when it does not recognise the failure", () => {
    const unrecognised: unknown[] = [
      new ApiError(500, "Internal error"),
      new Error("Network request failed"),
      "a string nobody expected",
      null,
    ];

    for (const error of unrecognised) {
      expect(
        describeMembershipRequestError(error, false),
        String(error),
      ).toBe("Não foi possível enviar sua solicitação. Tente novamente.");
    }
  });
});

describe("the academy load failure", () => {
  it("says an invite link points nowhere", () => {
    for (const status of [400, 404]) {
      expect(
        describeAcademyLoadError(new ApiError(status, API_404)),
        String(status),
      ).toBe("Academia não encontrada. O link de convite pode estar inválido.");
    }
  });

  it("blames the connection when it does not know", () => {
    // Telling someone their academy is gone during an outage is worse than
    // blaming the connection — the same split `apps/web/lib/invite.ts` makes.
    for (const error of [new ApiError(500, "Internal error"), new Error("offline")]) {
      expect(describeAcademyLoadError(error)).toBe(
        "Não foi possível carregar a academia. Verifique sua conexão e tente novamente.",
      );
    }
  });
});

describe("the sentences themselves", () => {
  it("never leaks the API sentence", () => {
    const cases: Array<[string, string]> = [
      [describeMembershipRequestError(new ApiError(403, API_403), false), API_403],
      [
        describeMembershipRequestError(new ApiError(409, API_409_ELSEWHERE), true),
        API_409_ELSEWHERE,
      ],
      [
        describeMembershipRequestError(new ApiError(409, API_409_PENDING), false),
        API_409_PENDING,
      ],
      [describeMembershipRequestError(new ApiError(404, API_404), false), API_404],
      [describeMembershipRequestError(new ApiError(500, "Internal error"), false), "Internal error"],
      [describeAcademyLoadError(new ApiError(404, API_404)), API_404],
      [describeAcademyLoadError(new ApiError(500, "Internal error")), "Internal error"],
    ];

    expect(cases).toHaveLength(7);

    for (const [sentence, apiMessage] of cases) {
      // Brazilian Portuguese, with its accents. A sentence with none is a sign
      // somebody wrote English into this table.
      expect(sentence, sentence).toMatch(/[áâãàéêíóôõúüç]/i);

      // And none of the API's own words survived into it. Three words is long
      // enough that a coincidence is not plausible and short enough to catch a
      // partial copy.
      const words = apiMessage.split(" ");
      for (let i = 0; i + 3 <= words.length; i += 1) {
        expect(sentence, apiMessage).not.toContain(words.slice(i, i + 3).join(" "));
      }
    }
  });

  it("leaves the destination to the gatekeeper", () => {
    // Both response statuses now leave by `/(app)`. A second destination in
    // this screen is a second copy of the membership rules.
    const screen = readFileSync(ACADEMY_SCREEN, "utf8");

    expect(screen).not.toContain("(joining)/pending-approval");

    // The absence alone was half of AC 44: a screen that navigated nowhere on
    // success would pass it. `onSuccess` has to carry exactly one destination
    // and it has to be the app root, with no branch on `data.status`.
    const onSuccess = screen.slice(
      screen.indexOf("onSuccess:"),
      screen.indexOf("onError:"),
    );

    expect(onSuccess).toContain('router.replace("/(app)")');
    expect(onSuccess.match(/router\.replace\(/g)).toHaveLength(1);
    expect(onSuccess).not.toContain("data.status");
    expect(onSuccess).not.toContain('"active"');
  });
});
