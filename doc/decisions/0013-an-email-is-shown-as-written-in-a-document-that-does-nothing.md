# 0013 — An email is shown as written, in a document that does nothing

## Context

Of a received email saras kept the text, and of its attachments their name, type and size. A member read the text and nothing else: a quote laid out as a table came as a column of words, and a file could not be opened without going back to the mail client, which is what saras is there to spare.

Showing an email as its sender wrote it means putting a stranger's HTML on the screen of a signed-in member. That HTML may hold a script, a form that asks for a password, a redirection, and above all images hosted by the sender, whose loading tells them the email was opened, when and from where. And opening a file means handing a browser, under our address, bytes a stranger chose.

## Decision

**The HTML of an email is kept beside its text**, as it was written (`emails.body_html`), whole or not at all (500 000 characters), and erased with the text past retention. Nothing else uses it: rules and the LLM are given the text, as before.

**It is shown as a document of its own**, `GET /api/emails/:id/html`, in a frame. Two things hold what that document may do, each enough without the other:

- It is **rebuilt from a list** when it is served (`src/tooling/received-html.ts`), as the HTML of replies is: every tag is written by us, with the attributes of a list. What lays an email out is on it (tables, fonts, colours, `style`, the style sheets it brings); what runs, embeds, submits or redirects is not. A link leads to the web or to an address, and opens in a tab of its own.
- It is **served under a policy of its own**: `sandbox`, so that it is no origin of ours and runs nothing; `default-src 'none'`, so that it asks nothing of any host; inline styles, and images carried in the HTML itself. It is the one answer our pages may frame.

**No image hosted elsewhere is loaded, and there is no button to load them.** The member is told when some were held back.

**A file is read from the mailbox when it is opened**, `GET /api/emails/:id/attachments/:n`, sent to who asked and kept nowhere. An image, a PDF or plain text is shown by the browser; anything else is saved, never opened, since an HTML or SVG file shown under our address would be a page of ours. Past the retention period a file is no longer read either: what is erased here is not fetched back from there.

**Rebuilt when served, not when kept.** What is stored is the email; what is shown is what this version of the list makes of it, including for emails fetched under an earlier one.

## Alternatives

- **Sanitising in the browser** (DOMPurify, already there for replies) and writing the result in the page or in a `srcdoc` frame. Both inherit the page's policy, which forbids inline styles: most of an email's layout. Allowing them for the whole interface to show one email is the wrong trade.
- **A library to sanitise on the server.** The reply side already rebuilds from a list in eighty lines without one; the same approach with a longer list is easier to read in full than a dependency's options, and the policy of the document does not depend on it being right.
- **Trusting the policy alone**, the HTML served as received. It stops scripts and requests; it does not stop a redirection written in the HTML, nor a link that replaces the email with another page inside the frame.
- **Loading hosted images on request**, per email, as mail clients do. It is the one thing here that tells a sender something, and a logo is rarely worth it. It can be added as a choice made each time; it cannot be taken back once people rely on it.
- **Keeping the files**, so that they open at once and without the mailbox. A second copy of every attachment in the database, to back up, to erase and to answer for: the reverse of "only its description is kept".
- **Fetching the HTML from the mailbox when it is read**, keeping nothing more. Every email opened would wait on the mail server, and would not open when it is away.

## Consequences

- The database holds more of each email: its HTML beside its text, in clear like the text, for as long.
- An email looks as its sender meant, less their hosted images: a newsletter made of images shows its alternative texts. "Text only" is one click away.
- Images an email refers to by `cid:` are files of the message, not part of its HTML: they are held back like hosted ones, and open from the header when the mailbox lists them.
- The frame cannot be measured from the page, which may not read it: it takes the room the reading pane has and scrolls by itself.
- Opening a file needs the mailbox to answer, and takes the time of fetching the whole message.
- Not for every mailbox yet: no HTML is kept of one connected by Microsoft sign-in, and files open for those connected by their servers only. Listed with the deviations in [`doc/2-operations.md`](../2-operations.md).
- A new element or attribute an email should be shown with is a word added to a list, and a line of `test/unit/received-html.test.ts`.

## What would reverse this

Emails that people need to read and that the list mangles, more often than a longer list can fix: a real HTML parser then replaces the rebuilding, behind the same policy. Or members asking for hosted images often enough: a choice made per email, said for what it tells the sender.
