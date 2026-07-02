import type { MetadataRoute } from "next";

// Icons land with the Phase 7 design pass; until then the manifest carries
// identity + theming only.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Astrameath",
    short_name: "Astrameath",
    description: "Level up your life.",
    start_url: "/",
    display: "standalone",
    background_color: "#06080f",
    theme_color: "#06080f",
  };
}
