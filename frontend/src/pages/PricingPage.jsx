import React, { useState } from "react";

const plans = [
  {
    id: "basic",
    name: "Basic",
    monthly: 0,
    yearly: 0,
    current: true
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 11.99,
    yearly: 9.99,
    cta: "Select Pro"
  },
  {
    id: "business",
    name: "Business",
    monthly: 29.99,
    yearly: 24.99,
    cta: "Select Business"
  },
  {
    id: "premium",
    name: "Premium",
    monthly: 59.99,
    yearly: 49.99,
    cta: "Select Premium"
  }
];

const featureRows = [
  { label: "Choose from 100+ languages", values: ["check", "check", "check", "check"] },
  { label: "Add up to 20 languages", values: ["check", "check", "check", "check"] },
  { label: "Unlimited manual translations", values: ["check", "check", "check", "check"] },
  { label: "AI translations", values: ["check", "check", "check", "check"] },
  { label: "Bulk AI translations", values: ["cross", "check", "check", "check"] },
  { label: "Languages for AI translation", values: ["1", "5", "10", "20"] },
  { label: "Product limit for AI translation", values: ["500", "3000", "7000", "15000"] },
  { label: "Collection limit for AI translation", values: ["20", "500", "2000", "10000"] },
  { label: "Article limit for AI translation", values: ["20", "500", "2000", "10000"] },
  { label: "Page limit for AI translation", values: ["20", "500", "2000", "10000"] },
  { label: "Custom translations", values: ["10", "100", "unlimited", "unlimited"] },
  { label: "Image translations", values: ["cross", "100", "unlimited", "unlimited"] },
  { label: "Third party app translations", values: ["cross", "100", "unlimited", "unlimited"] },
  { label: "Glossary", values: ["5", "20", "unlimited", "unlimited"] },
  { label: "Import / Export", values: ["check", "check", "check", "check"] },
  { label: "Store translation context", values: ["cross", "check", "check", "check"] },
  { label: "Priority support", values: ["cross", "cross", "check", "check"] },
  { label: "Dedicated account manager", values: ["cross", "cross", "cross", "check"] }
];

function Cell({ value }) {
  if (value === "check") {
    return (
      <svg className="h-4 w-4 text-slate-900" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  if (value === "cross") {
    return (
      <svg className="h-4 w-4 text-slate-300" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return <span className="text-sm text-slate-700">{value}</span>;
}

function PricingComparisonPage() {
  const [billing, setBilling] = useState("yearly"); // "monthly" | "yearly"

  return (
    <div
      className="min-h-full bg-slate-100 px-4 sm:px-8 py-8"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      `}</style>

      <h1 className="text-lg font-bold text-slate-900 mb-6">Plans</h1>

      {/* Billing toggle */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white rounded-2xl shadow-sm p-4 flex justify-center">
          <div className="inline-flex items-center bg-slate-100 rounded-full p-1">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                billing === "monthly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Pay monthly
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                billing === "yearly" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Pay annually
              <span className="bg-sky-400 text-slate-900 text-[10px] font-bold px-1.5 py-0.5 rounded">
                Save 17%
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Comparison table */}
      <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[900px]">
            <thead>
              <tr>
                <th className="w-56"></th>
                {plans.map((plan) => {
                  const price = billing === "yearly" ? plan.yearly : plan.monthly;
                  const strikePrice = billing === "yearly" ? plan.monthly : null;
                  const yearlySavings = plan.monthly > 0 ? ((plan.monthly - plan.yearly) * 12).toFixed(2) : null;

                  return (
                    <th
                      key={plan.id}
                      className={`relative text-left align-top px-6 pt-6 pb-5 ${
                        plan.current ? "border-x-2 border-t-2 border-violet-500 rounded-t-xl" : ""
                      }`}
                    >
                      {plan.current && (
                        <span className="absolute -top-2.5 left-6 bg-sky-100 text-sky-700 text-[10px] font-semibold px-2 py-0.5 rounded">
                          Current plan
                        </span>
                      )}
                      <div className="text-base font-semibold text-slate-900">{plan.name}</div>
                      <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold text-slate-900">
                          ${price.toFixed(2).replace(/\.00$/, "")}
                        </span>
                        <span className="text-xs text-slate-500">/mo</span>
                        {strikePrice ? (
                          <span className="text-xs text-slate-400 line-through">
                            ${strikePrice.toFixed(2).replace(/\.00$/, "")}
                          </span>
                        ) : null}
                      </div>
                      {billing === "yearly" && plan.monthly > 0 && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          ${(plan.yearly * 12).toFixed(2)} billed yearly
                        </div>
                      )}
                      {billing === "yearly" && yearlySavings && (
                        <span className="inline-block mt-2 bg-emerald-100 text-emerald-700 text-[11px] font-semibold px-2 py-0.5 rounded">
                          save ${yearlySavings} yearly
                        </span>
                      )}
                      <div className="mt-4">
                        {plan.current ? (
                          <button
                            disabled
                            className="w-full py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-400 cursor-default"
                          >
                            Current plan
                          </button>
                        ) : (
                          <button className="w-full py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors">
                            {plan.cta}
                          </button>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {featureRows.map((row, rIdx) => (
                <tr key={rIdx} className="border-t border-slate-100">
                  <td className="px-6 py-3.5 text-sm text-slate-600">{row.label}</td>
                  {row.values.map((value, cIdx) => (
                    <td
                      key={cIdx}
                      className={`px-6 py-3.5 ${
                        plans[cIdx].current
                          ? `border-x-2 border-violet-500 ${
                              rIdx === featureRows.length - 1 ? "border-b-2 rounded-b-xl" : ""
                            }`
                          : ""
                      }`}
                    >
                      <Cell value={value} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default PricingComparisonPage;