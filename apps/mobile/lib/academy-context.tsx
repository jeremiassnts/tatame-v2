import { createContext, useContext, useState, type ReactNode } from "react";

type AcademyContextValue = {
  academyId: string;
  academyName: string;
  academyLogoUrl: string | null;
};

type AcademyContextType = {
  value: AcademyContextValue;
  update: (next: AcademyContextValue) => void;
};

const AcademyContext = createContext<AcademyContextType | null>(null);

export function AcademyProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<AcademyContextValue>({
    academyId: "",
    academyName: "",
    academyLogoUrl: null,
  });

  return (
    <AcademyContext.Provider value={{ value, update: setValue }}>
      {children}
    </AcademyContext.Provider>
  );
}

export function useAcademyContext(): AcademyContextValue {
  const ctx = useContext(AcademyContext);
  if (!ctx) {
    throw new Error("useAcademyContext must be used within AcademyProvider");
  }
  return ctx.value;
}

export function useUpdateAcademyContext(): (next: AcademyContextValue) => void {
  const ctx = useContext(AcademyContext);
  if (!ctx) {
    throw new Error("useUpdateAcademyContext must be used within AcademyProvider");
  }
  return ctx.update;
}