{{- define "saras.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "saras.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else if contains (include "saras.name" .) .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name (include "saras.name" .) | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{- define "saras.selectorLabels" -}}
app.kubernetes.io/name: {{ include "saras.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "saras.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{ include "saras.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/* The variables of env/base.env that are secrets: `secrets` takes these, and `config` none of them. */}}
{{- define "saras.secretVariables" -}}
APP_SECRET DATABASE_URL OPENROUTER_API_KEY SMTP_URL GOOGLE_CLIENT_SECRET MICROSOFT_CLIENT_SECRET
{{- end }}

{{/* The variables of env/base.env the chart sets itself, from values of its own. */}}
{{- define "saras.ownVariables" -}}
PORT BASE_URL DATA_DIR BRAND_DIR
{{- end }}

{{/* The secrets given a value: what the chart's own Secret holds. */}}
{{- define "saras.givenSecrets" -}}
{{- $given := dict }}
{{- range $name, $value := .Values.secrets }}
{{- if $value }}{{ $_ := set $given $name (toString $value) }}{{ end }}
{{- end }}
{{- toJson $given }}
{{- end }}

{{/* BASE_URL: what the values say, else where the ingress answers, else nothing. */}}
{{- define "saras.baseUrl" -}}
{{- if .Values.baseUrl }}
{{- .Values.baseUrl }}
{{- else if .Values.ingress.enabled }}
{{- printf "%s://%s" (ternary "https" "http" (ne .Values.ingress.tlsSecret "")) .Values.ingress.host }}
{{- end }}
{{- end }}

{{/* What the chart refuses to install, said before anything is rendered. */}}
{{- define "saras.validate" -}}
{{- $secret := splitList " " (include "saras.secretVariables" .) }}
{{- $own := splitList " " (include "saras.ownVariables" .) }}
{{- range $name, $_ := .Values.config }}
{{- if has $name $secret }}
{{- fail (printf "config.%s: %s is a secret. Give it as secrets.%s, or in existingSecret" $name $name $name) }}
{{- end }}
{{- if has $name $own }}
{{- fail (printf "config.%s: the chart sets %s itself, from baseUrl, brand.configMap or embeddedDatabase" $name $name) }}
{{- end }}
{{- end }}
{{- range $name, $_ := .Values.secrets }}
{{- if not (has $name $secret) }}
{{- fail (printf "secrets.%s: not a secret saras reads. They are: %s" $name (join ", " $secret)) }}
{{- end }}
{{- end }}
{{- if and (not .Values.existingSecret) (lt (len (toString .Values.secrets.APP_SECRET)) 32) }}
{{- fail "secrets.APP_SECRET is missing or too short (32 characters minimum). Generate one with: openssl rand -hex 32. Or name a Secret that holds it: existingSecret" }}
{{- end }}
{{- if .Values.embeddedDatabase.enabled }}
{{- if .Values.secrets.DATABASE_URL }}
{{- fail "embeddedDatabase.enabled and secrets.DATABASE_URL: one database or the other" }}
{{- end }}
{{- else if not (or .Values.existingSecret .Values.secrets.DATABASE_URL) }}
{{- fail "No database: name a PostgreSQL server with secrets.DATABASE_URL (or in existingSecret), or set embeddedDatabase.enabled=true to try saras on its embedded one" }}
{{- end }}
{{- if and .Values.ingress.enabled (not .Values.ingress.host) }}
{{- fail "ingress.enabled: ingress.host is required" }}
{{- end }}
{{- end }}
