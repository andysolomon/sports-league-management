# Season-owned competition routes

Competition views are canonical children of `/dashboard/seasons/[seasonId]`: schedule, standings, playoffs, and statistics. The previous League-owned routes with a `?season=` selector made Season identity secondary and conflicted with the requirement that every Season have a Home from which its subpages branch. Legacy League-owned URLs redirect to the matching Season route so existing links remain usable.
