import '@shopify/ui-extensions';

//@ts-ignore
declare module './src/tools.js' {
  interface MultilingualTranslatorInput {
    /**
     * The content key or text to retrieve a translation for
     */
    content: string;
    /**
     * ISO language code of the target language (e.g. fr, es, de)
     */
    target_language: string;
    [k: string]: unknown;
  }

  type MultilingualTranslatorOutput = unknown;
  interface ShopifyTools {
    /**
     * Fetches translated content for a specific language from the store's translation data. Returns translated text for products, pages, or other store content.
     */
    register(
      name: 'multilingual_translator',
      handler: (
        input: MultilingualTranslatorInput,
      ) => MultilingualTranslatorOutput | Promise<MultilingualTranslatorOutput>,
    ): () => void;
  }

  const shopify: import('@shopify/ui-extensions/admin').WithGeneratedTools<
    import('@shopify/ui-extensions/admin.app.tools.data').Api,
    ShopifyTools
  >;
  const globalThis: { shopify: typeof shopify };
}
