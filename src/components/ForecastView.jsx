import { useEffect, useMemo, useState } from "react";
import {
  fetchSimulationRange,
  fetchSimulationForecast,
} from "../api/client";
import "./ForecastView.css";

const PAGE_SIZE = 25;

const day = value => (value ? String(value).slice(0, 10) : "");

const addDays = (value, amount) => {
  if (!value) return "";

  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);

  return date.toISOString().slice(0, 10);
};

const numberOrNull = value => {
  if (value == null || value === "") return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const formatNumber = (value, decimals = 1) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-IN", {
        maximumFractionDigits: decimals,
      }).format(value);

const dateLabel = value => {
  const date = day(value);
  if (!date) return "—";

  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

function unwrapResponse(response) {
  let payload = response;

  for (let i = 0; i < 4; i += 1) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      break;
    }

    if (payload.data && typeof payload.data === "object") {
      payload = payload.data;
      continue;
    }

    if (payload.result && typeof payload.result === "object") {
      payload = payload.result;
      continue;
    }

    break;
  }

  return payload;
}

function getRangeDates(response) {
  const payload = unwrapResponse(response);
  const range = payload?.dataset_range ?? payload?.range ?? payload;

  return {
    start: day(range?.start ?? range?.start_date),
    end: day(range?.end ?? range?.end_date),
  };
}

function getForecastRows(response) {
  const payload = unwrapResponse(response);

  const candidates = [
    payload?.records,
    payload?.forecast_records,
    payload?.forecast?.records,
    Array.isArray(payload) ? payload : null,
  ];

  return candidates.find(Array.isArray) ?? [];
}

function Metric({ label, value, unit = "", note, icon, featured }) {
  return (
    <article className={`sf-metric ${featured ? "featured" : ""}`}>
      <div className="sf-metric-top">
        <span>{label}</span>
        <b>{icon}</b>
      </div>

      <strong>
        {value}
        <small>{unit}</small>
      </strong>

      <p>{note}</p>
    </article>
  );
}

function Trend({ rows }) {
  const data = rows.filter(
    row => numberOrNull(row.predicted_ac_power) != null
  );

  if (!data.length) {
    return (
      <div className="sf-chart-empty">
        No forecast readings are available for this date range.
      </div>
    );
  }

  const W = 900;
  const H = 270;
  const L = 55;
  const R = 18;
  const T = 18;
  const B = 34;

  const values = data
    .flatMap(row => [
      numberOrNull(row.predicted_ac_power),
      numberOrNull(row.actual_ac_power_for_evaluation),
    ])
    .filter(value => value != null);

  const max = Math.max(...values, 1);

  const x = index =>
    L + (index / Math.max(data.length - 1, 1)) * (W - L - R);

  const y = value => H - B - (value / max) * (H - T - B);

  const makePath = key => {
    let started = false;

    return data
      .map((row, index) => {
        const value = numberOrNull(row[key]);

        if (value == null) {
          started = false;
          return "";
        }

        const command = started ? "L" : "M";
        started = true;

        return `${command} ${x(index)} ${y(value)}`;
      })
      .filter(Boolean)
      .join(" ");
  };

  return (
    <div className="sf-chart-wrap">
      <div className="sf-legend">
        <span>
          <i className="sf-pred-dot" />
          Forecast
        </span>
        <span>
          <i className="sf-actual-dot" />
          Recorded
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="sf-chart"
        role="img"
        aria-label="Forecast and recorded power trend"
      >
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <g key={t}>
            <line
              x1={L}
              x2={W - R}
              y1={y(max * t)}
              y2={y(max * t)}
              className="sf-grid"
            />

            <text
              x={L - 9}
              y={y(max * t) + 4}
              textAnchor="end"
              className="sf-axis"
            >
              {formatNumber(max * t, 0)}
            </text>
          </g>
        ))}

        <path d={makePath("predicted_ac_power")} className="sf-line sf-pred" />
        <path
          d={makePath("actual_ac_power_for_evaluation")}
          className="sf-line sf-actual"
        />

        <text x={L} y={H - 8} className="sf-axis">
          {dateLabel(data[0]?.timestamp)}
        </text>

        <text
          x={W - R}
          y={H - 8}
          textAnchor="end"
          className="sf-axis"
        >
          {dateLabel(data[data.length - 1]?.timestamp)}
        </text>
      </svg>

      <p className="sf-note">
        Power readings are shown in the dataset’s AC power units.
      </p>
    </div>
  );
}

export default function ForecastView({ selectedPlant = 1 }) {
  const [range, setRange] = useState(null);
  const [asOf, setAsOf] = useState("");
  const [days, setDays] = useState(3);
  const [result, setResult] = useState(null);

  const [loadingRange, setLoadingRange] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [actualOnly, setActualOnly] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;

    setLoadingRange(true);
    setError("");
    setRange(null);
    setResult(null);
    setAsOf("");
    setPage(1);

    fetchSimulationRange(selectedPlant)
      .then(response => {
        if (!active) return;

        const dates = getRangeDates(response);
        setRange(dates);

        const defaultDate = dates.start
          ? addDays(dates.start, 5)
          : dates.end;

        setAsOf(defaultDate);
      })
      .catch(err => {
        if (active) {
          setError(
            err?.message || "Could not load the selected plant’s data."
          );
        }
      })
      .finally(() => {
        if (active) setLoadingRange(false);
      });

    return () => {
      active = false;
    };
  }, [selectedPlant]);

  const start = range?.start ?? "";
  const end = range?.end ?? "";
  const maxDate = end ? addDays(end, -Number(days)) : "";

  const validDate =
    Boolean(asOf) &&
    (!start || asOf >= start) &&
    (!maxDate || asOf <= maxDate);

  const runForecast = async event => {
    event?.preventDefault();

    if (!validDate) {
      setError(
        "Choose a start date that leaves enough available data for this forecast length."
      );
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setPage(1);

    try {
      const response = await fetchSimulationForecast(
        selectedPlant,
        asOf,
        Number(days)
      );

      setResult(response);

      if (!getForecastRows(response).length) {
        setError(
          "The request completed, but no forecast readings were found in the response."
        );
      }
    } catch (err) {
      setError(
        err?.message || "Could not generate the forecast. Try another date."
      );
    } finally {
      setLoading(false);
    }
  };

  const rows = useMemo(() => getForecastRows(result), [result]);

  const stats = useMemo(() => {
    const predicted = rows
      .map(row => numberOrNull(row.predicted_ac_power))
      .filter(value => value != null);

    const pairs = rows
      .map(row => [
        numberOrNull(row.predicted_ac_power),
        numberOrNull(row.actual_ac_power_for_evaluation),
      ])
      .filter(([prediction, actual]) => prediction != null && actual != null);

    const average = values =>
      values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : null;

    return {
      predictedMean: average(predicted),
      actualMean: average(pairs.map(([, actual]) => actual)),
      mae: pairs.length
        ? pairs.reduce(
            (sum, [prediction, actual]) =>
              sum + Math.abs(prediction - actual),
            0
          ) / pairs.length
        : null,
      coverage: rows.length ? (100 * pairs.length) / rows.length : null,
      count: pairs.length,
    };
  }, [rows]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter(row => {
      const matchesSearch = String(row.timestamp ?? "")
        .toLowerCase()
        .includes(query);

      const hasActual =
        numberOrNull(row.actual_ac_power_for_evaluation) != null;

      return matchesSearch && (!actualOnly || hasActual);
    });
  }, [rows, search, actualOnly]);

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));

  // Keep the current page valid if the visible result count changes.
  useEffect(() => {
    setPage(current => Math.min(current, totalPages));
  }, [totalPages]);

  const paginatedRows = visibleRows.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const pageNumbers = Array.from(
    { length: totalPages },
    (_, index) => index + 1
  ).filter(
    pageNumber =>
      pageNumber === 1 ||
      pageNumber === totalPages ||
      Math.abs(pageNumber - page) <= 1
  );

  const exportCsv = () => {
    const csvRows = [
      ["Timestamp", "Forecast power", "Recorded power"],
      ...rows.map(row => [
        row.timestamp ?? "",
        row.predicted_ac_power ?? "",
        row.actual_ac_power_for_evaluation ?? "",
      ]),
    ];

    const csv = csvRows
      .map(row =>
        row
          .map(value => `"${String(value).replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = `plant-${selectedPlant}-forecast-${asOf}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  const firstReadingDate = rows.length ? day(rows[0].timestamp) : "";
  const lastReadingDate = rows.length
    ? day(rows[rows.length - 1].timestamp)
    : "";

  return (
    <main className="forecast-page">
      <header className="sf-hero">
        <div>
          <div className="sf-eyebrow">● ENERGY INTELLIGENCE</div>
          <h1>Energy forecast</h1>
          <p>
            Explore expected plant output, compare recorded performance,
            and uncover the patterns that matter.
          </p>
        </div>

        <div className="sf-sun" aria-hidden="true" />
      </header>

      <form className="sf-toolbar" onSubmit={runForecast}>
        <label>
          <span>Forecast start date</span>
          <input
            type="date"
            value={asOf}
            min={start || undefined}
            max={maxDate || undefined}
            onChange={event => setAsOf(event.target.value)}
            disabled={loadingRange || !range}
          />
        </label>

        <label>
          <span>Forecast horizon</span>
          <select
            value={days}
            onChange={event => {
              setDays(Number(event.target.value));
              setPage(1);
            }}
          >
            <option value={1}>Next 24 hours</option>
            <option value={3}>Next 3 days</option>
            <option value={7}>Next 7 days</option>
          </select>
        </label>

        <div className="sf-action">
          <button disabled={loadingRange || loading || !validDate}>
            {loading ? "Generating…" : "Generate forecast　↗"}
          </button>

          {range && (
            <small>
              Available data: {dateLabel(start)} – {dateLabel(end)}
            </small>
          )}
        </div>
      </form>

      {error && (
        <div className="sf-error">
          <b>Unable to continue</b>
          <span>{error}</span>
        </div>
      )}

      {loadingRange && (
        <div className="sf-empty">Loading plant data…</div>
      )}

      {!result && !loadingRange && (
        <div className="sf-empty">
          <b>✦</b>
          <section>
            <h2>Your plant outlook, at a glance</h2>
            <p>
              Choose a date and horizon, then generate an outlook to compare
              expected output with recorded readings.
            </p>
          </section>
        </div>
      )}

      {result && (
        <>
          <div className="sf-title">
            <div>
              <div className="sf-eyebrow">
                PLANT {selectedPlant} · PERFORMANCE OUTLOOK
              </div>

              <h2>
                {dateLabel(firstReadingDate || asOf)}
                <span>→</span>
                {dateLabel(lastReadingDate || addDays(asOf, Number(days)))}
              </h2>
            </div>

            <button
              type="button"
              className="sf-export"
              onClick={exportCsv}
              disabled={!rows.length}
            >
              ↓ Export CSV
            </button>
          </div>

          <section className="sf-metrics">
            <Metric
              label="Average forecast power"
              value={formatNumber(stats.predictedMean, 2)}
              note="Average across forecast readings"
              icon="↗"
              featured
            />

            <Metric
              label="Average recorded power"
              value={formatNumber(stats.actualMean, 2)}
              note="Matching recorded intervals"
              icon="▤"
            />

            <Metric
              label="Mean absolute error"
              value={formatNumber(stats.mae, 2)}
              note="Average prediction-to-recording gap"
              icon="⌁"
            />

            <Metric
              label="Evaluation coverage"
              value={formatNumber(stats.coverage, 0)}
              unit={stats.coverage == null ? "" : "%"}
              note={`${stats.count} matching intervals`}
              icon="◌"
            />
          </section>

          <section className="sf-panel">
            <div className="sf-panel-head">
              <div>
                <h3>Output over time</h3>
                <p>Forecast compared with recorded readings</p>
              </div>

              <span>PLANT {selectedPlant}</span>
            </div>

            <Trend rows={rows} />
          </section>

          <section className="sf-panel sf-table-panel">
            <div className="sf-panel-head sf-table-head">
              <div>
                <h3>Interval details</h3>
                <p>
                  {rows.length.toLocaleString("en-IN")} readings in this
                  forecast
                </p>
              </div>

              <div className="sf-table-tools">
                <input
                  placeholder="Search date or time…"
                  aria-label="Search timestamp"
                  value={search}
                  onChange={event => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />

                <label>
                  <input
                    type="checkbox"
                    checked={actualOnly}
                    onChange={event => {
                      setActualOnly(event.target.checked);
                      setPage(1);
                    }}
                  />
                  Recorded values only
                </label>
              </div>
            </div>

            <div className="sf-table-scroll">
              <table className="sf-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Forecast power</th>
                    <th>Recorded power</th>
                    <th>Difference</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedRows.map((row, index) => {
                    const prediction = numberOrNull(row.predicted_ac_power);
                    const actual = numberOrNull(
                      row.actual_ac_power_for_evaluation
                    );

                    const difference =
                      prediction != null && actual != null
                        ? prediction - actual
                        : null;

                    return (
                      <tr key={`${row.timestamp}-${index}`}>
                        <td>
                          {row.timestamp
                            ? new Date(row.timestamp).toLocaleString("en-IN", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            : "—"}
                        </td>

                        <td>{formatNumber(prediction, 2)}</td>
                        <td>{formatNumber(actual, 2)}</td>

                        <td
                          className={
                            difference == null
                              ? ""
                              : difference > 0
                                ? "sf-over"
                                : difference < 0
                                  ? "sf-under"
                                  : ""
                          }
                        >
                          {formatNumber(difference, 2)}
                        </td>
                      </tr>
                    );
                  })}

                  {!paginatedRows.length && (
                    <tr>
                      <td colSpan="4" className="sf-no-rows">
                        {rows.length
                          ? "No readings match these filters."
                          : "No forecast readings were returned for this request."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="sf-table-foot">
              <span>
                Showing{" "}
                {visibleRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
                –{Math.min(page * PAGE_SIZE, visibleRows.length)} of{" "}
                {visibleRows.length} readings
              </span>

              <div className="sf-pagination">
                <button
                  type="button"
                  onClick={() => setPage(current => Math.max(1, current - 1))}
                  disabled={page === 1}
                  aria-label="Previous page"
                >
                  ← Previous
                </button>

                {pageNumbers.map((pageNumber, index) => {
                  const previousPage = pageNumbers[index - 1];
                  const needsEllipsis =
                    index > 0 && pageNumber - previousPage > 1;

                  return (
                    <span className="sf-page-group" key={pageNumber}>
                      {needsEllipsis && (
                        <span className="sf-page-ellipsis">…</span>
                      )}

                      <button
                        type="button"
                        className={page === pageNumber ? "active" : ""}
                        onClick={() => setPage(pageNumber)}
                        aria-current={page === pageNumber ? "page" : undefined}
                      >
                        {pageNumber}
                      </button>
                    </span>
                  );
                })}

                <button
                  type="button"
                  onClick={() =>
                    setPage(current => Math.min(totalPages, current + 1))
                  }
                  disabled={page === totalPages}
                  aria-label="Next page"
                >
                  Next →
                </button>
              </div>
            </div>
          </section>

          <p className="sf-method">
            <b>About these insights</b> — Forecasts use the selected plant’s
            available records. Recorded readings are included for comparison
            when available.
          </p>
        </>
      )}

      <footer className="sf-footer">
        SolarGrid Intelligence <span>•</span> Plant performance workspace
      </footer>
    </main>
  );
}