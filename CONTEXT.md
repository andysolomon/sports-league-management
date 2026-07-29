# Sports League Management

The operator workspace for administering a selected sports league and navigating its teams, players, seasons, competition structure, and settings.

## Language

**League**:
The top-level competition and administrative scope selected by an operator.
_Avoid_: Organization, account, workspace

**Active League**:
The single League currently selected as the scope for league-specific navigation and content.
_Avoid_: Current organization, selected workspace

**League Directory**:
The cross-league page at `/dashboard/leagues` for selecting, creating, and managing Leagues.
_Avoid_: Leagues Home, Overview

**League Home**:
The read-oriented homepage for an individual League at `/dashboard/leagues/[leagueId]`, labeled “Overview” in the sidebar.
_Avoid_: League Overview, league detail page

**Settings Home**:
The neutral settings directory at `/dashboard/settings` that branches to League Settings and Account Settings.
_Avoid_: League Settings, Account Settings

**League Settings**:
The Active League’s administrative settings at `/dashboard/settings/league`.
_Avoid_: Settings Home, Account Settings

**Account Settings**:
The user-owned, cross-league administrative area at `/dashboard/settings/account` containing Import and Billing.
_Avoid_: Admin Settings, organization settings

**Import**:
A cross-league operation that creates or updates the League named by an import payload and its Divisions, Teams, and Players.
_Avoid_: Active League import, roster upload

**Account Billing**:
The user-owned subscription and aggregate usage settings under Account Settings.
_Avoid_: League billing, season billing

**Discover**:
The cross-league catalog for finding public Leagues, reached from the League Directory rather than League Settings.
_Avoid_: Settings, league configuration

**Teams Home**:
The Active League’s team directory at `/dashboard/teams`, offering Teams and Divisions as history-aware alternate views.
_Avoid_: Divisions page, team detail page

**Division**:
A competition grouping of Teams within a League, presented as a view of the Teams Home rather than an independent navigation hub.
_Avoid_: League, standalone section

**Team Home**:
The canonical homepage for one Team at `/dashboard/teams/[teamId]`, from which team-specific pages branch.
_Avoid_: Team drawer, team quick view

**Team Quick View**:
An optional summary drawer opened by an explicit secondary action without replacing the Team Home.
_Avoid_: Team Home, team detail page

**Players Home**:
The Active League’s league-wide player directory at `/dashboard/players`.
_Avoid_: Player Home, roster

**Player Home**:
The canonical homepage for one Player at `/dashboard/players/[playerId]`, from which player-specific pages branch.
_Avoid_: Players Home, player row

**Seasons Home**:
The Active League’s season directory at `/dashboard/seasons`.
_Avoid_: Season Home, league schedule

**Season Home**:
The canonical homepage for one Season at `/dashboard/seasons/[seasonId]`, from which schedule, standings, playoffs, and statistics branch.
_Avoid_: Seasons Home, league schedule

**Active Season**:
The single Season currently in progress for a League and the primary seasonal destination linked from League Home.
_Avoid_: Viewed season, selected year

**Offseason Hub**:
The phase-machine surface for one upcoming Season at `/dashboard/seasons/[seasonId]/offseason`, where an administrator moves the league through Rollover, Recruiting, Transfers, Draft, Free agency and Activate.
_Avoid_: Offseason page, preseason, transfer window

**Transfer Window**:
The Offseason Hub list of players who have asked to leave a Team and the offers other Teams have made for them, for one upcoming Season. A Transfer moves a player between Teams in the same League; nobody arrives from outside it.
_Avoid_: Portal, trade, free agency, waiver

**Squad**:
Which of a Team's two rosters a player is on for a Season — Varsity or JV. Ninth-graders are always JV and eleventh- and twelfth-graders are always Varsity, so only a tenth-grader's Squad is a coaching decision.
_Avoid_: Team level, sub-team, second string, reserves

**Prospect**:
An incoming ninth-grader on the Recruiting class for one upcoming Season, shown as a projected range rather than a rating until a Team signs him. Scouting narrows the range and never removes it.
_Avoid_: Recruit rating, star rating, draft prospect, blue-chip

**Training**:
Points a Team commits from its own offseason budget to develop named players in a named direction — athleticism, strength, technique or football IQ. Committing is a plan; the ratings move when the Offseason Hub leaves the Training phase.
_Avoid_: XP, skill points, upgrades, boosts, practice reps

**Resource Header**:
The orientation and sibling-navigation surface shared by a Home and its child pages without using breadcrumb trails.
_Avoid_: Breadcrumb, back-link row

**Scheme**:
What a Team runs on offense and on defense for a Season, together with its tempo, blitz and aggression dials. A Team with no Scheme plays the League default rather than an average.
_Avoid_: Playbook, formation, strategy, system

## Relationships

- An operator may access zero or more **Leagues**
- An operator has at most one **Active League** at a time
- If the saved Active League is unavailable, the first accessible League becomes **Active League**; with none, the operator enters League Directory onboarding
- The **Active League** determines the scope of league-specific sidebar destinations
- Opening an accessible Team, Player, Season, or child deep link makes its owning League the **Active League** before rendering
- Selecting an **Active League** from the switcher or **League Directory** navigates directly to its **League Home**
- Global league switching replaces the current history entry so Back does not reopen a page implicitly scoped to the previous **Active League**
- An upcoming **Season** has at most one **Offseason Hub**, and a Season that is active or completed has none
- The league switcher links to the **League Directory** for cross-league administration
- **League Home** is the root of the Active League workspace; desktop and mobile sidebar destinations Overview, Teams, Players, Seasons, and Settings are its primary branches
- **League Home** does not duplicate those branches in a local tab bar; its header exposes only contextual actions
- Without an accessible **Active League**, League-scoped navigation is hidden, Account Settings remains available, and League Directory onboarding is prominent
- **Settings Home** is visible to every authenticated operator and always exposes **Account Settings**
- **League Settings** is exposed only when the operator is an Org Admin for the **Active League**
- Coaches manage a Team from **Team Home**, not **League Settings**
- A Team has at most one **Scheme** per Season, set from **Team Home** because a Scheme changes only that Team's own games
- An upcoming **Season** has at most one recruiting class, and every **Prospect** in it belongs to exactly one Team once signed
- A **Prospect** is scouted and signed from the **Offseason Hub**, because the class is shared by the whole League rather than owned by one Team
- A **Transfer Window** entry needs two decisions: the Team losing the player releases or keeps him, and a Team offering a spot signs or passes
- A **Transfer** never changes the number of players in a League, only which Team each belongs to
- A player's **Squad** and position are changed from the **Offseason Hub**, and both are one Team's decision about its own roster
- Cutting a player from the **Offseason Hub** releases him to free agency rather than removing him from the League
- **Training** is budgeted per Team rather than per League, so one coach cannot spend another program's offseason
- **Training** a Team commits is applied to that Season's ratings once, when the Offseason Hub advances past the Training phase
- **Account Settings** contains cross-league **Import** and **Account Billing**
- A successful **Import** may set the imported League as the **Active League** and offer navigation to its **League Home**
- The **League Directory** provides access to **Discover**
- A **League** contains zero or more **Divisions**, and a **Division** groups Teams within that League
- The **Teams Home** presents Teams at `/dashboard/teams` and Divisions at `/dashboard/teams?view=divisions`
- A selected Division is represented by the `division` query parameter on the Divisions view
- Division deep links resolve to the **Teams Home** with the relevant Divisions view or selection active
- Selecting a Team navigates to its **Team Home**
- **Team Home** branches to Overview, Roster, and Depth Chart; Roster Audit remains beneath Roster, while game pages remain contextual
- Authorized Team management actions remain on **Team Home**
- The **Team Quick View** is available only through an explicit secondary action
- The **Players Home** lists Players in the Active League
- Selecting a Player navigates to its **Player Home**
- **Player Home** initially branches to Overview and Development
- Ratings, season statistics, and editable attributes remain Overview sections until they become independent workflows
- A **League** has at most one **Active Season**
- The **Seasons Home** lists Seasons in the Active League
- Selecting a Season navigates to its **Season Home**
- **Season Home** branches to Overview, Schedule, Standings, Playoffs, and Stat Leaders, with feature-disabled destinations hidden
- Position-group attribute ingestion remains a contextual management workflow rather than a primary Season destination
- **League Home** exposes a prominent action to open the **Active Season**’s **Season Home**
- Each **League Directory** row exposes a secondary **Active Season** shortcut
- An Active Season shortcut also makes its League the **Active League** before opening **Season Home**
- An upcoming or completed Season never substitutes for a missing **Active Season**; League Home instead links to **Seasons Home** and offers valid admin lifecycle actions
- A child page’s **Resource Header** identifies and links its parent Home and provides sibling subpage navigation

## Example dialogue

> **Dev:** “What happens when an operator selects Cobb County Football?”
> **Domain expert:** “It becomes the **Active League**, and the operator is taken to that League’s **League Home**.”

## Flagged ambiguities

- “Leagues screen” was used for both the cross-league list and an individual League page; resolved: these are **League Directory** and **League Home**, respectively.
- “Overview” previously referred to `/dashboard`; resolved: it is the sidebar label for the Active League’s **League Home**.
- “Settings” initially included Discover; resolved: **Discover** is cross-league navigation from the **League Directory**, while **Settings Home** contains league settings, import, and billing.
- “Settings” mixed league-scoped and account-scoped destinations; resolved: **Settings Home** branches to **League Settings** and **Account Settings**.
- Import was initially described as Active-League scoped; code inspection showed that the payload owns League identity, so **Import** remains cross-league under **Account Settings**.
- “Admin Settings” could be confused with the Org Admin role; resolved: use **Account Settings** for user-owned cross-league tools.
- “Divisions screen” implied an independent destination; resolved: **Division** is a domain entity shown through an alternate **Teams Home** view, not a sidebar section or separate homepage.
- The Teams table previously treated a drawer as the primary Team destination; resolved: row selection opens **Team Home**, while **Team Quick View** is secondary.
- Season competition pages were nested below League and selected a Season with `?season=`; resolved: they are children of **Season Home**, and legacy URLs redirect to season-owned routes.
- Breadcrumbs and generic “Back to …” rows previously conveyed hierarchy; resolved: **Resource Headers** and the topbar history control provide orientation instead.
