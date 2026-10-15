import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/panel/veterinaria/agenda")({
  beforeLoad: () => {
    throw redirect({
      to: "/panel/agenda",
      search: { modulo: "veterinary" },
    });
  },
});
