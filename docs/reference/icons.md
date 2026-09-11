# Icons

`IconName` is the closed menu of 280 glyph names accepted wherever a component exposes an icon as a bounded choice (the `Icon` component, `Menubar` items, the `Fab`, and others).

```json
{
  "root": "icon",
  "elements": {
    "icon": {
      "type": "Icon",
      "props": {
        "name": "sparkles",
        "size": "md"
      }
    }
  }
}
```

The full enum is exported for programmatic use:

```ts
import { IconName } from '@frayme/catalog';

IconName.safeParse('sparkles').success; // true
```

## Core actions · navigation · UI chrome

`check` · `x` · `chevron-down` · `chevron-up` · `chevron-left` · `chevron-right` · `arrow-right` · `arrow-left` · `arrow-up` · `arrow-down` · `arrow-up-right` · `external-link` · `plus` · `minus` · `search` · `settings` · `user` · `users` · `trash` · `edit` · `download` · `upload` · `menu` · `more-horizontal` · `more-vertical` · `info` · `alert-triangle` · `alert-circle` · `check-circle` · `star` · `heart` · `bell` · `calendar` · `clock` · `home` · `mail` · `lock` · `filter` · `copy` · `clipboard` · `paperclip` · `link` · `image` · `refresh-cw` · `send` · `log-out` · `sparkles` · `bold` · `italic` · `underline` · `eye` · `credit-card` · `save` · `arrow-down-right` · `chevrons-left` · `chevrons-right` · `chevrons-up-down` · `move` · `maximize` · `minimize` · `expand` · `shrink` · `pencil` · `trash-2` · `save-all` · `scissors` · `share` · `share-2` · `rotate-cw` · `rotate-ccw` · `undo` · `redo` · `printer` · `sliders` · `sliders-horizontal` · `plus-circle` · `minus-circle` · `x-circle` · `circle-check` · `circle-x` · `circle-alert`

## Files · folders · documents

`file` · `file-text` · `file-plus` · `files` · `folder` · `folder-open` · `folder-plus` · `archive` · `book` · `book-open` · `bookmark` · `clipboard-list` · `clipboard-check` · `clipboard-copy`

## Media · playback · communication

`play` · `pause` · `square-play` · `circle-play` · `skip-forward` · `skip-back` · `fast-forward` · `rewind` · `volume` · `volume-1` · `volume-2` · `volume-x` · `mic` · `mic-off` · `video` · `video-off` · `camera` · `music` · `headphones` · `film` · `images` · `message-square` · `message-circle` · `mail-open` · `phone` · `phone-call` · `phone-off` · `bell-off` · `at-sign` · `hash` · `link-2` · `globe` · `wifi` · `wifi-off` · `rss` · `signal` · `help-circle` · `circle-help` · `loader` · `loader-circle` · `zap` · `flag` · `shield` · `shield-check` · `thumbs-up` · `thumbs-down` · `smile` · `frown` · `meh` · `octagon-alert` · `triangle-alert`

## People · commerce · time

`user-plus` · `user-check` · `user-x` · `user-round` · `contact` · `circle-user` · `shopping-cart` · `shopping-bag` · `dollar-sign` · `tag` · `tags` · `gift` · `package` · `truck` · `wallet` · `receipt` · `percent` · `banknote` · `coins` · `timer` · `alarm-clock` · `watch` · `history` · `hourglass` · `calendar-days` · `calendar-clock`

## Layout · lists · alignment

`layout` · `layout-grid` · `layout-list` · `list` · `list-checks` · `list-ordered` · `columns` · `columns-2` · `sidebar` · `panel-left` · `align-left` · `align-center` · `align-right` · `align-justify` · `table-2` · `rows-2` · `eye-off` · `unlock`

## Weather · climate · maps

`sun` · `moon` · `cloud` · `cloud-off` · `cloud-rain` · `cloud-drizzle` · `cloud-snow` · `cloud-lightning` · `cloud-fog` · `cloud-sun` · `cloud-moon` · `cloud-sun-rain` · `map` · `map-pin` · `navigation` · `compass`

## Places · devices · dev · data

`building` · `building-2` · `briefcase` · `key` · `coffee` · `battery` · `cpu` · `database` · `server` · `hard-drive` · `terminal` · `code` · `code-2` · `git-branch` · `git-commit-horizontal` · `bar-chart-3` · `chart-bar` · `chart-line` · `chart-pie` · `trending-up` · `trending-down` · `activity` · `gauge`

## Shapes · misc · tools · awards

`circle` · `square` · `triangle` · `hexagon` · `diamond` · `dot` · `palette` · `brush` · `droplet` · `feather` · `anchor` · `award` · `target` · `crosshair` · `layers` · `box` · `grid-2x2` · `grip-vertical` · `grip-horizontal` · `wrench` · `hammer` · `bug` · `rocket` · `flame` · `bolt` · `lightbulb` · `thermometer` · `wind` · `snowflake` · `umbrella` · `droplets` · `thermometer-sun` · `thermometer-snowflake` · `sunrise` · `sunset` · `tornado` · `rainbow` · `haze` · `trophy` · `medal` · `crown` · `ticket` · `qr-code` · `scan` · `fingerprint`

## Brand marks (filled — simple-icons geometry, CC0)

`github` · `twitter` · `facebook` · `instagram` · `linkedin` · `youtube`
