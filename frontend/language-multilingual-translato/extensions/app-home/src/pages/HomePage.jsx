import { useState, useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { listFAQs, primeFAQ } from '../../../../shared/models/faq';
import { gidToId } from '../../../../shared/utils/gid';

/** @typedef {import('../../../../shared/models/faq').FAQSummary} FAQSummary */

export default function HomePage() {
  const location = useLocation();
  const [faqs, setFaqs] = useState(/** @type {FAQSummary[]} */([]));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setFaqs(await listFAQs());
      setLoading(false);
    })();
  }, []);

  /**
   * @param {Event} event
   * @param {FAQSummary} faq
   */
  const openFAQ = (event, faq) => {
    const mouseEvent = /** @type {MouseEvent} */ (event);
    if (
      mouseEvent.defaultPrevented ||
      mouseEvent.button !== 0 ||
      mouseEvent.metaKey ||
      mouseEvent.altKey ||
      mouseEvent.ctrlKey ||
      mouseEvent.shiftKey
    ) {

    }

    const id = gidToId(faq.id);
    mouseEvent.preventDefault();
    primeFAQ(id, faq);
    location.route(`/faq/${id}`);
  };

  const hasFaqs = faqs.length > 0;

  return (
    <s-page heading="🌐 Language Multilingual Translator">
      <s-button slot="primary-action" variant="primary">
        Translate Store
      </s-button>

      <s-section>
        <s-heading>Welcome to Shopify Multilingual Translator</s-heading>
        <s-paragraph>
          Manage and translate your Shopify store into multiple languages.
        </s-paragraph>
      </s-section>

      <s-section heading="Dashboard">
        <s-grid gap="base">

          <s-box padding="base" borderRadius="base" borderWidth="base">
            <s-heading>🌍 Supported Languages</s-heading>
            <s-paragraph>
              Manage all available store languages.
            </s-paragraph>
            <s-badge tone="success">5 Languages</s-badge>
          </s-box>

          <s-box padding="base" borderRadius="base" borderWidth="base">
            <s-heading>🔤 Translation Provider</s-heading>
            <s-paragraph>
              Configure Google Translate API settings.
            </s-paragraph>
            <s-badge tone="info">Google Translate</s-badge>
          </s-box>

          <s-box padding="base" borderRadius="base" borderWidth="base">
            <s-heading>📊 Analytics</s-heading>
            <s-paragraph>
              Monitor translation activity and usage.
            </s-paragraph>
            <s-badge tone="success">Live</s-badge>
          </s-box>

          <s-box padding="base" borderRadius="base" borderWidth="base">
            <s-heading>⚡ Theme Extension</s-heading>
            <s-paragraph>
              Language Switcher extension status.
            </s-paragraph>
            <s-badge tone="success">Connected</s-badge>
          </s-box>

        </s-grid>
      </s-section>

      <s-section heading="Quick Actions">
        <s-button-group>
          <s-button>Scan Store</s-button>
          <s-button>Translate Products</s-button>
          <s-button>Translate Pages</s-button>
          <s-button>Translate Collections</s-button>
        </s-button-group>
      </s-section>

      <s-section heading="Translation Overview">
        <s-table>
          <s-table-header-row>
            <s-table-header>Metric</s-table-header>
            <s-table-header>Value</s-table-header>
          </s-table-header-row>

          <s-table-body>
            <s-table-row>
              <s-table-cell>Total Products</s-table-cell>
              <s-table-cell>0</s-table-cell>
            </s-table-row>

            <s-table-row>
              <s-table-cell>Translated Products</s-table-cell>
              <s-table-cell>0</s-table-cell>
            </s-table-row>

            <s-table-row>
              <s-table-cell>Languages Enabled</s-table-cell>
              <s-table-cell>5</s-table-cell>
            </s-table-row>

            <s-table-row>
              <s-table-cell>Translation Requests</s-table-cell>
              <s-table-cell>0</s-table-cell>
            </s-table-row>
          </s-table-body>
        </s-table>
      </s-section>
    </s-page>
  );
}