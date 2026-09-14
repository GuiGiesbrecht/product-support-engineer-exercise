# TICKET-4852 · CSV export fails for "All sites" on staff accounts (internal)

|           |                                   |
| --------- | --------------------------------- |
| Priority  | Medium                            |
| Status    | Open                              |
| Raised by | Daniel Okafor (ops@metris.energy) |
| Opened    | 2026-07-29 09:20 UTC              |
| Channel   | Internal                          |

---

I can't pull a portfolio export for a customer from the console. On the CSV
Export page, with **Pennine Group plc** selected in the customer switcher and
the site dropdown left on **"All sites"**, hitting Download CSV just shows
**"Export failed"** in red. No file is downloaded.

Picking a single site from the dropdown works every time, for any customer I
switch to. It only breaks on "All sites", and it breaks the same way whichever
customer I have selected.

Customers don't hit this — Rachel at Pennine pulled her own all-sites export
last week without any trouble, so it looks like something specific to our
staff logins. Right now the only way for us to hand over a full portfolio is
to download each site one by one and paste them together, which is slow and
error-prone when someone asks for a whole month.

Can someone take a look?

---

**Attachments:**
[`attachments/EXPORT_ERROR_CSV_ALL_SITES.png`](attachments/EXPORT_ERROR_CSV_ALL_SITES.png)
