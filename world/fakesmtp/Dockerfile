# The mail server saras hands its own mail to, as the stack meets it: it
# accepts everything, delivers nothing, and shows what it was given.
#
# The container listens on 25 for SMTP and on 1080 for its page and its API.
FROM node:24-alpine

WORKDIR /home/app

# fake-smtp-server is unmaintained and asks for mailparser 2, whose mailsplit
# assigns the read-only `errored` of Node 18+ streams: every message fails with
# a 451. package.json overrides it with mailparser 3.
COPY package*.json ./
RUN npm ci

ENV PATH=/home/app/node_modules/.bin:$PATH

EXPOSE 25 1080

CMD ["fake-smtp-server", "-s", "25"]
