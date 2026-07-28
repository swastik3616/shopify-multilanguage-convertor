import requests
from flask import current_app

from utils.helpers import decrypt_token


def _graphql_client(shop_domain: str, encrypted_token: str):
    access_token = decrypt_token(encrypted_token)
    api_version = current_app.config["SHOPIFY_API_VERSION"]
    url = f"https://{shop_domain}/admin/api/{api_version}/graphql.json"
    headers = {
        "X-Shopify-Access-Token": access_token,
        "Content-Type": "application/json",
    }
    return url, headers


def graphql_query(shop_domain: str, encrypted_token: str, query: str, variables: dict = None):
    url, headers = _graphql_client(shop_domain, encrypted_token)
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    resp = requests.post(url, json=payload, headers=headers, timeout=30)
    if not resp.ok:
        raise Exception(f"Shopify GraphQL error {resp.status_code}: {resp.text}")
    data = resp.json()
    if "errors" in data:
        raise Exception(f"Shopify GraphQL errors: {data['errors']}")
    return data["data"]


CREATE_SUBSCRIPTION_MUTATION = """
mutation AppSubscriptionCreate(
  $name: String!
  $returnUrl: URL!
  $test: Boolean!
  $trialDays: Int!
  $price: Decimal!
  $recurrence: AppSubscriptionInterval!
) {
  appSubscriptionCreate(
    name: $name
    returnUrl: $returnUrl
    test: $test
    trialDays: $trialDays
    lineItems: [{
      plan: {
        appRecurringPricingDetails: {
          price: { amount: $price, currencyCode: USD }
          interval: $recurrence
        }
      }
    }]
  ) {
    confirmationUrl
    userErrors { field message }
  }
}
"""

CURRENT_SUBSCRIPTIONS_QUERY = """
query {
  currentAppInstallation {
    activeSubscriptions {
      id
      name
      status
      createdAt
      currentPeriodEnd
      trialDays
    }
  }
}
"""


def create_subscription(shop_domain: str, encrypted_token: str, plan_name: str, plan_config: dict, return_url: str):
    test = current_app.config["BILLING_TEST_MODE"]
    trial_days = current_app.config["BILLING_TRIAL_DAYS"]

    variables = {
        "name": plan_config["name"],
        "returnUrl": return_url,
        "test": test,
        "trialDays": trial_days,
        "price": str(plan_config["price"]),
        "recurrence": plan_config["recurrence"],
    }

    data = graphql_query(shop_domain, encrypted_token, CREATE_SUBSCRIPTION_MUTATION, variables)
    result = data["appSubscriptionCreate"]

    if result.get("userErrors"):
        raise Exception(f"Subscription creation failed: {result['userErrors']}")

    return result["confirmationUrl"]


def get_active_subscriptions(shop_domain: str, encrypted_token: str):
    data = graphql_query(shop_domain, encrypted_token, CURRENT_SUBSCRIPTIONS_QUERY)
    return data["currentAppInstallation"]["activeSubscriptions"]
