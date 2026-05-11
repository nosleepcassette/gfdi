# fuckupinator

Count profanity across local coding-agent session logs.

This fork of `gricha/devrage` adds Hermes support. Hermes global sessions are reported
as `hermes`, and each Hermes profile history is reported separately as
`hermes:<profile>`.

The default command renders a compact terminal dashboard in a real TTY. Use
`--plain` for script-friendly text, `--json` for structured output, or `--tui`
to force the styled dashboard outside a TTY. The default logo is read from
`~/Downloads/fuckup.txt` when present.

```sh
npm install
npm run build
npm link
fuckupinator scan
fuckup scan --agent hermes
fuckup --top 20 --tui
fuckup --json --agent hermes:wizard
```
