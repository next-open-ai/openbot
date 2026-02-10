# OpenBot Docker image: 构建并运行 CLI / Gateway（含 Desktop 后端与 Web 前端静态资源）
# 构建时在 openbot 仓库根目录执行: docker build -f deploy/Dockerfile -t openbot .

# ------------------------------------------------------------------------------
# Stage 1: 构建（使用完整镜像以便 node-gyp 编译 better-sqlite3 等原生模块）
# ------------------------------------------------------------------------------
#FROM node:20-bookworm AS builder
FROM ccr.ccs.tencentyun.com/windwithlife/node:22.11.0  AS builder

WORKDIR /app

# 根项目依赖（含 devDependencies，用于 tsc 构建）
COPY package.json package-lock.json ./
RUN npm ci

# 源码与配置
COPY tsconfig.json ./
COPY src ./src
COPY skills ./skills

# 构建主包（产出 dist/）
RUN npm run build

# 构建 Desktop 前端静态资源（Gateway 会从 desktop/renderer/dist 提供 Web UI）
COPY desktop/package.json desktop/package-lock.json desktop/
COPY desktop/renderer ./desktop/renderer
RUN cd desktop/renderer && npm ci && npm run build

# ------------------------------------------------------------------------------
# Stage 2: 运行镜像
# ------------------------------------------------------------------------------
#FROM node:20-bookworm-slim
FROM ccr.ccs.tencentyun.com/windwithlife/node:22-alpine
WORKDIR /app

# 从构建阶段拷贝依赖与产物（避免在 slim 中重新编译 better-sqlite3）
COPY package.json package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
RUN npm prune --production

# 从构建阶段拷贝产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/skills ./skills
COPY --from=builder /app/desktop/renderer/dist ./desktop/renderer/dist

ENV NODE_ENV=production

# Gateway 默认端口；CLI 可通过 CMD 覆盖
EXPOSE 38080

# 使用 openbot CLI；默认启动 Gateway
ENTRYPOINT ["node", "dist/cli.js"]
CMD ["gateway", "--port", "38080"]
