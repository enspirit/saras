// The rule "Stands in" starts with, written in Elo like any rule an organisation writes:
// mail that is plainly automated, or already dealt with, needs no reply. It says nothing of
// the rest, which is then to handle — or left to the AI, where the organisation has it sort.
export const DEFAULT_STATUS_RULE = `let
  sender = lower(_.from.address),
  local = sender |> split('@') |> fetch(.0),
  automated = ['no-reply', 'noreply', 'do-not-reply', 'donotreply', 'ne-pas-repondre', 'mailer-daemon', 'postmaster', 'bounce', 'notification', 'newsletter']
in
  if sender == '' then {value: 'none', reason: 'triage.unknownSender'}
  else if sender == lower(_.mailbox) then {value: 'none', reason: 'triage.ownMessage'}
  else if _.answered then {value: 'none', reason: 'triage.alreadyAnswered'}
  else if any(automated, w ~> contains(local, w)) then {value: 'none', reason: 'triage.automatedAddress'}
  else if _.headers.autoSubmitted != '' && lower(_.headers.autoSubmitted) != 'no' then {value: 'none', reason: 'triage.autoSubmitted'}
  else if _.headers.listUnsubscribe != '' || _.headers.listId != '' then {value: 'none', reason: 'triage.newsletter'}
  else if contains(['bulk', 'junk', 'list'], lower(_.headers.precedence)) then {value: 'none', reason: 'triage.bulk'}
  else null`;
