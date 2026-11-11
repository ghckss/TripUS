# City data attribution

The generated city catalog in this directory contains data from
[GeoNames](https://www.geonames.org/), licensed under
[Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).

It is generated from `cities15000.zip` and `alternateNamesV2.zip` using
`apps/api/scripts/generate-city-catalog.mjs`. The application keeps only the
50 most populous entries per country and uses the Korean preferred name when
one is available.
