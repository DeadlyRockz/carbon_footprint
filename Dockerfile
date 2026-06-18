# Use Node.js 20 Alpine as the base image for building
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy the application code
COPY . .

# Run the build script to bundle the application (no npm dependencies needed)
RUN node ./scripts/build.js

# Use a clean, minimal image for the runtime stage
FROM node:20-alpine

WORKDIR /usr/src/app

# Copy application files needed for running the server
COPY --from=builder /usr/src/app/index.html ./index.html
COPY --from=builder /usr/src/app/app.bundle.js ./app.bundle.js
COPY --from=builder /usr/src/app/manifest.webmanifest ./manifest.webmanifest
COPY --from=builder /usr/src/app/sw.js ./sw.js
COPY --from=builder /usr/src/app/icon.svg ./icon.svg
COPY --from=builder /usr/src/app/src/styles.css ./src/styles.css
COPY --from=builder /usr/src/app/scripts/serve.js ./scripts/serve.js

# Expose the port (Cloud Run automatically sets the PORT environment variable, defaults to 8080)
EXPOSE 8080
ENV PORT=8080

# Run the application using Node directly
CMD ["node", "./scripts/serve.js"]
