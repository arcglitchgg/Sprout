"use client";

import { useContext } from "react";
import { DiscordContext } from "@/components/DiscordProvider";

export function useDiscord() {
  return useContext(DiscordContext);
}
