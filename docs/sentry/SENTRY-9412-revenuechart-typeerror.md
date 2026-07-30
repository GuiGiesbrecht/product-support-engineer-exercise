# METRIS-WEB-9412 · TypeError: Cannot read properties of undefined (reading 'toFixed')

|                |                         |
| -------------- | ----------------------- |
| Project        | metris-web (production) |
| Level          | error                   |
| Events         | 3                       |
| Users affected | 1                       |
| First seen     | 2026-07-18 09:32 UTC    |
| Last seen      | 2026-07-26 16:04 UTC    |
| Release        | web@1.4.0               |
| Status         | Unresolved              |

```
TypeError: Cannot read properties of undefined (reading 'toFixed')
  at formatter (src/components/RevenueChart.tsx:29:49)
  at renderContent (node_modules/recharts/es6/component/DefaultTooltipContent.js:64:24)
  at Tooltip (node_modules/recharts/es6/component/Tooltip.js:118:11)
  at renderWithHooks (node_modules/react-dom/cjs/react-dom.production.min.js:167:137)
```

**Breadcrumbs**

```
09:32:01 navigation  /dashboard -> /revenue
09:32:02 xhr         POST /graphql (RevenueByDay) [200]
09:32:02 ui.render   RevenueChart mounted (0 data points)
```

**Tags:** browser `Chrome 126.0`, os `Windows 11`, user `prod:usr_31b7c2`

**Note (Sofia, 2026-07-19):** trial account with no sites assigned yet — chart
renders with an empty series. Cosmetic; parked for the onboarding revamp.
