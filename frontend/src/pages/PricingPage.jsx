import React, { useState, useEffect } from "react";
import { apiFetch } from "../services/apiClient";

const PLANS = [
  {
    id: "FREE",
    name: "Free",
    price: 0,
    features: [
      "Choose from 100+ languages",
      "Up to 1 language for AI translation",
      "500 product limit",
      "20 collection limit",
      "20 article limit",
      "20 page limit",
      "10 custom translations",
      "5 glossary terms",
      "Import / Export",
    ],
  },
  {
    id: "BASIC",
    name: "Basic",
    price: 9,
    features: [
      "Everything in Free, plus:",
      "5 languages for AI translation",
      "3,000 product limit",
      "500 collection limit",
      "500 article limit",
      "500 page limit",
      "100 custom translations",
      "100 image translations",
      "100 third-party app translations",
      "20 glossary terms",
      "Store translation context",
    ],
  },
  {
    id: "PRO",
    name: "Pro",
    price: 29,
    features: [
      "Everything in Basic, plus:",
      "10 languages for AI translation",
      "7,000 product limit",
      "2,000 collection limit",
      "2,000 article limit",
      "2,000 page limit",
      "Unlimited custom translations",
      "Unlimited image translations",
      "Unlimited third-party app translations",
      "Unlimited glossary terms",
      "Priority support",
    ],
  },
];

function PricingPage() {
  const [currentPlan, setCurrentPlan] = useState("FREE");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const shop = localStorage.getItem("shopify_shop");
    if (!shop) return;

    apiFetch(`/subscription/status/${encodeURIComponent(shop)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.plan) setCurrentPlan(data.plan);
      })
      .catch(() => {});
  }, []);

  const handleSelectPlan = async (planId) => {
    if (planId === currentPlan) return;

    const shop = localStorage.getItem("shopify_shop");
    if (!shop) {
      alert("No shop connected. Please install the app first.");
      return;
    }

    setLoading(true);
    try {
      const resp = await apiFetch("/billing/create-subscription", {
        method: "POST",
        body: JSON.stringify({ shop, plan: planId }),
      });

      const data = await resp.json();

      if (planId === "FREE") {
        setCurrentPlan("FREE");
        alert("Free plan activated!");
        return;
      }

      if (data.confirmationUrl) {
        window.location.href = data.confirmationUrl;
      } else {
        alert("Error: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-100 px-4 sm:px-8 py-8">
      <h1 className="text-lg font-bold text-slate-900 mb-6">Pricing Plans</h1>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          return (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col ${
                isCurrent ? "ring-2 ring-violet-500" : ""
              }`}
            >
              <div className="p-6">
                <h2 className="text-xl font-bold text-slate-900">{plan.name}</h2>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-slate-900">
                    {plan.price === 0 ? "Free" : `$${plan.price}`}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-sm text-slate-500">/month</span>
                  )}
                </div>
              </div>

              <ul className="px-6 pb-6 space-y-2 flex-1">
                {plan.features.map((feat, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <svg className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                    </svg>
                    {feat}
                  </li>
                ))}
              </ul>

              <div className="px-6 pb-6">
                {isCurrent ? (
                  <button
                    disabled
                    className="w-full py-2.5 rounded-lg text-sm font-semibold bg-slate-100 text-slate-400 cursor-default"
                  >
                    Current plan
                  </button>
                ) : (
                  <button
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={loading}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    {loading ? "Processing..." : `Select ${plan.name}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PricingPage;
