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
  route("q2", "routes/q2.tsx"),
  route("q2/checkpoint", "routes/q2.checkpoint.tsx"),
  route("q3", "routes/q3.tsx"),
  route("q3/code", "routes/q3.code.tsx"),
  route("q4", "routes/q4.tsx"),
  // /release and /complete* are added in Step 4.

  // Operator routes (Step 5)
  route("operator/login", "routes/operator.login.tsx"),
  layout("routes/operator.tsx", [
    route("operator/dashboard", "routes/operator.dashboard.tsx"),
    route("operator/group/:groupId", "routes/operator.group.$groupId.tsx"),
  ]),
] satisfies RouteConfig;
