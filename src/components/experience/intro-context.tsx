"use client";

import { createContext, useContext } from "react";

type IntroValue = {
  /** True once the intro loader has lifted (always true on non-home routes). */
  ready: boolean;
};

const IntroContext = createContext<IntroValue>({ ready: true });

export function IntroProvider({
  ready,
  children
}: {
  ready: boolean;
  children: React.ReactNode;
}) {
  return <IntroContext.Provider value={{ ready }}>{children}</IntroContext.Provider>;
}

export function useIntro() {
  return useContext(IntroContext);
}
