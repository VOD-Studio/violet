# Official GitHub runner and Docker CLI images, pinned by digest.
FROM docker:29.7.2-cli@sha256:3f4743208d2338c934d7b8bcfbe1bb54c0b2355c510ad5e0f31c0c4a54bd704e AS docker-cli
FROM ghcr.io/actions/actions-runner:2.337.0@sha256:e5496277be5d09bc968b3d64911b74e219ac4a3f2edce956a3ecf9271bea1ef4

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       build-essential ca-certificates curl git jq libatomic1 \
       python3-pip python3-venv unzip xz-utils \
       fonts-freefont-ttf fonts-ipafont-gothic fonts-liberation \
       fonts-noto-color-emoji fonts-tlwg-loma-otf fonts-unifont fonts-wqy-zenhei \
       libasound2t64 libatk-bridge2.0-0t64 libatk1.0-0t64 libatspi2.0-0t64 \
       libcairo2 libcups2t64 libdbus-1-3 libdrm2 libfontconfig1 libfreetype6 \
       libgbm1 libglib2.0-0t64 libnspr4 libnss3 libpango-1.0-0 \
       libx11-6 libxcb1 libxcomposite1 libxdamage1 libxext6 libxfixes3 \
       libxkbcommon0 libxrandr2 xfonts-cyrillic xfonts-scalable xvfb \
    && dpkg-query -W > /etc/violet-runner-packages.txt \
    && rm -rf /var/lib/apt/lists/*
COPY --from=docker-cli /usr/local/bin/docker /usr/bin/docker
COPY --from=docker-cli /usr/local/libexec/docker/cli-plugins/ /usr/local/lib/docker/cli-plugins/
COPY --chmod=755 scripts/runner-entrypoint.sh scripts/runner-healthcheck.sh /usr/local/bin/
COPY --chmod=755 scripts/check-environment.sh /usr/local/bin/runner-check-environment
RUN chmod 700 /home/runner \
    && mkdir -p /home/runner/_work/_tool \
    && chown -R runner:runner /home/runner/_work
USER runner
WORKDIR /home/runner
RUN /usr/local/bin/runner-check-environment
