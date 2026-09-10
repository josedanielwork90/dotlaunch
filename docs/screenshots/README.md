# Screenshots

Captured from the running stack with the demo environment seeded, so every
number on screen is real contract state rather than a mockup. Reproduce with:

```bash
docker compose up -d
docker compose run --rm seed
```

The application clock is pinned to `2025-06-15T12:00:00Z`, so these render
identically on any machine.

## Pages

| File | Page |
| --- | --- |
| `01-landing` | Marketing landing page |
| `02-launchpad-list` | Presale catalogue |
| `05-dashboard` | Dashboard home |
| `06-launchpad-create` | Create-launchpad wizard, step 1 |
| `07-fairlaunch-list` | Fair launch catalogue (empty) |
| `08-fairlaunch-create` | Create-fairlaunch wizard |
| `09-token-create` | Token factory |
| `10-token-manage` | Manage deployed tokens |
| `11-lock-create` | Create a lock |
| `12-token-lockers` | Token locks |
| `13-liquidity-lockers` | Liquidity locks |
| `14-multisend` | Batch distribution |
| `15-not-found` | 404 |

## Presale states

Each is a different seeded sale, in a genuinely different lifecycle state.

| File | State |
| --- | --- |
| `04-detail-nova` | Live, partially funded |
| `04-detail-aurora` | Live, at hard cap |
| `04-detail-quantum` | Live, whitelist-gated |
| `04-detail-helix` | Upcoming, not yet open |
| `04-detail-solaris` | Finalised, cleared soft cap |
| `04-detail-meridian` | Cancelled, refundable |

## Filter states

| File | Filter |
| --- | --- |
| `03-1-filter-upcoming` | Upcoming |
| `03-2-filter-active` | Active |
| `03-3-filter-success` | Success |
| `03-4-filter-failed` | Failed |

## Interaction and transient states

| File | State |
| --- | --- |
| `30-loading-skeletons` | Catalogue loading, skeleton cards |
| `31-component-loading-card` | A single skeleton card |
| `32-error-api-unreachable` | API unreachable |
| `33-component-empty-state` | Empty list |
| `38-hover-button` | Button, hover |
| `39-hover-filter` | Filter, hover |
| `40-focus-input` | Text input, focused with content |
| `41-validation-errors` | Wizard rejecting an empty required field |
| `42-component-field-error` | The field error message |
| `43-component-input-invalid` | The input in its invalid state |
| `16-wallet-menu` | Wallet menu open |
| `17-demo-wallet-accounts` | Demo account picker |

## Components

Cropped to their own bounds rather than shown as part of a page.

| File | Component |
| --- | --- |
| `34-component-presale-card` | Presale card |
| `35-component-status-filters` | Status filter bar |
| `36-component-tabs` | Tab selector |
| `37-component-toolbar` | Top toolbar |
| `46-component-sale-terms` | Sale terms panel |

## Responsive

| File | Viewport |
| --- | --- |
| `20-mobile-landing` | 390×844 |
| `21-mobile-launchpad-list` | 390×844 |
| `22-mobile-detail` | 390×844 |
| `23-mobile-token-create` | 390×844 |
