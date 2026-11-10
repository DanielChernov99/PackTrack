# Compensation and historical earnings

All persisted money is integer agorot: ₪11 is 1100. Inputs display shekels and convert to agorot. An unknown rate is null; an explicitly agreed zero rate is 0.

For each saved shift:

1. Convert Jerusalem wall-clock start/end to UTC instants.
2. Subtract the unpaid break from real elapsed minutes.
3. Add the agreed fixed credited minutes for hourly pay only.
4. Multiply paid minutes by (hourly base + hourly adjustment), divide by 60, and round the hourly subtotal once to the nearest agora.
5. Multiply each integer packing count by its corresponding snapshot piece rate.
6. Add all signed manual bonuses. Negative adjustments reduce pay.
7. Sum hourly, packing, and bonuses into estimated gross earnings.

Hourly pay is always required. A piece rate is required only when that category's count is greater than zero. Missing required rates block preview totals and saving in both the domain and database layers. Combined hourly base plus adjustment cannot be negative. Credited time and hourly adjustment are separate optional settings; the app assumes neither is part of club policy.

Example: 8 elapsed hours, 30 unpaid minutes, ₪40/hour, 3 student and 2 Sigma parachutes at ₪11 each, and a −₪12.50 adjustment produce ₪300 + ₪55 − ₪12.50 = **₪342.50**.

## Effective history and snapshots

A compensation record also contains the role. The latest record effective on or before the shift's **Jerusalem start date** is selected by the database when creating a shift. It becomes the saved rate snapshot.

Changing current settings or inserting an earlier effective configuration never updates saved shifts. Editing counts, bonuses, or even the work date keeps the old shift's snapshot. To correct its rates deliberately, open the advanced historical override, enter the corrected rates, and confirm the override. It affects that shift only.

The configuration page can correct an existing effective date. That correction applies to subsequently created shifts and leaves previous snapshots untouched. Registration's 1900 baseline is a convenience; configure actual earlier history before recording backdated work.

## Time, DST, and month boundaries

The Temporal polyfill resolves Asia/Jerusalem wall times. Spring-forward times that do not exist are rejected. Repeated fall-back times require explicitly choosing the earlier or later occurrence; the default rejects ambiguity. The choice applies to both endpoints. Tick the next-day option for overnight work; midnight crossings are not silently inferred.

Duration must be positive and no more than 24 actual hours. Breaks must be nonnegative integer minutes and shorter than elapsed work. The saved UTC interval remains authoritative for historical totals even if time-zone rules later change.

Intervals are half-open: 08:00–16:00 and 16:00–17:00 may coexist. The database serializes all writes for the user before checking overlap. Credited minutes do not extend the actual interval.

The whole shift, including overnight work, belongs to its Jerusalem **start date/month**, rather than the browser's local time zone or UTC month. Monthly paid hours include credited minutes. Individual previews distinguish actual paid work from additional credited time.

## Maintenance

Pure functions live in src/domain; database validation mirrors their bounds. Change both layers together if business limits change. Tests cover missing/zero rates, mixed categories, bonuses, corrections, rounding, snapshots, backdating, overnight work, breaks, DST, and monthly attribution.
