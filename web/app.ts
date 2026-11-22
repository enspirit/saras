// The application's entry: it starts it, and shows the page of each address. The pages are in
// ./pages, one file per thing a person does. They hold behaviour only: every element on screen
// comes from the design system in ./ui (atoms, molecules, organisms) and every word from the
// translation files, through t() and tRich(). Tests enforce both.

import { isSignedOut } from './api.ts';
import { chooseLanguage } from './api/settings.ts';
import { initI18n, language, t } from './i18n.ts';
import { invitationToken, route, wireNavigation } from './navigation.ts';
import { invitationPage } from './pages/accepting-invitation.ts';
import { messageOf, toast } from './pages/actions.ts';
import { BOXES_ON_SCREEN } from './pages/boxes.ts';
import { emailsPage } from './pages/emails.ts';
import { firstPromptPage } from './pages/getting-started/first-prompt.ts';
import { organisationKeyPage } from './pages/getting-started/organisation-key.ts';
import { openFirstEmail } from './pages/getting-started/path.ts';
import { wayOfWorkingPage } from './pages/getting-started/way-of-working.ts';
import { mailboxesPage } from './pages/mailboxes.ts';
import { membersPage } from './pages/members.ts';
import { promptsPage } from './pages/prompts.ts';
import { screenIsBlank, showScreen } from './pages/screen.ts';
import { settingsPage } from './pages/settings.ts';
import { morePage } from './pages/shell.ts';
import { signingInPage } from './pages/signing-in.ts';
import { isAdmin, needsKey, refreshMe, session } from './session.ts';
import { loadBrand } from './ui/brand.ts';
import { Loading } from './ui/molecules/loading.ts';

/** Asks who is signed in, then shows the page of the address, or the sign-in page. */
async function startApplication(): Promise<void> {
  const token = invitationToken();
  if (token) return invitationPage(token);
  // Nothing on screen yet: say that something is coming rather than show a blank page.
  if (screenIsBlank()) showScreen(Loading(t('common.loading')));
  try {
    const who = await refreshMe();
    // The server writes on the user's behalf (triage reasons, reply quoting): keep it told of their language.
    if (who.language !== language()) void chooseLanguage(language()).catch(() => {});
  } catch (e) {
    if (!isSignedOut(e)) toast(messageOf(e), true);
    session.me = null;
    return signingInPage();
  }
  showPageOfAddress();
}

/** The steps of getting started that have a page of their own; any other address under it leads to a first email. */
function showGettingStarted(part: string): void {
  if (part === 'key' && needsKey()) organisationKeyPage();
  else if (part === 'prompt' && isAdmin()) void firstPromptPage();
  else if (part === 'work' && isAdmin()) void wayOfWorkingPage();
  else void openFirstEmail();
}

/** Shows the page of the current URL. Pages report their own failures, so nothing is awaited. */
function showPageOfAddress(): void {
  const r = route();
  const box = BOXES_ON_SCREEN.find((b) => b.path === r.page);
  if (box) void emailsPage(box, r.id);
  else if (r.page === 'prompts' && isAdmin()) void promptsPage(r.part === 'new' ? 'new' : r.id);
  else if (r.page === 'users' && isAdmin()) void membersPage();
  else if (r.page === 'accounts') void mailboxesPage(r.part, r.id, r.query.get('error'), r.query.get('detail') ?? '');
  else if (r.page === 'settings') void settingsPage(r.part);
  else if (r.page === 'more') morePage();
  else if (r.page === 'welcome') showGettingStarted(r.part);
  else location.hash = '#/inbox';
}

wireNavigation({ showPage: showPageOfAddress, start: startApplication });
window.addEventListener('hashchange', () => (invitationToken() ? startApplication() : session.me && showPageOfAddress()));

// Translations first: the brand's tagline and every screen depend on the language.
initI18n()
  .then(() => loadBrand(language()))
  .then((loaded) => {
    session.brand = loaded;
    void startApplication();
  });
