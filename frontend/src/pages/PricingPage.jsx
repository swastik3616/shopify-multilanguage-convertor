import React, { useState } from "react";

const pricingPlans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    description: "Perfect for getting started with basic translations.",
    features: [
      "1 Additional Language",
      "Manual Translations",
      "Basic Language Switcher",
      "Community Support"
    ],
    buttonText: "Current Plan"
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19",
    period: "/mo",
    description: "Great for growing stores that need SEO support.",
    features: [
      "Up to 3 Languages",
      "Auto AI Translations",
      "SEO Metadata Translation",
      "Email Support"
    ],
    buttonText: "Upgrade to Pro",
    badge: "Most Popular"
  },
  {
    id: "advance",
    name: "Advance",
    price: "$49",
    period: "/mo",
    description: "Advanced features for high-volume international stores.",
    features: [
      "Up to 10 Languages",
      "Currency Converter Engine",
      "Premium Floating Widget",
      "Priority 24/7 Support"
    ],
    buttonText: "Upgrade to Advance"
  },
  {
    id: "business",
    name: "Business",
    price: "$99",
    period: "/mo",
    description: "Unlimited power and dedicated support for enterprise.",
    features: [
      "Unlimited Languages",
      "Custom CSS/JS Integration",
      "Dedicated Account Manager",
      "Custom API Access"
    ],
    buttonText: "Upgrade to Business"
  }
];

function PricingPage() {
  // Pro is selected by default since it carries the "Most Popular" badge
  const [selectedId, setSelectedId] = useState("pro");

  return (
    <div
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap');
        .plan-card {
          transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1),
                      box-shadow 220ms cubic-bezier(0.16, 1, 0.3, 1),
                      border-color 220ms ease;
        }
        .plan-card:focus-visible {
          outline: 2px solid #0f766e;
          outline-offset: 3px;
        }
        .display-font {
          font-family: 'Fraunces', Georgia, serif;
        }
      `}</style>

      {/* Header Section */}
      <div className="text-center max-w-2xl mx-auto mb-14">
        <span className="inline-block text-xs font-semibold tracking-[0.18em] uppercase text-teal-700 mb-3">
          Pricing
        </span>
        <h1 className="display-font text-4xl sm:text-5xl font-medium text-slate-900 tracking-tight">
          Simple, transparent pricing
        </h1>
        <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
          Choose the right plan for your Shopify store. Upgrade at any time as your international audience grows.
        </p>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
        {pricingPlans.map((plan) => {
          const isSelected = selectedId === plan.id;

          return (
            <div
              key={plan.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedId(plan.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedId(plan.id);
                }
              }}
              className={`plan-card relative p-8 bg-white border rounded-2xl flex flex-col cursor-pointer ${
                isSelected
                  ? "border-teal-700 ring-2 ring-teal-700 shadow-2xl -translate-y-2 z-10"
                  : "border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1"
              }`}
            >
              {/* Badge: shows on whichever plan carries it, but styled to match selection state */}
              {plan.badge && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <span
                    className={`inline-flex items-center rounded-full px-4 py-1 text-[11px] font-bold tracking-wide uppercase shadow-sm ${
                      isSelected ? "bg-teal-700 text-white" : "bg-slate-800 text-white"
                    }`}
                  >
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Selected checkmark */}
              {isSelected && (
                <div className="absolute top-5 right-5 h-6 w-6 rounded-full bg-teal-700 flex items-center justify-center">
                  <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}

              {/* Plan Title & Description */}
              <div className="mb-6 pr-6">
                <h3 className="display-font text-xl font-semibold text-slate-900">{plan.name}</h3>
                <p className="mt-2 text-sm text-slate-500 min-h-[40px] leading-relaxed">
                  {plan.description}
                </p>
              </div>

              {/* Price */}
              <div className="mb-6 flex items-baseline text-slate-900">
                <span className="display-font text-4xl font-semibold tracking-tight">{plan.price}</span>
                {plan.period && (
                  <span className="ml-1 text-base font-medium text-slate-500">{plan.period}</span>
                )}
              </div>

              {/* Feature List */}
              <ul className="mb-8 space-y-3.5 flex-1">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start">
                    <svg
                      className={`h-5 w-5 shrink-0 mt-0.5 ${isSelected ? "text-teal-700" : "text-slate-400"}`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="ml-3 text-sm text-slate-700 font-medium">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Action Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(plan.id);
                }}
                className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  isSelected
                    ? "bg-teal-700 text-white hover:bg-teal-800 focus:ring-teal-700 shadow-sm"
                    : "bg-slate-50 text-slate-800 hover:bg-slate-100 border border-slate-200 focus:ring-slate-500"
                }`}
              >
                {isSelected ? "Selected" : plan.buttonText}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PricingPage;