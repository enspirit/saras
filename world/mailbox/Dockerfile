# The mailbox of the stack: a mail provider, as the stack meets it. An IMAP
# server holding sample emails and an SMTP server that sends nothing.
#
# Node runs the TypeScript files directly: nothing is compiled.
FROM node:24-alpine

WORKDIR /home/app

# Manifests first, so editing an email does not reinstall.
COPY package*.json ./
RUN npm ci

COPY *.ts ./

USER node

CMD ["node", "server.ts"]
