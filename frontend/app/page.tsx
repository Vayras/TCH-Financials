"use client";

import * as React from "react";
import Link from "next/link";
import { inr, pct, cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { useFiscalYear } from "@/lib/fiscal-year";
import BillingBarChart from "@/components/BillingBarChart";
import QueryErrorState from "@/components/QueryErrorState";
import { DonutChart } from "@/components/DonutChart";
import { useOverviewQuery, useOverviewCreatorsQuery } from "./queries";
import styles from "./overview.module.css";

const statuses = [
	"All",
	"Awaiting Invoices",
	"Pending Payment",
	"Completed",
] as const;
const money = (value: string | number | undefined) => `₹${inr(value) || "0"}`;

export default function OverviewPage() {
	const { fyStart } = useFiscalYear();
	const [creatorFilter, setCreatorFilter] = React.useState("All");
	const [creatorInput, setCreatorInput] = React.useState("");
	const [tableSearch, setTableSearch] = React.useState("");
	const [status, setStatus] = React.useState<string>("All");
	const [view, setView] = React.useState<"month" | "quarter">("month");
	const [monthFilter, setMonthFilter] = React.useState("All");
	const [showAll, setShowAll] = React.useState(false);
	const { data, isLoading, isFetching, error, refetch } = useOverviewQuery(
		fyStart,
		creatorFilter,
	);
	const { data: creators = [] } = useOverviewCreatorsQuery();
	const fy =
		fyStart === null
			? "Fiscal year"
			: `FY ${fyStart % 100}–${(fyStart + 1) % 100}`;
	const periodView = monthFilter === "All" ? view : "month";
	const cols =
		(periodView === "month" ? data?.months : data?.quarters)?.filter(
			(c) => monthFilter === "All" || c.key === monthFilter,
		) ?? [];
	const periodKey = periodView === "month" ? "by_month" : "by_quarter";
	const rows = (data?.rows ?? []).filter((row) => {
		const search = tableSearch.trim().toLowerCase();
		return (
			(status === "All" || String(row.status) === status) &&
			(!search ||
				[row.name, row.brand, ...row.creators].some((value) =>
					value.toLowerCase().includes(search),
				))
		);
	});
	const displayedRows = showAll ? rows : rows.slice(0, 8);

	return (
		<section className={styles.dashboard}>
			<header className={styles.header}>
				<div>
					<h1>Current overview</h1>
					<p>A clear view of your campaigns, talent and revenue.</p>
				</div>
				<div className={styles.actions}>
					<Link className={styles.primaryLink} href="/commercial">
						<Icon name="briefcase" size={15} />
						Manage campaigns
						<Icon name="arrow-right" size={14} />
					</Link>
					<Button
						variant="outline"
						className={styles.refresh}
						aria-label={isFetching ? "Refreshing overview" : "Refresh overview"}
						title="Refresh overview"
						onClick={() => refetch()}
						disabled={isFetching}
					>
						<Icon
							name="refresh"
							size={14}
							className={cn(styles.refreshIcon, isFetching && styles.spinning)}
						/>
						<span className={styles.refreshLabel}>
							{isFetching ? "Refreshing…" : "Refresh"}
						</span>
					</Button>

				</div>
			</header>

			{isLoading ? (
				<div className={styles.empty} role="status">
					Getting your workspace ready…
				</div>
			) : error ? (
				<QueryErrorState
					description="The overview could not be loaded right now."
					onRetry={() => refetch()}
				/>
			) : data ? (
				<>
					<div className={styles.metrics}>
						{[
							{
								label: "Gross bookings",
								value: money(data.totals.total),
								detail: `${data.total_campaigns} campaigns this financial year`,
								icon: "briefcase",
							},
							{
								label: "Billed revenue",
								value: money(data.billed?.total),
								detail: `${pct(Number(data.billed?.total) / (Number(data.totals.total) || 1)) || "0.0%"} of gross bookings`,
								icon: "file-text",
							},
							{
								label: "Unbilled revenue",
								value: money(data.unbilled?.total),
								detail: "Bookings awaiting invoicing",
								icon: "clock",
							},
							{
								label: "Agency margin",
								value: pct(data.profit_pct.total) || "0.0%",
								detail: `${money(data.profits.total)} retained margin`,
								icon: "trending",
							},
						].map((metric, index) => (
							<article
								className={cn(styles.metric, index === 0 && styles.featured)}
								key={metric.label}
							>
								<div className={styles.metricLabel}>
									{metric.label}
									<span className={styles.icon}>
										<Icon name={metric.icon} size={17} />
									</span>
								</div>
								<strong>{metric.value}</strong>
								<p>{metric.detail}</p>
							</article>
						))}
					</div>

					<div className={styles.summary}>
						<div>
							<span className={styles.dot} />
							EMW bookings<strong>{money(data.emw_billing.total)}</strong>
						</div>
						<div>
							<span className={styles.externalDot} />
							Third-party bookings
							<strong>
								{money(
									Number(data.totals.total) - Number(data.emw_billing.total),
								)}
							</strong>
						</div>
						<div>
							<Icon name="activity" size={15} />
							Campaigns
							<strong>
								{data.campaign_counts["Completed"] ?? 0} completed
							</strong>
						</div>
					</div>

					{data.not_invoiced.count > 0 && (
						<div className={styles.attention}>
							<Icon name="file-text" size={18} />
							<div>
								<strong>Ready for the next step</strong>
								<p>
									{data.not_invoiced.count} deals awaiting invoices ·{" "}
									{money(data.not_invoiced.total_fee)} · Across all periods
								</p>
							</div>
							<Link className={styles.textLink} href="/commercial">
								Review deals
								<Icon name="arrow-right" size={14} />
							</Link>
						</div>
					)}

					<div className={styles.analytics}>
						<article className={styles.panel}>
							<div className={styles.panelHeader}>
								<div>
									<h2>Bookings over time</h2>
									<p>EMW and third-party bookings, alongside agency margin</p>
								</div>
								<div className={styles.segment} aria-label="Chart period">
									{(["month", "quarter"] as const).map((option) => (
										<button
											key={option}
											type="button"
											aria-pressed={periodView === option}
											onClick={() => {
												setView(option);
												setMonthFilter("All");
											}}
										>
											{option === "month" ? "Monthly" : "Quarterly"}
										</button>
									))}
								</div>
							</div>
							<div className={styles.filters}>
								<label>
									Period
									<select
										value={monthFilter}
										onChange={(e) => setMonthFilter(e.target.value)}
									>
										<option value="All">Full financial year</option>
										{data.months.map((m) => (
											<option key={m.key} value={m.key}>
												{m.label}
											</option>
										))}
									</select>
								</label>
								<label>
									Creator
									<input
										list="creator-list"
										placeholder="All creators"
										value={creatorInput}
										onChange={(e) => {
											setCreatorInput(e.target.value);
											const value = e.target.value.trim();
											if (!value || creators.some((c) => c.name === value))
												setCreatorFilter(value || "All");
										}}
										onBlur={() =>
											setCreatorInput(
												creatorFilter === "All" ? "" : creatorFilter,
											)
										}
									/>
								</label>
								<datalist id="creator-list">
									{creators.map((c) => (
										<option key={c.id} value={c.name} />
									))}
								</datalist>
								{(monthFilter !== "All" || creatorFilter !== "All") && (
									<button
										type="button"
										onClick={() => {
											setMonthFilter("All");
											setCreatorFilter("All");
											setCreatorInput("");
										}}
									>
										Clear filters
									</button>
								)}
							</div>
							<BillingBarChart
								cols={cols}
								totals={data.totals[periodKey]}
								emw={data.emw_billing[periodKey]}
								profits={data.profits[periodKey]}
								emwPct={data.emw_pct[periodKey]}
								profitPct={data.profit_pct[periodKey]}
							/>
							<div className={styles.caption}>
								<Icon name="info" size={13} />
								{fy} · {monthFilter === "All" ? "Full year" : cols[0]?.label} ·
								Margin is shown separately from total bookings.
							</div>
						</article>
						<article className={styles.panel}>
							<div className={styles.panelHeader}>
								<div>
									<h2>Booking mix</h2>
									<p>How your business is distributed</p>
								</div>
								<Icon name="pie" size={18} />
							</div>
							<DonutChart
								emw={Number(data.emw_billing.total)}
								external={
									Number(data.totals.total) - Number(data.emw_billing.total)
								}
							/>
							<div className={styles.mixRow}>
								<span>
									<i className={styles.dot} />
									EMW managed
								</span>
								<strong>{money(data.emw_billing.total)}</strong>
							</div>
							<div className={styles.mixRow}>
								<span>
									<i className={styles.externalDot} />
									Third-party
								</span>
								<strong>
									{money(
										Number(data.totals.total) - Number(data.emw_billing.total),
									)}
								</strong>
							</div>
							<p className={styles.caption}>
								Booking mix covers {fy}; the period selector applies to the
								chart.
							</p>
						</article>
					</div>

					<div className={styles.leaderboards}>
						{[
							{
								title: "Top brands",
								description: "Your strongest relationships by booking value",
								items: data.top_brands,
								href: "/commercial",
								action: "View campaigns",
								label: "Bookings",
								icon: "briefcase",
							},
							{
								title: "Top creators",
								description: "Talent ranked by booking value",
								items: data.top_creators,
								href: "/creators",
								action: "View creators",
								label: "Bookings",
								icon: "users",
							},
						].map((board) => (
							<article className={styles.panel} key={board.title}>
								<div className={styles.panelHeader}>
									<div>
										<h2>{board.title}</h2>
										<p>{board.description}</p>
									</div>
									<Icon name={board.icon} size={18} />
								</div>
								{board.items.length ? (
									<ol className={styles.rankings}>
										{board.items.slice(0, 5).map((item, index) => (
											<li key={item.name}>
												<span className={styles.rank}>{index + 1}</span>
												<span className={styles.avatar}>
													{item.name
														.split(" ")
														.map((n) => n[0])
														.join("")
														.slice(0, 2)
														.toUpperCase()}
												</span>
												<span className={styles.person}>{item.name}</span>
												<div>
													<strong>{money(item.total)}</strong>
													<small>{board.label}</small>
												</div>
											</li>
										))}
									</ol>
								) : (
									<div className={styles.empty}>
										Your {board.title.toLowerCase()} will appear as bookings are
										added.
									</div>
								)}
								<Link className={styles.textLink} href={board.href}>
									{board.action}
									<Icon name="arrow-right" size={14} />
								</Link>
							</article>
						))}
					</div>

					<article className={cn(styles.panel, styles.campaigns)}>
						<div className={styles.panelHeader}>
							<div>
								<h2>Campaign workspace</h2>
								<p>Keep your talent, bookings and next steps in view.</p>
							</div>
							<span className={styles.year}>{fy}</span>
						</div>
						<div className={styles.tableToolbar}>
							<div className={styles.tabs} aria-label="Campaign status">
								{statuses.map((tab) => (
									<button
										type="button"
										key={tab}
										aria-pressed={status === tab}
										onClick={() => {
											setStatus(tab);
											setShowAll(false);
										}}
									>
										{tab === "Awaiting Invoices"
											? "Awaiting invoices"
											: tab === "Pending Payment"
												? "Pending payment"
												: tab}
										<span>
											{tab === "All"
												? data.rows.length
												: data.rows.filter((r) => String(r.status) === tab)
													.length}
										</span>
									</button>
								))}
							</div>
							<label className={styles.search}>
								<Icon name="search" size={16} />
								<input
									aria-label="Search campaigns, brands or creators"
									placeholder="Search campaigns, brands or creators"
									value={tableSearch}
									onChange={(e) => {
										setTableSearch(e.target.value);
										setShowAll(false);
									}}
								/>
							</label>
						</div>
						<div className={styles.tableScroll}>
							<table role="table" aria-label="Campaign workspace">
								<thead>
									<tr>
										<th scope="col">Campaign / brand</th>
										<th scope="col">Talent</th>
										<th scope="col">Deals</th>
										<th scope="col" className={styles.numeric}>
											Bookings
										</th>
										<th scope="col" className={styles.numeric}>
											Agency margin
										</th>
										<th scope="col">Status</th>
									</tr>
								</thead>
								<tbody>
									{displayedRows.map((row) => (
										<tr key={row.campaign_id ?? row.name}>
											<td className={styles.campaignName}>
												<strong>{row.name}</strong>
												<small>{row.brand || "No brand assigned"}</small>
											</td>
											<td className={styles.campaignTalent}>
												<span
													className={styles.talent}
													title={row.creators.join(", ")}
												>
													{row.creators[0] || "Unassigned"}
													{row.creators.length > 1 && (
														<span className={styles.year}>
															+{row.creators.length - 1}
														</span>
													)}
												</span>
											</td>
											<td data-label="Deals">{row.deal_count}</td>
											<td data-label="Bookings" className={styles.numeric}>
												{money(row.total)}
											</td>
											<td data-label="Agency margin" className={styles.numeric}>
												{money(row.profit)}
											</td>
											<td className={styles.campaignStatus}>
												<span
													className={cn(
														styles.status,
														String(row.status) === "Completed" &&
														styles.complete,
														String(row.status) === "Pending Payment" &&
														styles.pending,
													)}
												>
													{String(row.status) || "Active"}
												</span>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						{!rows.length && (
							<div className={styles.empty}>
								<Icon name="briefcase" size={24} />
								<strong>
									{tableSearch || status !== "All"
										? "No matching campaigns"
										: "Your next campaign starts here"}
								</strong>
								<p>
									{tableSearch || status !== "All"
										? "Try another search or choose All."
										: "Add a campaign to begin tracking your talent and bookings."}
								</p>
								<Link className={styles.textLink} href="/commercial">
									Open campaigns
									<Icon name="arrow-right" size={14} />
								</Link>
							</div>
						)}
						<footer className={styles.tableFooter}>
							<span>
								Showing {displayedRows.length} of {rows.length} campaigns · {fy}
							</span>
							{rows.length > 8 && (
								<button type="button" onClick={() => setShowAll(!showAll)}>
									{showAll ? "Show fewer" : "Show all campaigns"}
								</button>
							)}
							<Link className={styles.textLink} href="/commercial">
								Manage campaigns
								<Icon name="arrow-right" size={14} />
							</Link>
						</footer>
					</article>
					<footer className={styles.footer}>
						<span>TCH Financials · Built around your talent</span>
						<span>Amounts in INR · {fy}</span>
					</footer>
				</>
			) : null}
		</section>
	);
}
