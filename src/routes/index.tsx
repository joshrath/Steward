import { createFileRoute } from "@tanstack/react-router";
import { StewardApp } from "@/components/steward/app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <StewardApp />;
}
