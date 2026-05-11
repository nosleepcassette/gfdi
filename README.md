# fuckupinator

Count profanity across local coding-agent session logs.

This fork of `gricha/devrage` adds Hermes support. Hermes global sessions are reported
as `hermes`, and each Hermes profile history is reported separately as
`hermes:<profile>`.

```sh
npm install
npm run build
node dist/cli.js scan
node dist/cli.js scan --agent hermes
```
