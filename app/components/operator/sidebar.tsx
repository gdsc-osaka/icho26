import { Form, NavLink } from "react-router";
import { Icon } from "../icon";

type NavItem = {
  to: string;
  icon: string;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/operator/dashboard", icon: "dashboard", label: "ダッシュボード" },
  { to: "/operator/issue", icon: "badge", label: "ID 発行" },
  { to: "/operator/analytics", icon: "monitoring", label: "分析" },
  { to: "/operator/dowsing-test", icon: "radar", label: "ダウジングテスト" },
];

/**
 * Light-theme admin sidebar. Renders fixed nav links + bottom logout.
 * Used inside `OperatorShell`.
 */
export function OperatorSidebar() {
  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-gray-200 bg-white md:flex">
      <div className="flex h-14 items-center gap-2 border-b border-gray-200 px-4">
        <Icon name="shield_person" className="text-base text-gray-900" />
        <span className="font-mono text-xs font-bold uppercase tracking-widest text-gray-900">
          icho26 / OPERATOR
        </span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-gray-900 text-white"
                  : "text-gray-700 hover:bg-gray-100",
              ].join(" ")
            }
          >
            <Icon name={item.icon} className="text-base" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-gray-200 p-3">
        <Form method="post" action="/operator/login?action=logout">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            <Icon name="logout" className="text-base" />
            ログアウト
          </button>
        </Form>
      </div>
    </aside>
  );
}

/** モバイル/tablet 向け簡易タブバー（fixed bottom）。 */
export function OperatorMobileTabs() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t border-gray-200 bg-white md:hidden">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            [
              "flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium",
              isActive ? "text-gray-900" : "text-gray-500",
            ].join(" ")
          }
        >
          <Icon name={item.icon} className="text-lg" />
          {item.label}
        </NavLink>
      ))}
      <Form
        method="post"
        action="/operator/login?action=logout"
        className="flex flex-1"
      >
        <button
          type="submit"
          className="flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium text-gray-500"
        >
          <Icon name="logout" className="text-lg" />
          ログアウト
        </button>
      </Form>
    </nav>
  );
}
