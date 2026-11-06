import {
  priorityLabel,
  type ProjectPriorityOption,
  type ProjectStatusOption,
} from "@/features/projects/project-options";
import { calculateSavingsPlanPrioritySummary } from "@/features/projects/savings-plan-purchases";
import type { ItemWithOptions } from "@/types/domain";
import { useFormatMoney } from "@/utils/format";

const NO_PRIORITY = "__none__";

export function SavingsPlanPrioritySummary({
  items,
  statusOptions,
  priorityOptions,
}: {
  items: readonly ItemWithOptions[];
  statusOptions: readonly ProjectStatusOption[];
  priorityOptions: readonly ProjectPriorityOption[];
}) {
  const formatMoney = useFormatMoney();
  const summaries = calculateSavingsPlanPrioritySummary(
    items,
    statusOptions,
    priorityOptions.map((option) => option.id),
  );
  const totalPending = summaries.reduce(
    (total, summary) => total + summary.pending,
    0,
  );

  return (
    <section
      className="dashboard-section savings-priority-summary"
      aria-labelledby="savings-priority-summary-heading"
    >
      <div className="row-between">
        <div>
          <h3 id="savings-priority-summary-heading">
            Dinero necesario por prioridad
          </h3>
          <p className="muted">Compras del plan agrupadas por prioridad.</p>
        </div>
        <p className="savings-priority-total">
          <span>Pendiente total</span>
          <strong>{formatMoney(totalPending)}</strong>
        </p>
      </div>
      {items.length === 0 ? (
        <p className="muted">Aún no hay artículos para resumir.</p>
      ) : (
        <div
          className="savings-priority-list"
          role="list"
          aria-label="Dinero necesario por prioridad"
        >
          {summaries.map((summary) => (
            <article
              key={summary.priority}
              className="savings-priority-row"
              role="listitem"
            >
              <h4>
                {summary.priority === NO_PRIORITY
                  ? "Sin prioridad"
                  : priorityLabel(summary.priority, priorityOptions)}
              </h4>
              <dl>
                <div>
                  <dt>Total estimado</dt>
                  <dd>{formatMoney(summary.estimated)}</dd>
                </div>
                <div>
                  <dt>Gastado</dt>
                  <dd>{formatMoney(summary.spent)}</dd>
                </div>
                <div>
                  <dt>Pendiente</dt>
                  <dd>{formatMoney(summary.pending)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
