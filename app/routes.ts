import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("operator/login", "routes/operator.login.tsx"),
  layout("routes/operator.tsx", [
    route("operator/dashboard", "routes/operator.dashboard.tsx"),
  ]),
] satisfies RouteConfig;
