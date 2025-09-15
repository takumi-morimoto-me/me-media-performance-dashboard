'use client'

import { usePathname } from "next/navigation";

import { navData } from "@/lib/nav-data";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function Header() {
  const pathname = usePathname();

  const getPageTitle = () => {
    for (const section of navData.navMain) {
      if (section.url === pathname) {
        return section.title;
      }
      if (section.items && section.items.length > 0) {
        for (const subItem of section.items) {
          if (subItem.url === pathname) {
            return subItem.title;
          }
        }
      }
    }
    return ""; // Return empty string if no title is found
  };

  const title = getPageTitle();

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
      <SidebarTrigger className="md:hidden" />
      <div className="w-full flex-1">
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>
    </header>
  );
}