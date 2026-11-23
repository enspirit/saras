# The black-box suite. Ruby, because webspicy is a Ruby gem — and that second
# toolchain is the point: a suite written in the product's language, with its
# types, against its objects, is not black-box.
#
# The container sleeps and the suite is `exec`ed into it. Two things it buys:
# CI needs nothing but docker, and the suite is on the compose network, so it
# reaches saras through the front door.
#
# The full image, not -slim: several gems build native extensions. `curl` is
# already in it, and the readiness wait in Embfile.yml needs it.
FROM ruby:3.3

WORKDIR /home/app

# Manifests first, so editing a specification does not reinstall the gems.
COPY Gemfile Gemfile.lock ./
RUN bundle install

COPY . .

CMD ["tail", "-f", "/dev/null"]
