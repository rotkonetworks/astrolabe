# Build stage for Rust WASM
FROM rust:slim AS rust-builder
WORKDIR /usr/src/app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo install wasm-pack
RUN wasm-pack build --target web --out-dir /tmp/pkg

# Build stage for Bun and Solid.js
FROM oven/bun:alpine AS bun-builder
WORKDIR /usr/src/app
COPY www ./www
COPY --from=rust-builder /tmp/pkg ./www/pkg

WORKDIR /usr/src/app/www
RUN bun install
RUN bun run build

# Final stage
FROM oven/bun:alpine AS finalboss
WORKDIR /usr/src/app
COPY --from=bun-builder /usr/src/app/www/.output ./.output
COPY --from=bun-builder /usr/src/app/www/package.json ./package.json

# Install only production dependencies
RUN bun install --production

# Set environment variables
ENV NODE_ENV=production

# Start the application
CMD ["bun", "run", ".output/server/index.mjs"]
