# The operations suite: the specifications of saras's operations, on the image of what runs
# them, opspicy (https://github.com/enspirit/opspicy), at the version .env.commons names.
#
# The container sleeps and the suite is `exec`ed into it. Two things it buys:
# CI needs nothing but docker, and the suite is on the compose network, so it
# reaches saras through the front door.
ARG OPSPICY
FROM ${OPSPICY}

# Everything of the suite, area by area, but what .dockerignore names: in /suite, where
# opspicy looks for one.
COPY . ./

CMD ["tail", "-f", "/dev/null"]
