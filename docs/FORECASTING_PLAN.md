# Seven-day harvest forecast

## Agreed product behavior

- Predict required **crates by item and day** for the next seven days.
- Do not subtract current stock from predicted demand.
- Keep the system recommendation and the proprietor's final edited plan separately.
- Show the important reasons behind a recommendation: weekday pattern, recent demand,
  customer demand, month position, and a relevant event or holiday.
- Treat loose kilograms as audit history only; do not convert them into crates for training.

## Data boundary

- Legacy source: 17 November 2025 through 10 September 2026.
- Current operational source: 11 September 2026 onward.
- Legacy history is imported into dedicated forecast tables. It must never update stock,
  bills, balances, payments, or cashbook entries.
- Legacy items must be mapped to a current item variant or item family before entering training data.
- When the legacy source has no grade, it may map to a current item family. The forecast
  allocates that family demand across grades using the recent current-grade mix rather than
  inventing a historical grade.
- Legacy customers may remain unmatched for total/item demand, but only confirmed customer
  mappings may contribute to customer-specific recommendations.

## Legacy data assessment

| Measure | Result |
| --- | ---: |
| Sales rows | 7,922 |
| Days with sales | 235 |
| Crate-based rows usable for forecasting | 7,170 |
| Kg-only rows retained but excluded | 751 |
| Negative-quantity rows | 0 |
| Missing customer/item references | 0 |
| Customer-item pairs | 979 |
| Customer-item pairs with at least 8 orders | 221 |

The history is sufficient for a useful first forecast, but most individual customer-item
pairs are sparse. The model must therefore share information across item, weekday, and
customer levels instead of fitting an independent model to every pair.

## Model rollout

### Version 1: transparent statistical forecast

The first recommendation-only release is intentionally a measurable baseline:

1. Average the last eight matching weekdays, including zero-demand weeks.
2. Preserve customer demand through the underlying matched sales history.
3. Allocate grade-unknown family history only across explicitly approved grades, using the
   recent current-grade mix (Jilebi is limited to Pailet M/S).
4. Apply only confirmed calendar-event multipliers.
5. Produce low/base/high quantities, confidence, and a whole-crate editable plan.

The same screen also provides a known-customer breakdown. It uses confirmed customer
mappings, shows the expected item mix for each customer, and sorts customers and items
from highest forecast quantity to lowest. Unmapped historical customers remain included
in the item-level plan but are not displayed under a guessed customer name.

Recent trend, learned month-position effects, customer-level explanations, and automatic
holiday suggestions remain candidate improvements. They must beat this baseline in rolling
backtests before changing production recommendations.

The proprietor can edit the base quantity. The system stores both the recommendation and
the final quantity so accuracy and human overrides can be measured later.

### AI's role

AI may propose legacy-name mappings, classify whether a holiday usually increases or
reduces fish demand, and write a short explanation. It must not directly invent the final
crate quantity. Numerical quantities come from versioned, deterministic calculations that
can be backtested.

## Release gates

- Review all item mappings and high-volume customer mappings.
- Backtest using rolling historical cutoffs; never train on dates after the forecast date.
- Report weighted absolute percentage error for daily total and item/day quantities.
- Compare every model against same-weekday and recent-average baselines.
- Run in recommendation-only mode first. Do not create purchases automatically.
- Display a low-confidence warning for new items, sparse history, and unusual event days.

Initial baseline tests showed roughly 29% daily-total error for a same-weekday model and
roughly 56% item-level error. The current screen is therefore labelled and operated as a
planning assistant: it shows confidence and a range, stays editable, and never creates a
purchase automatically.
