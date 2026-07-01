"use client";

import { createContext, useContext } from "react";
import { PinAuthProvider, PinPromptProvider } from "./PinPad";
import type { Member } from "@/lib/types";

const ParentsContext = createContext<Member[]>([]);

export function PinProviders({
  hasPinByMember,
  parents,
  children,
}: {
  hasPinByMember: Record<number, boolean>;
  parents: Member[];
  children: React.ReactNode;
}) {
  return (
    <PinAuthProvider>
      <PinPromptProvider hasPinByMember={hasPinByMember}>
        <ParentsContext.Provider value={parents}>{children}</ParentsContext.Provider>
      </PinPromptProvider>
    </PinAuthProvider>
  );
}

export function useParents(): Member[] {
  return useContext(ParentsContext);
}
