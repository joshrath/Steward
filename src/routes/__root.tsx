import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { HouseMood } from "@/components/steward/faces";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";

const APP_NAME = "Steward";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "Steward keeps a house of Proxmox guests and Unraid containers in order, and telephones only when it matters.",
      },
      { name: "theme-color", content: "#7a2430" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Mono:wght@400;500&family=Source+Sans+3:ital,wght@0,400;0,500;0,600;1,400&display=swap",
      },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var a='system';var raw=localStorage.getItem('steward-v1');if(raw){var j=JSON.parse(raw);a=(j.state&&j.state.settings&&j.state.settings.appearance)||'system';}var dark=a==='dark'||(a!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',!!dark);document.documentElement.style.colorScheme=dark?'dark':'light';}catch(e){}})();",
          }}
        />
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <HouseMood />
        <Scripts />
      </body>
    </html>
  ),
});
