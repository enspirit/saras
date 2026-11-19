# mailia

Outil web auto-hébergé pour répondre à ses emails avec l'aide de l'IA, sans lui laisser la main :

1. **Connecter** une ou plusieurs boîtes mail : IMAP/SMTP, Gmail / Google Workspace (OAuth), Outlook / Microsoft 365 (OAuth).
2. **Identifier** les emails qui attendent une réponse. Des règles locales écartent newsletters et notifications ; l'IA trie le reste et suggère le prompt le plus adapté.
3. **Proposer** une réponse à partir d'un *system prompt* préconçu, choisi email par email (celui suggéré, ou un autre), avec des consignes ponctuelles si besoin.
4. **Envoyer** en votre nom, après relecture. Si vous modifiez la proposition, vous pouvez dire pourquoi : cette raison est réinjectée dans les prochaines propositions faites avec le même prompt.

Rien n'est envoyé sans validation explicite.

## Confidentialité

C'est la contrainte de conception principale.

| Garantie | Comment |
| --- | --- |
| Pas de conservation ni d'entraînement côté LLM | Chaque requête OpenRouter porte `provider: { "zdr": true, "data_collection": "deny" }` ([doc](https://openrouter.ai/docs/guides/routing/provider-selection)). C'est codé en dur dans `src/llm/openrouter.js`, seul point de sortie du contenu des emails, et non désactivable par configuration. |
| Pas de repli silencieux | Si aucun fournisseur du modèle choisi ne satisfait ces deux conditions, OpenRouter refuse la requête et l'application affiche l'erreur. |
| Minimisation | Newsletters, listes de diffusion, adresses `no-reply` et messages automatiques sont écartés par des règles sur les en-têtes et ne partent jamais vers le LLM. |
| Secrets chiffrés | Mots de passe IMAP/SMTP, tokens OAuth et clés API sont chiffrés en base (AES-256-GCM, clé dérivée de `APP_SECRET`). |
| Transport | Hors TLS direct, STARTTLS est exigé pour IMAP et SMTP (sauf serveur local) : aucun mot de passe en clair. |
| Rétention locale | Le contenu des emails est effacé de la base après `RETENTION_DAYS` jours (30 par défaut). |
| Journaux | Le serveur ne journalise jamais le contenu des emails ni des requêtes. |

**Ce qui reste à votre charge** (l'application ne peut pas le garantir à votre place) :

- Dans votre compte OpenRouter (*Settings → Privacy*), laissez **désactivée** la journalisation des prompts et des réponses. Le ZDR par requête couvre les fournisseurs de modèles, pas ce réglage de compte.
- Vérifiez que le modèle choisi a bien un fournisseur ZDR ; sinon les requêtes échoueront (c'est voulu).
- Le ZDR est un engagement contractuel des fournisseurs, relayé par OpenRouter : ce n'est pas vérifiable techniquement depuis l'application.

## Démarrage

Prérequis : Node.js ≥ 22.

```sh
npm install
cp .env.example .env
# renseigner APP_SECRET (openssl rand -hex 32) et OPENROUTER_API_KEY
npm start
```

Ouvrez http://localhost:3000, créez votre compte, puis connectez une boîte dans **Comptes mail**. Une fois votre compte créé, passez `ALLOW_SIGNUP=false` pour fermer les inscriptions.

Avec Docker :

```sh
cp .env.example .env   # puis éditer
docker compose up -d
```

En production, placez l'application derrière un reverse proxy HTTPS et renseignez `BASE_URL=https://…` (le cookie de session devient alors `Secure`).

### Connexion IMAP / SMTP

Fonctionne avec toute boîte standard (OVH, Infomaniak, Fastmail, Proton Bridge, etc.). Utilisez de préférence un mot de passe d'application. La connexion est testée avant d'être enregistrée.

### Connexion Google

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) : créer un projet, activer l'API Gmail, créer un identifiant OAuth « Application Web ».
2. URI de redirection autorisée : `{BASE_URL}/api/oauth/google/callback`.
3. Renseigner `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`.

Scopes demandés : `gmail.readonly` et `gmail.send`. `gmail.readonly` est un scope « restreint » chez Google : pour un usage interne (Workspace, type « Interne ») ou en mode test avec quelques comptes déclarés, aucune validation n'est requise ; une diffusion publique exige l'audit de sécurité de Google.

### Connexion Microsoft

1. [Entra ID](https://entra.microsoft.com) → Inscriptions d'applications → Nouvelle inscription, plateforme « Web ».
2. URI de redirection : `{BASE_URL}/api/oauth/microsoft/callback`.
3. Autorisations déléguées Microsoft Graph : `Mail.ReadWrite`, `Mail.Send`, `User.Read`, `offline_access`.
4. Créer un secret client, renseigner `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` et, pour restreindre à votre organisation, `MICROSOFT_TENANT`.

## Configuration

Toutes les variables sont décrites dans [`.env.example`](.env.example). Le modèle par défaut (`OPENROUTER_MODEL`) peut être remplacé par utilisateur dans **Réglages**, de même que la clé OpenRouter.

## Fonctionnement

```
boîte mail ──► relève (IMAP / Gmail API / Graph)
                 │
                 ├─ règles locales ──► « Sans réponse requise »   (jamais envoyé au LLM)
                 │
                 └─ tri LLM (ZDR) ──► « À traiter » + prompt suggéré
                                         │
                       vous choisissez le prompt, ajoutez des consignes
                                         │
                              proposition LLM (ZDR)
                                         │
                     vous relisez, modifiez, expliquez (optionnel)
                                         │
                       envoi en votre nom (SMTP / Gmail API / Graph)
```

- `src/triage.js`, `src/reply.js`, `src/llm/prompts.js` : décisions pures (tri, mise en forme de la réponse, construction des prompts).
- `src/llm/openrouter.js` : client OpenRouter, politique de confidentialité imposée.
- `src/mail/` : un fournisseur par type de boîte, même interface (`verify`, `listNew`, `send`).
- `src/sync.js` : relève et tri ; `src/app.js` : API HTTP ; `public/` : interface (sans étape de build).
- Données : SQLite dans `DATA_DIR`.

Le contenu d'un email reçu est traité comme une donnée non fiable : il est délimité dans les prompts et le modèle a pour consigne de ne pas suivre les instructions qu'il contiendrait. La relecture humaine avant envoi reste la vraie protection.

## Tests

```sh
npm test
```

Les tests de bout en bout démarrent un vrai serveur IMAP et un vrai serveur SMTP locaux, ainsi qu'un faux OpenRouter qui enregistre les requêtes reçues ; ils vérifient notamment que chaque requête porte la politique ZDR et qu'une newsletter n'atteint jamais le LLM.

## Limites connues

- Les connecteurs Gmail et Microsoft Graph sont couverts par des tests de conversion des messages, mais n'ont pas été exercés contre les services réels : à valider avec vos identifiants OAuth.
- Réponses en texte brut ; les pièces jointes reçues ne sont ni affichées ni transmises au LLM.
- Seule la boîte de réception est relevée (les `SYNC_MAX_EMAILS` plus récents sur `SYNC_DAYS` jours).
- « Déjà répondu ailleurs » n'est détecté qu'en IMAP (drapeau `\Answered`).
- Pas de réinitialisation de mot de passe ni de double authentification pour le compte mailia.
