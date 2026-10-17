/* ============================================================
   CABINET ADMIN — маршрутизация закрытой зоны.
   Публичный сайт не ссылается на эти пути и не индексирует их.
   ============================================================ */
import { useParams, Navigate } from "react-router-dom";
import CabinetLayout, { EmptyState } from "./layout";
import {
  HomeScreen, AgentScreen, SourcesScreen, ObservationsScreen, QueueScreen, PoliciesScreen,
  ReleasePlanScreen, TracesScreen, EvalScreen, RoiScreen, UsersScreen, SellersScreen,
  CatalogScreen, SearchAnalyticsScreen, OrdersScreen, FinanceScreen, DisputesScreen,
  SupportScreen, SecurityScreen, ContentScreen, AnalyticsScreen, ReleasesScreen,
  SettingsScreen, LearningScreen, IntelScreen, LogsScreen,
} from "./screens";

const ROUTES: Record<string, () => any> = {
  decisions: () => <Navigate to="/admin/queue" replace />,
  "": HomeScreen,
  agent: AgentScreen,
  sources: SourcesScreen,
  observations: ObservationsScreen,
  queue: QueueScreen,
  policies: PoliciesScreen,
  "release-plan": ReleasePlanScreen,
  traces: TracesScreen,
  eval: EvalScreen,
  roi: RoiScreen,
  users: UsersScreen,
  sellers: SellersScreen,
  catalog: CatalogScreen,
  "search-analytics": SearchAnalyticsScreen,
  orders: OrdersScreen,
  finance: FinanceScreen,
  disputes: DisputesScreen,
  support: SupportScreen,
  security: SecurityScreen,
  content: ContentScreen,
  analytics: AnalyticsScreen,
  releases: ReleasesScreen,
  settings: SettingsScreen,
  learning: LearningScreen,
  intel: IntelScreen,
logs: LogsScreen,
};

export default function CabinetRouter() {
  const p = useParams();
  const seg = p.seg || "";
  const Screen = ROUTES[seg];
  if (!Screen) {
    return <CabinetLayout content={<EmptyState title="Раздел не найден" why="Такого раздела кабинета нет или он недоступен для вашей роли." />} />;
  }
  return <CabinetLayout content={<Screen />} />;
}
