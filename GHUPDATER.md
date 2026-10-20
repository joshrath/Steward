# GHUPDATER

Rules for every push to this repository.

- Push in small commits. One subject each: the guest, the door, the face, or the deploy.
- Update README.md in the same commit when behavior or install steps change. The README is the version note.
- Do not commit secrets, tokens, `.env`, `node_modules`, or a built `.output`.
- Proxmox LXC is the supported install. `deploy/upgrade.sh` must keep working: a fast-forward of `main`, then `npm ci`, `npm run build`, then restart `steward`.
- The upgrade script updates itself. After it pulls, it runs the new copy once before building.
- Say what the commit changes in the message, in plain sentences.
