import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  // Participant routes (Step 2)
  route("start/:groupId", "routes/start.$groupId.tsx"),
  route("q1", "routes/q1.tsx"),
  route("q1/1", "routes/q1.1.tsx"),
  route("q1/2", "routes/q1.2.tsx"),
  route("q1/:sub/checkpoint", "routes/q1.$sub.checkpoint.tsx"),
  // Q2 / Q3 / Q4 / release / complete are added in Step 3 / Step 4.

  // Operator routes (Step 5)
  route("operator/login", "routes/operator.login.tsx"),
  layout("routes/operator.tsx", [
    route("operator/dashboard", "routes/operator.dashboard.tsx"),
    route("operator/group/:groupId", "routes/operator.group.$groupId.tsx"),
  ]),
] satisfies RouteConfig;
