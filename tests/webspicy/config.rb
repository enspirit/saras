require 'webspicy'

# The black-box specification of saras's API.
#
# Webspicy specifies each route as an operation — input, output and error
# schemas, plus pre/post/errconditions — and derives the tests from that. This
# suite knows only what saras answers over HTTP.
#
#     emb run test:webspicy
#     S=api/public/get.yml emb run test:webspicy:one

Webspicy::Configuration.new(Path.dir) do |c|
  # No default: a black-box suite that silently targets localhost passes
  # against whatever happens to be listening. An origin, with no path.
  c.host = ENV.fetch('SARAS_API')
  c.client = Webspicy::Web::HttpClient

  # The specifications live under `formaldoc/`, in a tree that mirrors the
  # front door's URL space. Scoping to it keeps webspicy from reading every
  # `.yml` under the suite root as a specification.
  #
  # Last, because a child configuration copies the conditions registered at
  # the time of the call.
  c.folder 'formaldoc'
end
