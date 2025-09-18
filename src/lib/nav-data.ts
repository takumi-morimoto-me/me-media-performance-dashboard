import { Database, Newspaper, PieChart, Settings2 } from "lucide-react";

export const navData = {
  user: {
    name: "User Name",
    email: "user@example.com",
    avatar: "", // Placeholder for user avatar
  },
  navMain: [
    {
      title: "ダッシュボード",
      url: "/dashboard",
      icon: PieChart,
      isActive: true, // Set this as the active page for now
      items: [], // No sub-items, will be rendered as a direct link
    },
    {
      title: "メディア",
      url: "#", // This is a parent item
      icon: Newspaper,
      isActive: false,
      items: [
        {
          title: "ビギナーズ",
          url: "/media/beginners",
        },
        {
          title: "最安修理",
          url: "/media/cheapest-repair",
        },
        {
          title: "Mortorz",
          url: "/media/mortorz",
        },
      ],
    },
    {
      title: "データ管理",
      url: "#",
      icon: Database,
      isActive: false,
      items: [
        {
          title: "予算管理",
          url: "/budget",
        },
        {
          title: "実績管理",
          url: "/performance",
        },
      ],
    },
    {
      title: "設定",
      url: "#",
      icon: Settings2,
      isActive: false,
      items: [
        {
          title: "全体設定",
          url: "/settings?tab=overall",
        },
        {
          title: "詳細設定",
          url: "/settings?tab=detailed",
        },
        {
          title: "システム管理",
          url: "/settings?tab=system",
        },
      ],
    },
  ],
};
