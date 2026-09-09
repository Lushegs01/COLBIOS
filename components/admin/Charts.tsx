import type { BreakdownRow, TimeSeriesPoint } from "@/lib/admin/analytics";
import { formatMoney } from "@/lib/format/money";

/**
 * Charts as server-rendered SVG.
 *
 * A charting library would add a few hundred kilobytes of client JavaScript to
 * every admin page for what is, in the end, a handful of rectangles and a
 * polyline. These render on the server, work with JavaScript disabled, and each
 * one carries a table-shaped accessible description so a screen reader gets the
 * numbers rather than "graphic".
 */

const CHART_WIDTH = 720;
const CHART_HEIGHT = 200;
const PADDING = { top: 12, right: 8, bottom: 24, left: 8 };

const shortDate = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short" });

export function RevenueChart({
  series,
  currency = "NGN",
}: {
  series: TimeSeriesPoint[];
  currency?: string;
}) {
  if (series.length === 0) return <ChartEmpty />;

  const max = Math.max(...series.map((point) => point.amountMinor), 1);
  const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const step = series.length > 1 ? innerWidth / (series.length - 1) : 0;

  const points = series.map((point, index) => {
    const x = PADDING.left + index * step;
    const y = PADDING.top + innerHeight - (point.amountMinor / max) * innerHeight;
    return { ...point, x, y };
  });

  const line = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${PADDING.left},${PADDING.top + innerHeight} ${line} ${(
    PADDING.left + (series.length - 1) * step
  ).toFixed(1)},${PADDING.top + innerHeight}`;

  const total = series.reduce((sum, point) => sum + point.amountMinor, 0);

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="h-[200px] w-full"
        role="img"
        aria-label={`Revenue over the last ${series.length} days. Total ${formatMoney(total, currency)}. Highest day ${formatMoney(max, currency)}.`}
      >
        {[0.25, 0.5, 0.75, 1].map((fraction) => (
          <line
            key={fraction}
            x1={PADDING.left}
            x2={CHART_WIDTH - PADDING.right}
            y1={PADDING.top + innerHeight * fraction}
            y2={PADDING.top + innerHeight * fraction}
            stroke="#E5E7EB"
            strokeWidth="1"
          />
        ))}

        <polygon points={area} fill="#0B5D4A" fillOpacity="0.08" />
        <polyline
          points={line}
          fill="none"
          stroke="#0B5D4A"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((point, index) => {
          if (index % Math.max(1, Math.floor(series.length / 6)) !== 0) return null;

          // Anchor the outermost labels to their own edge; centring them would
          // push half the text outside the viewBox and clip it.
          const isFirst = index === 0;
          const isLast = index === points.length - 1;
          return (
            <text
              key={point.date}
              x={point.x}
              y={CHART_HEIGHT - 6}
              textAnchor={isFirst ? "start" : isLast ? "end" : "middle"}
              fontSize="10"
              fill="#6B7280"
            >
              {shortDate.format(new Date(`${point.date}T00:00:00Z`))}
            </text>
          );
        })}
      </svg>

      <figcaption className="sr-only">
        <table>
          <caption>Daily verified revenue</caption>
          <tbody>
            {series.map((point) => (
              <tr key={point.date}>
                <th scope="row">{point.date}</th>
                <td>{formatMoney(point.amountMinor, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}

export function PaymentsBarChart({ series }: { series: TimeSeriesPoint[] }) {
  if (series.length === 0) return <ChartEmpty />;

  const max = Math.max(...series.map((point) => point.count), 1);
  const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const slot = innerWidth / series.length;
  const barWidth = Math.max(2, slot * 0.6);
  const total = series.reduce((sum, point) => sum + point.count, 0);

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="h-[200px] w-full"
        role="img"
        aria-label={`Successful payments per day over the last ${series.length} days. ${total} payments in total.`}
      >
        <line
          x1={PADDING.left}
          x2={CHART_WIDTH - PADDING.right}
          y1={PADDING.top + innerHeight}
          y2={PADDING.top + innerHeight}
          stroke="#E5E7EB"
        />
        {series.map((point, index) => {
          const height = (point.count / max) * innerHeight;
          return (
            <rect
              key={point.date}
              x={PADDING.left + index * slot + (slot - barWidth) / 2}
              y={PADDING.top + innerHeight - height}
              width={barWidth}
              height={Math.max(height, point.count > 0 ? 2 : 0)}
              rx="2"
              fill="#2F8567"
            />
          );
        })}
      </svg>

      <figcaption className="sr-only">
        <table>
          <caption>Successful payments per day</caption>
          <tbody>
            {series.map((point) => (
              <tr key={point.date}>
                <th scope="row">{point.date}</th>
                <td>{point.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}

/**
 * Horizontal breakdown bars. Each row states its own number in text, so the
 * bar is decoration rather than the only way to read the value.
 */
export function BreakdownBars({
  rows,
  currency = "NGN",
  emptyLabel = "No data yet.",
}: {
  rows: BreakdownRow[];
  currency?: string;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-[13px] text-muted">{emptyLabel}</p>;
  }

  const max = Math.max(...rows.map((row) => row.amountMinor), 1);

  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const percent = Math.max(2, (row.amountMinor / max) * 100);
        return (
          <li key={row.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13.5px] font-medium text-ink">{row.label}</span>
              <span className="text-[13px] tabular-nums text-muted">
                <span className="font-semibold text-ink">
                  {formatMoney(row.amountMinor, currency)}
                </span>{" "}
                · {row.count} {row.count === 1 ? "payment" : "payments"}
              </span>
            </div>
            {/*
              Drawn as SVG rather than a div with an inline width. An inline
              `style` attribute would force `style-src 'unsafe-inline'` into the
              Content-Security-Policy for the whole admin area; a proportional
              rect needs no such exception.
            */}
            <svg
              viewBox="0 0 100 3"
              preserveAspectRatio="none"
              className="mt-1.5 h-2 w-full"
              role="presentation"
            >
              <rect x="0" y="0" width="100" height="3" rx="1.5" fill="#F1F7F4" />
              <rect x="0" y="0" width={percent} height="3" rx="1.5" fill="#0F6B51" />
            </svg>
          </li>
        );
      })}
    </ul>
  );
}

function ChartEmpty() {
  return (
    <div className="grid h-[200px] place-items-center rounded-xl border border-dashed border-line">
      <p className="text-[13px] text-muted">No payments in this period yet.</p>
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "warning";
}) {
  const tones = {
    default: "border-line",
    positive: "border-pine-200 bg-pine-50/60",
    warning: "border-amber-200 bg-amber-50/60",
  } as const;

  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="text-[11.5px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-[22px] font-bold leading-tight tracking-tight text-ink tabular-nums">
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[11.5px] text-muted">{hint}</p> : null}
    </div>
  );
}
