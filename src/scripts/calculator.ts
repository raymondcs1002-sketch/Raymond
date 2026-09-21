import { getTenureOptions, summarize, type RateSchedule } from "../lib/repayment";

// Matches src/lib/format.ts: SGD's Intl currency symbol is an ambiguous
// "$" in English locales, so we prefix our own symbol instead.
function formatMoney(amount: number, currencySymbol: string, locale: string): string {
  const grouped = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount);
  return `${currencySymbol} ${grouped}`;
}

document.querySelectorAll<HTMLElement>("[data-calculator]").forEach((root) => {
  const currencySymbol = root.dataset.currencySymbol ?? "$";
  const locale = root.dataset.locale ?? "en-US";
  let schedule: RateSchedule = [];
  try {
    schedule = JSON.parse(root.dataset.schedule ?? "[]");
  } catch {
    schedule = [];
  }

  const amountInput = root.querySelector<HTMLInputElement>("[data-calc-amount]");
  const amountOutput = root.querySelector<HTMLOutputElement>("#calc-amount-output");
  const tenureGroup = root.querySelector<HTMLElement>("[data-calc-tenure-group]");
  const interestEl = root.querySelector<HTMLElement>("[data-calc-interest]");
  const totalEl = root.querySelector<HTMLElement>("[data-calc-total]");
  const instalmentEl = root.querySelector<HTMLElement>("[data-calc-instalment]");

  if (!amountInput || !tenureGroup) return;

  let selectedTenure: number | null = null;

  function renderTenurePills() {
    const amount = Number(amountInput!.value);
    const options = getTenureOptions(schedule, amount);
    const stillValid = options.some((o) => o.tenureMonths === selectedTenure);
    if (!stillValid) selectedTenure = options[Math.floor(options.length / 2)]?.tenureMonths ?? null;

    tenureGroup!.innerHTML = options
      .map(
        (o) =>
          `<button type="button" class="tenure-pill" data-tenure-pill data-value="${o.tenureMonths}" aria-pressed="${o.tenureMonths === selectedTenure}">${o.tenureMonths} months</button>`,
      )
      .join("");
  }

  function renderResults() {
    const amount = Number(amountInput!.value);
    if (amountOutput) amountOutput.textContent = formatMoney(amount, currencySymbol, locale);

    const option = getTenureOptions(schedule, amount).find((o) => o.tenureMonths === selectedTenure);
    if (!option) return;

    const result = summarize(option, amount);
    if (interestEl) interestEl.textContent = formatMoney(result.totalInterest, currencySymbol, locale);
    if (totalEl) totalEl.textContent = formatMoney(result.totalRepayment, currencySymbol, locale);
    if (instalmentEl) instalmentEl.textContent = formatMoney(result.monthlyInstalment, currencySymbol, locale);
  }

  tenureGroup.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-tenure-pill]");
    if (!btn) return;
    selectedTenure = Number(btn.dataset.value);
    tenureGroup!.querySelectorAll("[data-tenure-pill]").forEach((el) => el.setAttribute("aria-pressed", String(el === btn)));
    renderResults();
  });

  amountInput.addEventListener("input", () => {
    renderTenurePills();
    renderResults();
  });

  // Seed selectedTenure from whatever's marked pressed in the server-rendered markup.
  const initiallyPressed = tenureGroup.querySelector<HTMLElement>('[data-tenure-pill][aria-pressed="true"]');
  selectedTenure = initiallyPressed ? Number(initiallyPressed.dataset.value) : null;
  renderResults();
});
