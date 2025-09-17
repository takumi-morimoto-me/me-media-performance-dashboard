'use client'

import * as React from "react"
import { useMedias } from "@/contexts/media-context"
import { navData } from "@/lib/nav-data"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { medias } = useMedias();

  const dynamicNavMain = React.useMemo(() => {
    // Firestoreから取得したメディアでナビゲーション項目を生成
    const mediaNavItems = medias.map(media => ({
      title: media.name,
      url: `/media/${media.slug}`,
      items: [],
    }));

    // 元のナビゲーションデータの「メディア」項目を動的に置き換え
    return navData.navMain.map(navItem => {
      if (navItem.title === "メディア") {
        return {
          ...navItem,
          items: mediaNavItems,
        };
      }
      return navItem;
    });
  }, [medias]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        {/* Logo placeholder */}
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={dynamicNavMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={navData.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}