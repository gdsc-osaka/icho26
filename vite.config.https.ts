import fs from "node:fs";
import { defineConfig, mergeConfig, type Plugin } from "vite";
import baseConfig from "./vite.config";

// HTTP/2 では :authority 擬似ヘッダーが Host の代わりに使われるため、
// 下流の Host 依存ロジック (React Router の CSRF 保護など) のために復元する。
function injectHostFromAuthority(): Plugin {
  return {
    name: "inject-host-from-authority",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const raw = req.rawHeaders;
        let hasHost = false;
        let authority: string | undefined;
        for (let i = 0; i < raw.length; i += 2) {
          const name = raw[i].toLowerCase();
          if (name === "host") hasHost = true;
          else if (name === ":authority") authority = raw[i + 1];
        }
        if (!hasHost && authority) {
          raw.push("host", authority);
          if (!req.headers.host) req.headers.host = authority;
        }
        next();
      });
    },
  };
}

export default mergeConfig(
  baseConfig,
  defineConfig({
    plugins: [injectHostFromAuthority()],
    server: {
      host: true, // LAN内公開を許可
      https: {
        key: fs.readFileSync("./localhost+1-key.pem"),
        cert: fs.readFileSync("./localhost+1.pem"),
      },
    },
  }),
);
